use std::{
    ffi::c_void,
    ptr::{null, null_mut, NonNull},
};

use objc2_core_audio_types::{AudioBuffer, AudioBufferList, AudioStreamBasicDescription};
use objc2_core_foundation::CFRetained;
use objc2_core_media::{
    CMAudioFormatDescriptionCreate, CMAudioFormatDescriptionGetStreamBasicDescription, CMAudioSampleBufferCreateReadyWithPacketDescriptions, CMBlockBuffer,
    CMFormatDescription, CMSampleBuffer, CMTime, CMTimeFlags,
};

const LINEAR_PCM: u32 = 0x6C70_636D;
const IS_FLOAT: u32 = 1;
const IS_SIGNED_INTEGER: u32 = 1 << 2;
const IS_PACKED: u32 = 1 << 3;
const IS_NON_INTERLEAVED: u32 = 1 << 5;
const ASSURE_16_BYTE_ALIGNMENT: u32 = 1;
const OUT_RATE: f64 = 48_000.0;
const OUT_CHANNELS: u32 = 2;

pub(crate) struct Pcm {
    pub(crate) rate: f64,
    pub(crate) channels: usize,
    pub(crate) samples: Vec<f32>,
}

fn decode(buffer: &AudioBuffer, float: bool) -> Vec<f32> {
    if buffer.mData.is_null() {
        return Vec::new();
    }
    let bytes = unsafe { std::slice::from_raw_parts(buffer.mData.cast::<u8>(), buffer.mDataByteSize as usize) };
    if float {
        bytes.as_chunks::<4>().0.iter().map(|chunk| f32::from_ne_bytes(*chunk)).collect()
    } else {
        bytes.as_chunks::<2>().0.iter().map(|chunk| f32::from(i16::from_ne_bytes(*chunk)) / 32768.0).collect()
    }
}

pub(crate) fn pcm(buffer: &CMSampleBuffer) -> Option<Pcm> {
    let format = unsafe { buffer.format_description() }?;
    let description = unsafe { CMAudioFormatDescriptionGetStreamBasicDescription(&format).as_ref() }?;
    let flags = description.mFormatFlags;
    let float = flags & IS_FLOAT != 0;
    let supported = description.mFormatID == LINEAR_PCM
        && ((float && description.mBitsPerChannel == 32) || (flags & IS_SIGNED_INTEGER != 0 && description.mBitsPerChannel == 16));
    let channels = description.mChannelsPerFrame as usize;
    if !supported || channels == 0 || description.mSampleRate <= 0.0 {
        return None;
    }
    let (rate, interleaved) = (description.mSampleRate, flags & IS_NON_INTERLEAVED == 0);
    let mut needed = 0usize;
    unsafe { buffer.audio_buffer_list_with_retained_block_buffer(&mut needed, null_mut(), 0, None, None, ASSURE_16_BYTE_ALIGNMENT, null_mut()) };
    if needed < size_of::<AudioBufferList>() {
        return None;
    }
    let mut storage = vec![0u128; needed.div_ceil(size_of::<u128>())];
    let list = storage.as_mut_ptr().cast::<AudioBufferList>();
    let mut block: *mut CMBlockBuffer = null_mut();
    let status = unsafe { buffer.audio_buffer_list_with_retained_block_buffer(null_mut(), list, needed, None, None, ASSURE_16_BYTE_ALIGNMENT, &mut block) };
    let _block = NonNull::new(block).map(|block| unsafe { CFRetained::from_raw(block) });
    if status != 0 {
        return None;
    }
    let count = unsafe { (*list).mNumberBuffers } as usize;
    let buffers = unsafe { std::slice::from_raw_parts((&raw const (*list).mBuffers).cast::<AudioBuffer>(), count) };
    let samples = if interleaved {
        buffers.first().map(|buffer| decode(buffer, float)).unwrap_or_default()
    } else {
        let planes: Vec<Vec<f32>> = buffers.iter().take(channels).map(|buffer| decode(buffer, float)).collect();
        let frames = planes.iter().map(Vec::len).min().unwrap_or(0);
        (0..frames).flat_map(|frame| planes.iter().map(move |plane| plane[frame])).collect()
    };
    let channels = if interleaved { channels } else { buffers.len().min(channels) };
    (channels > 0 && !samples.is_empty()).then_some(Pcm { rate, channels, samples })
}

fn stereo_format() -> Option<CFRetained<CMFormatDescription>> {
    let description = AudioStreamBasicDescription {
        mSampleRate: OUT_RATE,
        mFormatID: LINEAR_PCM,
        mFormatFlags: IS_FLOAT | IS_PACKED,
        mBytesPerPacket: 4 * OUT_CHANNELS,
        mFramesPerPacket: 1,
        mBytesPerFrame: 4 * OUT_CHANNELS,
        mChannelsPerFrame: OUT_CHANNELS,
        mBitsPerChannel: 32,
        mReserved: 0,
    };
    let mut format: *const CMFormatDescription = null();
    let status = unsafe { CMAudioFormatDescriptionCreate(None, NonNull::from(&description), 0, null(), 0, null(), None, NonNull::from(&mut format)) };
    if status != 0 {
        return None;
    }
    NonNull::new(format.cast_mut()).map(|format| unsafe { CFRetained::from_raw(format) })
}

pub(crate) fn stereo_buffer(samples: &[f32], start_nanos: i64) -> Option<CFRetained<CMSampleBuffer>> {
    let frames = samples.len() / OUT_CHANNELS as usize;
    if frames == 0 {
        return None;
    }
    let length = frames * OUT_CHANNELS as usize * size_of::<f32>();
    let format = stereo_format()?;
    let mut block: *mut CMBlockBuffer = null_mut();
    let status = unsafe { CMBlockBuffer::create_with_memory_block(None, null_mut(), length, None, null(), 0, length, 0, NonNull::from(&mut block)) };
    let block = NonNull::new(block).map(|block| unsafe { CFRetained::from_raw(block) });
    let block = block.filter(|_| status == 0)?;
    let source = NonNull::new(samples.as_ptr().cast_mut().cast::<c_void>())?;
    if unsafe { CMBlockBuffer::replace_data_bytes(source, &block, 0, length) } != 0 {
        return None;
    }
    let time = CMTime { value: start_nanos, timescale: 1_000_000_000, flags: CMTimeFlags::Valid, epoch: 0 };
    let mut out: *mut CMSampleBuffer = null_mut();
    let status =
        unsafe { CMAudioSampleBufferCreateReadyWithPacketDescriptions(None, &block, &format, frames as isize, time, null(), NonNull::from(&mut out)) };
    let out = NonNull::new(out).map(|out| unsafe { CFRetained::from_raw(out) });
    out.filter(|_| status == 0)
}
