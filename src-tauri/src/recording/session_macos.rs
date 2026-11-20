use std::{
    path::PathBuf,
    sync::{Arc, Mutex, MutexGuard, PoisonError},
};

use crate::macos::{
    asset_writer::{Appended, AssetWriter, Video},
    audio_samples,
    pixel_frames::{self, Pixels},
    screen_stream::{self, Output, Sample, SampleBuffer, ScreenStream, Spec},
};

use super::{
    format,
    gif::{GifOutput, Rgba, GIF_FPS, GIF_MAX_WIDTH},
    mixer::{Mixer, RATE},
    stereo::to_stereo,
    timeline::Timeline,
};

const NANOS: i64 = 1_000_000_000;
const SYSTEM_TRACK: usize = 0;
const MICROPHONE_TRACK: usize = 1;

pub(crate) struct Options {
    pub(crate) x: i32,
    pub(crate) y: i32,
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) fps: u32,
    pub(crate) high_quality: bool,
    pub(crate) system_audio: bool,
    pub(crate) microphone: bool,
    pub(crate) path: PathBuf,
    pub(crate) gif: Option<PathBuf>,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Summary {
    pub(crate) path: String,
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) seconds: f64,
    pub(crate) frames: u64,
    pub(crate) repeats: u64,
    pub(crate) dropped: u64,
    pub(crate) hardware: bool,
    pub(crate) system_audio: bool,
    pub(crate) microphone: bool,
}

struct Progress {
    writer: Option<AssetWriter>,
    timeline: Timeline,
    mixer: Mixer,
    gif: Option<GifOutput<Pixels>>,
    gif_last: Option<Pixels>,
    frames: u64,
    dropped: u64,
    failed: Option<String>,
}

fn progress(shared: &Mutex<Progress>) -> MutexGuard<'_, Progress> {
    shared.lock().unwrap_or_else(PoisonError::into_inner)
}

fn frames_at(nanos: i64) -> i64 {
    (i128::from(nanos) * i128::from(RATE) / i128::from(NANOS)) as i64
}

fn nanos_at(frames: i64) -> i64 {
    (i128::from(frames) * i128::from(NANOS) / i128::from(RATE)) as i64
}

impl Progress {
    fn write_audio(&mut self, until: i64) {
        let (Some(start), Some(writer)) = (self.timeline.start(), self.writer.as_mut()) else {
            return;
        };
        let from = self.mixer.written();
        let samples = self.mixer.take(until);
        if !samples.is_empty() {
            let _ = writer.append_stereo(&samples, start + nanos_at(from));
        }
    }

    fn video(&mut self, buffer: &SampleBuffer, stamp: i64) {
        if !buffer.is_complete_frame() {
            return;
        }
        let Some(shift) = self.timeline.video(stamp) else {
            return;
        };
        if let Some(gif) = self.gif.as_mut() {
            let last = &mut self.gif_last;
            gif.offer(stamp - shift, || {
                let pixels = pixel_frames::rgba(buffer, GIF_MAX_WIDTH as usize)?;
                *last = Some(pixels.clone());
                Some(pixels)
            });
        }
        let Some(writer) = self.writer.as_mut() else {
            return;
        };
        match writer.append_video(buffer, shift) {
            Appended::Written => self.frames += 1,
            Appended::Busy => self.dropped += 1,
            Appended::Failed => {
                self.failed.get_or_insert_with(|| "The video encoder stopped taking frames.".to_string());
            }
        }
    }

    fn audio(&mut self, buffer: &SampleBuffer, stamp: i64, track: usize) {
        let (Some(shift), Some(start)) = (self.timeline.audio(stamp), self.timeline.start()) else {
            return;
        };
        let Some(pcm) = audio_samples::pcm(buffer) else {
            return;
        };
        let clock = frames_at(stamp - shift - start);
        self.mixer.push(track, clock, &to_stereo(&pcm.samples, pcm.channels, pcm.rate));
        if let Some(until) = self.mixer.ready(clock) {
            self.write_audio(until);
        }
    }
}

fn take(shared: &Mutex<Progress>, buffer: &SampleBuffer, output: Output) {
    let Some(stamp) = buffer.presentation_nanos() else {
        return;
    };
    let mut progress = progress(shared);
    match output {
        Output::Screen => progress.video(buffer, stamp),
        Output::Audio => progress.audio(buffer, stamp, SYSTEM_TRACK),
        Output::Microphone => progress.audio(buffer, stamp, MICROPHONE_TRACK),
    }
}

pub(crate) struct Recording {
    stream: ScreenStream,
    shared: Arc<Mutex<Progress>>,
    summary: Summary,
    video_path: PathBuf,
    gif_path: Option<PathBuf>,
}

fn start_gif(path: PathBuf) -> Result<GifOutput<Pixels>, String> {
    GifOutput::start(path, NANOS, |pixels: Pixels| Ok(Rgba { width: pixels.width, height: pixels.height, pixels: pixels.rgba }))
}

