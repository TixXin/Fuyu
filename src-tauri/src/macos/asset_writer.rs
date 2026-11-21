use std::{path::Path, ptr::NonNull, sync::mpsc, time::Duration};

use block2::RcBlock;
use objc2::{rc::Retained, runtime::AnyObject, AllocAnyThread};
use objc2_av_foundation::{
    AVAssetWriter, AVAssetWriterInput, AVAssetWriterStatus, AVFileTypeMPEG4, AVMediaTypeAudio, AVMediaTypeVideo, AVVideoAverageBitRateKey,
    AVVideoCodecKey, AVVideoCodecTypeH264, AVVideoCompressionPropertiesKey, AVVideoExpectedSourceFrameRateKey, AVVideoHeightKey,
    AVVideoMaxKeyFrameIntervalKey, AVVideoProfileLevelH264HighAutoLevel, AVVideoProfileLevelKey, AVVideoWidthKey,
};
use objc2_avf_audio::{AVEncoderBitRateKey, AVFormatIDKey, AVNumberOfChannelsKey, AVSampleRateKey};
use objc2_core_foundation::CFRetained;
use objc2_core_media::{CMSampleBuffer, CMSampleTimingInfo, CMTime, CMTimeFlags};
use objc2_foundation::{NSCopying, NSDictionary, NSNumber, NSString, NSURL};

use super::screen_stream::Sample;

const FINISH_WAIT: Duration = Duration::from_secs(20);
const AAC: u32 = 0x6161_6320;
const AUDIO_RATE: f64 = 48_000.0;
const AUDIO_CHANNELS: i32 = 2;
const AUDIO_BITRATE: i32 = 160_000;
const MAX_TIMING_ENTRIES: usize = 64;

pub(crate) struct Video {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) fps: u32,
    pub(crate) bitrate: u32,
}

pub(crate) struct AssetWriter {
    writer: Retained<AVAssetWriter>,
    video: Retained<AVAssetWriterInput>,
    audio: Option<Retained<AVAssetWriterInput>>,
    started: bool,
    frame_nanos: i64,
    last: Option<CFRetained<CMSampleBuffer>>,
}

unsafe impl Send for AssetWriter {}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Appended {
    Written,
    Busy,
    Failed,
}

