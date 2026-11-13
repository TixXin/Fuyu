use std::path::Path;

use windows::{
    core::{Interface, Result, GUID, HSTRING},
    Win32::{
        Foundation::E_FAIL,
        Graphics::Direct3D11::ID3D11Texture2D,
        Media::MediaFoundation::{
            eAVEncCommonRateControlMode_UnconstrainedVBR, eAVEncH264VProfile_High, IMF2DBuffer, IMFAttributes,
            IMFDXGIDeviceManager, IMFMediaType, IMFSinkWriter, MFCreateAttributes, MFCreateDXGIDeviceManager,
            MFCreateDXGISurfaceBuffer, MFCreateMediaType, MFCreateMemoryBuffer, MFCreateSample, MFCreateSinkWriterFromURL, MFMediaType_Audio, MFMediaType_Video, MFAudioFormat_AAC, MFAudioFormat_PCM, MF_MT_AUDIO_AVG_BYTES_PER_SECOND, MF_MT_AUDIO_BITS_PER_SAMPLE, MF_MT_AUDIO_BLOCK_ALIGNMENT, MF_MT_AUDIO_NUM_CHANNELS, MF_MT_AUDIO_SAMPLES_PER_SECOND,
            MFShutdown, MFStartup, MFTranscodeContainerType_MPEG4, MFVideoFormat_H264, MFVideoFormat_RGB32,
            MFVideoInterlace_Progressive, CODECAPI_AVEncCommonRateControlMode, CODECAPI_AVEncMPVGOPSize,
            MFSTARTUP_FULL, MF_MT_AVG_BITRATE, MF_MT_DEFAULT_STRIDE, MF_MT_FRAME_RATE, MF_MT_FRAME_SIZE,
            MF_MT_INTERLACE_MODE, MF_MT_MAJOR_TYPE, MF_MT_MPEG2_PROFILE, MF_MT_PIXEL_ASPECT_RATIO, MF_MT_SUBTYPE,
            MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, MF_SINK_WRITER_D3D_MANAGER, MF_TRANSCODE_CONTAINERTYPE, MF_VERSION,
        },
    },
};

use super::{
    audio_capture::{CHANNELS, SAMPLE_RATE},
    graphics_capture::{Gpu, GpuFrame},
};

const AAC_BYTES_PER_SECOND: u32 = 24_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct VideoFormat {
    pub(crate) input: (u32, u32),
    pub(crate) output: (u32, u32),
    pub(crate) fps: u32,
    pub(crate) bitrate: u32,
}

struct MediaFoundation;

impl MediaFoundation {
    fn start() -> Result<Self> {
        unsafe { MFStartup(MF_VERSION, MFSTARTUP_FULL) }?;
        Ok(Self)
    }
}

impl Drop for MediaFoundation {
    fn drop(&mut self) {
        let _ = unsafe { MFShutdown() };
    }
}

pub(crate) struct VideoWriter {
    writer: IMFSinkWriter,
    stream: u32,
    audio: Option<u32>,
    _manager: IMFDXGIDeviceManager,
    _media: MediaFoundation,
}

unsafe impl Send for VideoWriter {}

fn pair(high: u32, low: u32) -> u64 {
    (u64::from(high) << 32) | u64::from(low)
}

fn attributes(count: u32) -> Result<IMFAttributes> {
    let mut made = None;
    unsafe { MFCreateAttributes(&mut made, count) }?;
    made.ok_or_else(|| E_FAIL.into())
}

fn audio_type(subtype: &GUID, bytes_per_second: u32) -> Result<IMFMediaType> {
    let made = unsafe { MFCreateMediaType() }?;
    unsafe {
        made.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Audio)?;
        made.SetGUID(&MF_MT_SUBTYPE, subtype)?;
        made.SetUINT32(&MF_MT_AUDIO_SAMPLES_PER_SECOND, SAMPLE_RATE)?;
        made.SetUINT32(&MF_MT_AUDIO_NUM_CHANNELS, u32::from(CHANNELS))?;
        made.SetUINT32(&MF_MT_AUDIO_BITS_PER_SAMPLE, 16)?;
        made.SetUINT32(&MF_MT_AUDIO_AVG_BYTES_PER_SECOND, bytes_per_second)?;
    }
    Ok(made)
}

fn video_type(subtype: &GUID, (width, height): (u32, u32), fps: u32) -> Result<IMFMediaType> {
    let made = unsafe { MFCreateMediaType() }?;
    unsafe {
        made.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
        made.SetGUID(&MF_MT_SUBTYPE, subtype)?;
        made.SetUINT32(&MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive.0 as u32)?;
        made.SetUINT64(&MF_MT_FRAME_SIZE, pair(width, height))?;
        made.SetUINT64(&MF_MT_FRAME_RATE, pair(fps, 1))?;
        made.SetUINT64(&MF_MT_PIXEL_ASPECT_RATIO, pair(1, 1))?;
    }
    Ok(made)
}