fn remove_outputs(video: &PathBuf, gif: Option<&PathBuf>) {
    let _ = std::fs::remove_file(video);
    if let Some(gif) = gif {
        let _ = std::fs::remove_file(gif);
    }
}

fn capture(spec: &Spec, shared: &Arc<Mutex<Progress>>) -> Result<ScreenStream, String> {
    let feed = Arc::clone(shared);
    ScreenStream::start(spec, move |buffer, output| take(&feed, buffer, output))
}

impl Recording {
    pub(crate) fn start(options: Options) -> Result<Self, String> {
        if options.width < 2 || options.height < 2 {
            return Err("The area is too small to record.".to_string());
        }
        let area = screen_stream::area_at(f64::from(options.x), f64::from(options.y), options.width, options.height)
            .ok_or_else(|| "The area is not on a screen. Check the Screen Recording permission.".to_string())?;
        let output = format::fit(options.width, options.height);
        let video = Video { width: output.0, height: output.1, fps: options.fps, bitrate: format::bitrate(output.0, output.1, options.fps, options.high_quality) };
        let writer = AssetWriter::create(&options.path, &video, options.system_audio || options.microphone)?;
        let with_audio = writer.has_audio();
        let gif = match options.gif.clone().map(start_gif).transpose() {
            Ok(gif) => gif,
            Err(error) => {
                let _ = writer.finish(None);
                remove_outputs(&options.path, options.gif.as_ref());
                return Err(error);
            }
        };
        let shared = Arc::new(Mutex::new(Progress {
            writer: Some(writer),
            timeline: Timeline::default(),
            mixer: Mixer::new(2),
            gif,
            gif_last: None,
            frames: 0,
            dropped: 0,
            failed: None,
        }));
        let mut spec = Spec {
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height,
            output,
            fps: options.fps,
            system_audio: with_audio && options.system_audio,
            microphone: with_audio && options.microphone,
            own_windows: super::control::records_own_windows(),
        };
        let stream = capture(&spec, &shared).or_else(|error| {
            if !spec.microphone {
                return Err(error);
            }
            spec.microphone = false;
            capture(&spec, &shared)
        });
        let stream = stream.map_err(|error| {
            let (writer, gif) = {
                let mut progress = progress(&shared);
                (progress.writer.take(), progress.gif.take())
            };
            if let Some(writer) = writer {
                let _ = writer.finish(None);
            }
            if let Some(gif) = gif {
                let _ = gif.finish();
            }
            remove_outputs(&options.path, options.gif.as_ref());
            format!("Could not capture the screen: {error}")
        })?;
        let summary = Summary {
            path: options.gif.as_ref().unwrap_or(&options.path).display().to_string(),
            width: output.0,
            height: output.1,
            seconds: 0.0,
            frames: 0,
            repeats: 0,
            dropped: 0,
            hardware: true,
            system_audio: spec.system_audio,
            microphone: spec.microphone,
        };
        Ok(Self { stream, shared, summary, video_path: options.path, gif_path: options.gif })
    }

    pub(crate) fn pause(&self, paused: bool) {
        let now = screen_stream::host_now();
        let mut progress = progress(&self.shared);
        if paused {
            progress.timeline.pause(now);
        } else {
            progress.timeline.resume(now);
        }
    }

    pub(crate) fn stop(self) -> Result<Summary, String> {
        let now = screen_stream::host_now();
        self.stream.stop();
        let mut progress = progress(&self.shared);
        let duration = progress.timeline.duration(now);
        let end = progress.timeline.start().map(|start| start + duration);
        progress.write_audio(frames_at(duration));
        let mut writer = progress.writer.take().ok_or_else(|| "The recording was already finished.".to_string())?;
        let repeats = end.is_some_and(|end| writer.hold_last_frame_until(end));
        let (frames, mut dropped, failed, gif) = (progress.frames, progress.dropped, progress.failed.take(), progress.gif.take());
        let gif_last = progress.gif_last.take();
        drop(progress);
        let finished = writer.finish(end);
        let result = failed.map_or(finished, Err);
        if let Some(mut gif) = gif {
            if let (Some(end), Some(last)) = (end, gif_last) {
                let step = NANOS / GIF_FPS;
                gif.offer(end - 2 * step, || Some(last.clone()));
                gif.offer(end - step, || Some(last));
            }
            dropped += gif.dropped;
            let encoded = gif.finish();
            let _ = std::fs::remove_file(&self.video_path);
            if let Err(error) = result.and(encoded) {
                remove_outputs(&self.video_path, self.gif_path.as_ref());
                return Err(error);
            }
        } else {
            result?;
        }
        Ok(Summary { seconds: duration as f64 / NANOS as f64, frames, repeats: u64::from(repeats), dropped, ..self.summary })
    }
}
