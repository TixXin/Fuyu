use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc::{self, Receiver, RecvTimeoutError, SyncSender, TrySendError},
        Arc,
    },
    thread::JoinHandle,
    time::Duration,
};

use crate::win32::{
    com::WinRtApartment,
    graphics_capture::{monitor_area, now, Gpu, GpuFrame, MonitorCapture},
    video_writer::{VideoFormat, VideoWriter},
};

use super::{
    audio::Audio,
    format,
    gif::GifOutput,
    pacing::{Pacer, Step, TICKS_PER_SECOND},
};

const QUEUE: usize = 6;
const AUDIO_TICK: i64 = TICKS_PER_SECOND / 100;

pub(crate) struct Options {
    pub(crate) x: i32,
    pub(crate) y: i32,
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) fps: u32,
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

enum Message {
    Frame(GpuFrame, i64),
    Pause(bool),
    Stop,
}

pub(crate) struct Recording {
    control: SyncSender<Message>,
    thread: JoinHandle<Result<Summary, String>>,
}

impl Recording {
    pub(crate) fn start(options: Options) -> Result<Self, String> {
        let (control, messages) = mpsc::sync_channel(QUEUE);
        let (ready, started) = mpsc::channel();
        let frames = control.clone();
        let thread = std::thread::Builder::new()
            .name("fuyu-recording".into())
            .spawn(move || run(options, frames, messages, ready))
            .map_err(|error| error.to_string())?;
        match started.recv() {
            Ok(Ok(())) => Ok(Self { control, thread }),
            Ok(Err(error)) => {
                let _ = thread.join();
                Err(error)
            }
            Err(_) => Err(thread.join().map_or_else(|_| "The recording thread stopped.".to_string(), |result| result.err().unwrap_or_default())),
        }
    }

    pub(crate) fn pause(&self, paused: bool) {
        let _ = self.control.send(Message::Pause(paused));
    }

    pub(crate) fn stop(self) -> Result<Summary, String> {
        let _ = self.control.send(Message::Stop);
        self.thread.join().map_err(|_| "The recording thread crashed.".to_string())?
    }
}

struct Pipeline {
    writer: VideoWriter,
    capture: MonitorCapture,
    audio: Audio,
    gif: Option<GifOutput>,
    summary: Summary,
    dropped: Arc<AtomicU64>,
}

fn open(options: &Options, frames: SyncSender<Message>) -> Result<Pipeline, String> {
    let gpu = Gpu::create().map_err(|error| format!("Could not open the graphics card: {error}"))?;
    let area = monitor_area(options.x, options.y, options.width, options.height).ok_or_else(|| "The area is not on a screen.".to_string())?;
    if area.width < 2 || area.height < 2 {
        return Err("The area is too small to record.".to_string());
    }
    let area = area.with_size(format::even(area.width), format::even(area.height));
    let input = (area.width, area.height);
    let output = format::fit(area.width, area.height);
    let video = VideoFormat { input, output, fps: options.fps, bitrate: format::bitrate(output.0, output.1, options.fps) };
    let audio = Audio::start(options.system_audio, options.microphone);
    let with_audio = audio.is_on();
    let (writer, hardware) = match VideoWriter::create(&gpu, &options.path, &video, true, with_audio) {
        Ok(writer) => (writer, true),
        Err(_) => (VideoWriter::create(&gpu, &options.path, &video, false, with_audio).map_err(|error| format!("Could not start the video encoder: {error}"))?, false),
    };
    let gif = options.gif.clone().map(|path| GifOutput::start(&gpu, path)).transpose()?;
    let dropped = Arc::new(AtomicU64::new(0));
    let counter = Arc::clone(&dropped);
    let interval = TICKS_PER_SECOND / i64::from(options.fps);
    let capture = MonitorCapture::start(&gpu, area, format::capture_buffers(options.fps), interval, move |frame, time| {
        if let Err(TrySendError::Full(_)) = frames.try_send(Message::Frame(frame, time)) {
            counter.fetch_add(1, Ordering::Relaxed);
        }
    })
    .map_err(|error| format!("Could not capture the screen: {error}"))?;
    let summary = Summary {
        path: options.gif.as_ref().unwrap_or(&options.path).display().to_string(),
        width: output.0,
        height: output.1,
        seconds: 0.0,
        frames: 0,
        repeats: 0,
        dropped: 0,
        hardware,
        system_audio: audio.system,
        microphone: audio.microphone,
    };
    Ok(Pipeline { writer, capture, audio, gif, summary, dropped })
}

