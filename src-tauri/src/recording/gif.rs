use std::{
    fs::File,
    io::BufWriter,
    path::PathBuf,
    sync::mpsc::{self, SyncSender, TrySendError},
    thread::JoinHandle,
};

use gifski::{progress::NoProgress, Repeat, Settings};
use imgref::ImgVec;
use rgb::RGBA8;

use crate::win32::graphics_capture::{Gpu, GpuFrame};

use super::pacing::TICKS_PER_SECOND;

pub(crate) const GIF_FPS: i64 = 15;
pub(crate) const GIF_MAX_WIDTH: u32 = 960;
const GIF_QUALITY: u8 = 90;
const QUEUE: usize = 8;

pub(crate) struct GifRate {
    interval: i64,
    next: Option<i64>,
}

impl GifRate {
    pub(crate) fn new() -> Self {
        Self { interval: TICKS_PER_SECOND / GIF_FPS, next: None }
    }

    pub(crate) fn take(&mut self, stamp: i64) -> bool {
        if self.next.is_some_and(|next| stamp < next) {
            return false;
        }
        let slot = stamp - stamp.rem_euclid(self.interval);
        self.next = Some(slot + self.interval);
        true
    }
}

pub(crate) struct GifOutput {
    frames: Option<SyncSender<(GpuFrame, i64)>>,
    thread: Option<JoinHandle<Result<(), String>>>,
    rate: GifRate,
    pub(crate) dropped: u64,
}

fn encode(gpu: Gpu, path: PathBuf, frames: mpsc::Receiver<(GpuFrame, i64)>) -> Result<(), String> {
    let settings = Settings { width: Some(GIF_MAX_WIDTH), height: None, quality: GIF_QUALITY, fast: false, repeat: Repeat::Infinite };
    let (collector, writer) = gifski::new(settings).map_err(|error| error.to_string())?;
    let file = File::create(&path).map_err(|error| format!("Failed to create {}: {error}", path.display()))?;
    let written = std::thread::Builder::new()
        .name("fuyu-recording-gif-write".into())
        .spawn(move || writer.write(BufWriter::new(file), &mut NoProgress {}).map_err(|error| error.to_string()))
        .map_err(|error| error.to_string())?;
    let mut first = None;
    let mut last = -1.0;
    let mut index = 0;
    let mut added = Ok(());
    for (frame, stamp) in frames {
        let start = *first.get_or_insert(stamp);
        let seconds = (stamp - start) as f64 / TICKS_PER_SECOND as f64;
        if seconds <= last {
            continue;
        }
        let (width, height, rgba) = match gpu.read_rgba(&frame) {
            Ok(read) => read,
            Err(error) => {
                added = Err(format!("Could not read a frame for the GIF: {error}"));
                break;
            }
        };
        let pixels = rgba.as_chunks::<4>().0.iter().map(|&[r, g, b, a]| RGBA8::new(r, g, b, a)).collect();
        if let Err(error) = collector.add_frame_rgba(index, ImgVec::new(pixels, width as usize, height as usize), seconds) {
            added = Err(error.to_string());
            break;
        }
        index += 1;
        last = seconds;
    }
    drop(collector);
    let written = written.join().map_err(|_| "The GIF writer crashed.".to_string())?;
    added.and(written).and_then(|()| if index == 0 { Err("No frames were recorded for the GIF.".to_string()) } else { Ok(()) })
}

impl GifOutput {
    pub(crate) fn start(gpu: &Gpu, path: PathBuf) -> Result<Self, String> {
        let (frames, received) = mpsc::sync_channel(QUEUE);
        let gpu = gpu.clone();
        let thread = std::thread::Builder::new()
            .name("fuyu-recording-gif".into())
            .spawn(move || encode(gpu, path, received))
            .map_err(|error| error.to_string())?;
        Ok(Self { frames: Some(frames), thread: Some(thread), rate: GifRate::new(), dropped: 0 })
    }

    pub(crate) fn offer(&mut self, frame: &GpuFrame, stamp: i64) {
        if !self.rate.take(stamp) {
            return;
        }
        if let Some(frames) = &self.frames {
            if let Err(TrySendError::Full(_)) = frames.try_send((frame.clone(), stamp)) {
                self.dropped += 1;
            }
        }
    }

    pub(crate) fn finish(mut self) -> Result<(), String> {
        self.frames = None;
        match self.thread.take() {
            Some(thread) => thread.join().map_err(|_| "The GIF encoder crashed.".to_string())?,
            None => Ok(()),
        }
    }
}