impl VideoWriter {
    pub(crate) fn create(gpu: &Gpu, path: &Path, format: &VideoFormat, hardware: bool, with_audio: bool) -> Result<Self> {
        let media = MediaFoundation::start()?;
        let mut token = 0;
        let mut manager = None;
        unsafe { MFCreateDXGIDeviceManager(&mut token, &mut manager) }?;
        let manager: IMFDXGIDeviceManager = manager.ok_or_else(|| windows::core::Error::from(E_FAIL))?;
        unsafe { manager.ResetDevice(gpu.device(), token) }?;

        let settings = attributes(3)?;
        unsafe {
            settings.SetUINT32(&MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, u32::from(hardware))?;
            settings.SetUnknown(&MF_SINK_WRITER_D3D_MANAGER, &manager)?;
            settings.SetGUID(&MF_TRANSCODE_CONTAINERTYPE, &MFTranscodeContainerType_MPEG4)?;
        }
        let writer = unsafe { MFCreateSinkWriterFromURL(&HSTRING::from(path.as_os_str()), None, &settings) }?;

        let output = video_type(&MFVideoFormat_H264, format.output, format.fps)?;
        unsafe {
            output.SetUINT32(&MF_MT_AVG_BITRATE, format.bitrate)?;
            output.SetUINT32(&MF_MT_MPEG2_PROFILE, eAVEncH264VProfile_High.0 as u32)?;
        }
        let stream = unsafe { writer.AddStream(&output) }?;

        let input = video_type(&MFVideoFormat_RGB32, format.input, format.fps)?;
        unsafe { input.SetUINT32(&MF_MT_DEFAULT_STRIDE, format.input.0 * 4) }?;
        let encoding = attributes(2)?;
        unsafe {
            encoding.SetUINT32(&CODECAPI_AVEncCommonRateControlMode, eAVEncCommonRateControlMode_UnconstrainedVBR.0 as u32)?;
            encoding.SetUINT32(&CODECAPI_AVEncMPVGOPSize, format.fps * 2)?;
            writer.SetInputMediaType(stream, &input, &encoding)?;
        }
        let audio = if with_audio {
            let output = audio_type(&MFAudioFormat_AAC, AAC_BYTES_PER_SECOND)?;
            let audio = unsafe { writer.AddStream(&output) }?;
            let block = u32::from(CHANNELS) * 2;
            let input = audio_type(&MFAudioFormat_PCM, SAMPLE_RATE * block)?;
            unsafe {
                input.SetUINT32(&MF_MT_AUDIO_BLOCK_ALIGNMENT, block)?;
                writer.SetInputMediaType(audio, &input, None)?;
            }
            Some(audio)
        } else {
            None
        };
        unsafe { writer.BeginWriting() }?;
        Ok(Self { writer, stream, audio, _manager: manager, _media: media })
    }

    pub(crate) fn write(&self, frame: &GpuFrame, time: i64, duration: i64) -> Result<()> {
        let buffer = unsafe { MFCreateDXGISurfaceBuffer(&ID3D11Texture2D::IID, frame.texture(), 0, false) }?;
        let length = unsafe { buffer.cast::<IMF2DBuffer>()?.GetContiguousLength() }?;
        let sample = unsafe { MFCreateSample() }?;
        unsafe {
            buffer.SetCurrentLength(length)?;
            sample.AddBuffer(&buffer)?;
            sample.SetSampleTime(time)?;
            sample.SetSampleDuration(duration)?;
            self.writer.WriteSample(self.stream, &sample)
        }
    }

    pub(crate) fn write_audio(&self, samples: &[f32], time: i64, duration: i64) -> Result<()> {
        let Some(stream) = self.audio else {
            return Ok(());
        };
        let bytes: Vec<u8> = samples.iter().flat_map(|sample| ((sample * f32::from(i16::MAX)) as i16).to_le_bytes()).collect();
        let length = u32::try_from(bytes.len()).map_err(|_| windows::core::Error::from(E_FAIL))?;
        let buffer = unsafe { MFCreateMemoryBuffer(length) }?;
        let mut data = std::ptr::null_mut();
        unsafe {
            buffer.Lock(&mut data, None, None)?;
            std::ptr::copy_nonoverlapping(bytes.as_ptr(), data, bytes.len());
            buffer.Unlock()?;
            buffer.SetCurrentLength(length)?;
        }
        let sample = unsafe { MFCreateSample() }?;
        unsafe {
            sample.AddBuffer(&buffer)?;
            sample.SetSampleTime(time)?;
            sample.SetSampleDuration(duration)?;
            self.writer.WriteSample(stream, &sample)
        }
    }

    pub(crate) fn finish(self) -> Result<()> {
        unsafe { self.writer.Finalize() }
    }
}