fn run(options: Options, frames: SyncSender<Message>, messages: Receiver<Message>, ready: mpsc::Sender<Result<(), String>>) -> Result<Summary, String> {
    let _apartment = WinRtApartment::multithreaded().map_err(|error| error.to_string())?;
    let Pipeline { writer, capture, mut audio, mut gif, mut summary, dropped } = match open(&options, frames) {
        Ok(pipeline) => pipeline,
        Err(error) => {
            let _ = std::fs::remove_file(&options.path);
            if let Some(path) = &options.gif {
                let _ = std::fs::remove_file(path);
            }
            let _ = ready.send(Err(error.clone()));
            return Err(error);
        }
    };
    let _ = ready.send(Ok(()));
    let mut pacer: Pacer<GpuFrame> = Pacer::new(options.fps);
    let interval = pacer.interval();
    let tick = audio.is_on().then_some(AUDIO_TICK);
    let result = loop {
        if let Err(error) = audio.pump(&pacer, &writer, now()) {
            break Err(format!("Could not encode the sound: {error}"));
        }
        match pacer.next(now()) {
            Step::Write(frame, stamp) => {
                if let Err(error) = writer.write(&frame, stamp, interval) {
                    break Err(format!("Could not encode the video: {error}"));
                }
                if let Some(gif) = &mut gif {
                    gif.offer(&frame, stamp);
                }
                summary.frames += 1;
            }
            Step::Repeat(frame, stamp) => {
                if let Err(error) = writer.write(&frame, stamp, interval) {
                    break Err(format!("Could not encode the video: {error}"));
                }
                if let Some(gif) = &mut gif {
                    gif.offer(&frame, stamp);
                }
                summary.repeats += 1;
            }
            Step::Wait(wait) => {
                let wait = match (wait, tick) {
                    (Some(wait), Some(tick)) => Some(wait.min(tick)),
                    (wait, tick) => wait.or(tick),
                };
                let message = match wait {
                    Some(ticks) => messages.recv_timeout(Duration::from_micros((ticks.max(1) / 10) as u64)),
                    None => messages.recv().map_err(|_| RecvTimeoutError::Disconnected),
                };
                match message {
                    Ok(Message::Frame(frame, time)) => pacer.push(frame, time),
                    Ok(Message::Pause(true)) => pacer.pause(now()),
                    Ok(Message::Pause(false)) => pacer.resume(now()),
                    Ok(Message::Stop) | Err(RecvTimeoutError::Disconnected) => break Ok(()),
                    Err(RecvTimeoutError::Timeout) => {}
                }
            }
        }
    };
    drop(capture);
    let result = result.and_then(|()| match pacer.finish() {
        Some((frame, stamp)) => {
            summary.frames += 1;
            if let Some(gif) = &mut gif {
                gif.offer(&frame, stamp);
            }
            writer.write(&frame, stamp, interval).map_err(|error| format!("Could not encode the video: {error}"))
        }
        None => Ok(()),
    });
    let result = result.and_then(|()| audio.finish(&pacer, &writer).map_err(|error| format!("Could not encode the sound: {error}")));
    drop(audio);
    let finished = writer.finish().map_err(|error| format!("Could not finish the video file: {error}"));
    let result = result.and(finished);
    if let Some(gif) = gif {
        summary.dropped += gif.dropped;
        let encoded = gif.finish();
        let _ = std::fs::remove_file(&options.path);
        let gif_path = options.gif.as_ref().unwrap_or(&options.path);
        if let Err(error) = result.and(encoded) {
            let _ = std::fs::remove_file(gif_path);
            return Err(error);
        }
    } else {
        result?;
    }
    summary.seconds = pacer.duration() as f64 / TICKS_PER_SECOND as f64;
    summary.dropped += dropped.load(Ordering::Relaxed);
    Ok(summary)
}