fn key(value: Option<&'static NSString>) -> Result<&'static NSString, String> {
    value.ok_or_else(|| "AVFoundation is missing a settings key.".to_string())
}

fn settings(pairs: &[(&NSString, Retained<AnyObject>)]) -> Retained<NSDictionary<NSString, AnyObject>> {
    let keys: Vec<&NSString> = pairs.iter().map(|(key, _)| *key).collect();
    let values: Vec<Retained<AnyObject>> = pairs.iter().map(|(_, value)| value.clone()).collect();
    NSDictionary::from_retained_objects(&keys, &values)
}

fn object<T: objc2::Message>(value: Retained<T>) -> Retained<AnyObject> {
    unsafe { Retained::cast_unchecked(value) }
}

fn number(value: i64) -> Retained<AnyObject> {
    object(NSNumber::new_i64(value))
}

fn text(value: &NSString) -> Retained<AnyObject> {
    object(value.copy())
}

fn video_settings(video: &Video) -> Result<Retained<NSDictionary<NSString, AnyObject>>, String> {
    unsafe {
        let compression = settings(&[
            (key(AVVideoAverageBitRateKey)?, number(i64::from(video.bitrate))),
            (key(AVVideoExpectedSourceFrameRateKey)?, number(i64::from(video.fps))),
            (key(AVVideoMaxKeyFrameIntervalKey)?, number(i64::from(video.fps) * 2)),
            (key(AVVideoProfileLevelKey)?, text(key(AVVideoProfileLevelH264HighAutoLevel)?)),
        ]);
        Ok(settings(&[
            (key(AVVideoCodecKey)?, text(key(AVVideoCodecTypeH264)?)),
            (key(AVVideoWidthKey)?, number(i64::from(video.width))),
            (key(AVVideoHeightKey)?, number(i64::from(video.height))),
            (key(AVVideoCompressionPropertiesKey)?, object(compression)),
        ]))
    }
}

fn audio_settings() -> Result<Retained<NSDictionary<NSString, AnyObject>>, String> {
    unsafe {
        Ok(settings(&[
            (key(AVFormatIDKey)?, number(i64::from(AAC))),
            (key(AVSampleRateKey)?, object(NSNumber::new_f64(AUDIO_RATE))),
            (key(AVNumberOfChannelsKey)?, number(i64::from(AUDIO_CHANNELS))),
            (key(AVEncoderBitRateKey)?, number(i64::from(AUDIO_BITRATE))),
        ]))
    }
}

fn shifted(time: CMTime, shift: CMTime) -> CMTime {
    if time.flags.contains(CMTimeFlags::Valid) {
        unsafe { time.subtract(shift) }
    } else {
        time
    }
}

fn retimed(buffer: &CMSampleBuffer, shift_nanos: i64) -> Option<CFRetained<CMSampleBuffer>> {
    let shift = CMTime { value: shift_nanos, timescale: 1_000_000_000, flags: CMTimeFlags::Valid, epoch: 0 };
    let mut timing = [CMSampleTimingInfo { duration: shift, presentationTimeStamp: shift, decodeTimeStamp: shift }; MAX_TIMING_ENTRIES];
    let mut count = 0;
    let status = unsafe { buffer.sample_timing_info_array(MAX_TIMING_ENTRIES as isize, timing.as_mut_ptr(), &mut count) };
    if status != 0 || count <= 0 {
        return None;
    }
    let entries = &mut timing[..count as usize];
    for entry in entries.iter_mut() {
        entry.presentationTimeStamp = shifted(entry.presentationTimeStamp, shift);
        entry.decodeTimeStamp = shifted(entry.decodeTimeStamp, shift);
    }
    let mut out: *mut CMSampleBuffer = std::ptr::null_mut();
    let status = unsafe { CMSampleBuffer::create_copy_with_new_timing(None, buffer, count, entries.as_ptr(), NonNull::from(&mut out)) };
    if status != 0 {
        return None;
    }
    NonNull::new(out).map(|out| unsafe { CFRetained::from_raw(out) })
}

impl AssetWriter {
    pub(crate) fn create(path: &Path, video: &Video, with_audio: bool) -> Result<Self, String> {
        let _ = std::fs::remove_file(path);
        let url = NSURL::from_file_path(path).ok_or("The video path is not valid.")?;
        let file_type = unsafe { AVFileTypeMPEG4 }.ok_or("MP4 is not available.")?;
        let writer = unsafe { AVAssetWriter::initWithURL_fileType_error(AVAssetWriter::alloc(), &url, file_type) }
            .map_err(|error| error.localizedDescription().to_string())?;
        let video_type = unsafe { AVMediaTypeVideo }.ok_or("Video is not available.")?;
        let video_input = unsafe { AVAssetWriterInput::initWithMediaType_outputSettings(AVAssetWriterInput::alloc(), video_type, Some(&*video_settings(video)?)) };
        unsafe { video_input.setExpectsMediaDataInRealTime(true) };
        if !unsafe { writer.canAddInput(&video_input) } {
            return Err("The video encoder does not accept this size.".to_string());
        }
        unsafe { writer.addInput(&video_input) };
        let audio = if with_audio {
            let audio_type = unsafe { AVMediaTypeAudio }.ok_or("Audio is not available.")?;
            let input = unsafe { AVAssetWriterInput::initWithMediaType_outputSettings(AVAssetWriterInput::alloc(), audio_type, Some(&*audio_settings()?)) };
            unsafe { input.setExpectsMediaDataInRealTime(true) };
            unsafe { writer.canAddInput(&input) }.then(|| {
                unsafe { writer.addInput(&input) };
                input
            })
        } else {
            None
        };
        if !unsafe { writer.startWriting() } {
            return Err(unsafe { writer.error() }.map_or_else(|| "The video file could not be started.".to_string(), |error| error.localizedDescription().to_string()));
        }
        let frame_nanos = 1_000_000_000 / i64::from(video.fps.max(1));
        Ok(Self { writer, video: video_input, audio, started: false, frame_nanos, last: None })
    }

    pub(crate) fn has_audio(&self) -> bool {
        self.audio.is_some()
    }

    pub(crate) fn append_video(&mut self, buffer: &CMSampleBuffer, shift_nanos: i64) -> Appended {
        let Some(buffer) = retimed(buffer, shift_nanos) else {
            return Appended::Failed;
        };
        if !self.started {
            unsafe { self.writer.startSessionAtSourceTime(buffer.presentation_time_stamp()) };
            self.started = true;
        }
        let appended = append(&self.video, &buffer);
        if appended == Appended::Written {
            self.last = Some(buffer);
        }
        appended
    }

    pub(crate) fn hold_last_frame_until(&mut self, end_nanos: i64) -> bool {
        let Some(last) = self.last.as_ref() else {
            return false;
        };
        let Some(stamp) = last.presentation_nanos() else {
            return false;
        };
        let at = end_nanos - self.frame_nanos;
        if at <= stamp {
            return false;
        }
        let Some(repeat) = retimed(last, stamp - at) else {
            return false;
        };
        append(&self.video, &repeat) == Appended::Written
    }

    pub(crate) fn append_stereo(&mut self, samples: &[f32], start_nanos: i64) -> Appended {
        let (Some(input), true) = (&self.audio, self.started) else {
            return Appended::Busy;
        };
        super::audio_samples::stereo_buffer(samples, start_nanos).map_or(Appended::Failed, |buffer| append(input, &buffer))
    }

    pub(crate) fn finish(self, end_nanos: Option<i64>) -> Result<(), String> {
        if !self.started {
            unsafe { self.writer.cancelWriting() };
            return Err("No frame was recorded.".to_string());
        }
        if let Some(end) = end_nanos {
            unsafe { self.writer.endSessionAtSourceTime(CMTime { value: end, timescale: 1_000_000_000, flags: CMTimeFlags::Valid, epoch: 0 }) };
        }
        unsafe { self.video.markAsFinished() };
        if let Some(audio) = &self.audio {
            unsafe { audio.markAsFinished() };
        }
        let (sender, receiver) = mpsc::channel();
        let done = RcBlock::new(move || {
            let _ = sender.send(());
        });
        unsafe { self.writer.finishWritingWithCompletionHandler(&done) };
        receiver.recv_timeout(FINISH_WAIT).map_err(|_| "Finishing the video took too long.".to_string())?;
        if unsafe { self.writer.status() } == AVAssetWriterStatus::Completed {
            Ok(())
        } else {
            Err(unsafe { self.writer.error() }.map_or_else(|| "The video file could not be finished.".to_string(), |error| error.localizedDescription().to_string()))
        }
    }
}

fn append(input: &AVAssetWriterInput, buffer: &CMSampleBuffer) -> Appended {
    if !unsafe { input.isReadyForMoreMediaData() } {
        return Appended::Busy;
    }
    if unsafe { input.appendSampleBuffer(buffer) } {
        Appended::Written
    } else {
        Appended::Failed
    }
}
