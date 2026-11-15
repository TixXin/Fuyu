use std::{
    ptr::NonNull,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    thread::JoinHandle,
    time::Duration,
};

use block2::RcBlock;
use objc2::runtime::Bool;
use objc2_avf_audio::{AVAudioApplication, AVAudioApplicationRecordPermission, AVAudioEngine, AVAudioPCMBuffer, AVAudioTime};

const TAP_FRAMES: u32 = 4096;
const ASK_TIMEOUT: Duration = Duration::from_secs(120);
const STOP_POLL: Duration = Duration::from_millis(40);

pub(crate) enum MicrophoneError {
    Denied,
    Failed(String),
}

fn ensure_permission() -> Result<(), MicrophoneError> {
    let application = unsafe { AVAudioApplication::sharedInstance() };
    let permission = unsafe { application.recordPermission() };
    if permission == AVAudioApplicationRecordPermission::Granted {
        return Ok(());
    }
    if permission == AVAudioApplicationRecordPermission::Denied {
        return Err(MicrophoneError::Denied);
    }
    let (sender, receiver) = mpsc::channel();
    let answer = RcBlock::new(move |granted: Bool| {
        let _ = sender.send(granted.as_bool());
    });
    unsafe { AVAudioApplication::requestRecordPermissionWithCompletionHandler(&answer) };
    match receiver.recv_timeout(ASK_TIMEOUT) {
        Ok(true) => Ok(()),
        _ => Err(MicrophoneError::Denied),
    }
}

pub(crate) struct Microphone {
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

fn first_channel(buffer: NonNull<AVAudioPCMBuffer>) -> Option<Vec<f32>> {
    let buffer = unsafe { buffer.as_ref() };
    let frames = usize::try_from(unsafe { buffer.frameLength() }).ok()?;
    let channels = unsafe { buffer.floatChannelData() };
    if channels.is_null() || frames == 0 {
        return None;
    }
    let first = unsafe { *channels };
    Some(unsafe { std::slice::from_raw_parts(first.as_ptr(), frames) }.to_vec())
}

fn run<F>(on_samples: F, stop: &AtomicBool, ready: &mpsc::Sender<Result<u32, MicrophoneError>>)
where
    F: FnMut(&[f32]) + Send + 'static,
{
    let engine = unsafe { AVAudioEngine::new() };
    let input = unsafe { engine.inputNode() };
    let format = unsafe { input.outputFormatForBus(0) };
    let rate = unsafe { format.sampleRate() };
    if !(rate.is_finite() && rate >= 1.0) || unsafe { format.channelCount() } == 0 {
        let _ = ready.send(Err(MicrophoneError::Failed("No microphone is available.".to_string())));
        return;
    }
    let sink = Mutex::new(on_samples);
    let tap = RcBlock::new(move |buffer: NonNull<AVAudioPCMBuffer>, _when: NonNull<AVAudioTime>| {
        if let (Some(samples), Ok(mut sink)) = (first_channel(buffer), sink.lock()) {
            sink(&samples);
        }
    });
    unsafe { input.installTapOnBus_bufferSize_format_block(0, TAP_FRAMES, Some(&format), RcBlock::as_ptr(&tap)) };
    if let Err(error) = unsafe { engine.startAndReturnError() } {
        unsafe { input.removeTapOnBus(0) };
        let _ = ready.send(Err(MicrophoneError::Failed(error.localizedDescription().to_string())));
        return;
    }
    let _ = ready.send(Ok(rate.round() as u32));
    while !stop.load(Ordering::SeqCst) {
        std::thread::sleep(STOP_POLL);
    }
    unsafe {
        input.removeTapOnBus(0);
        engine.stop();
    }
}

impl Microphone {
    pub(crate) fn start<F>(on_samples: F) -> Result<(Self, u32), MicrophoneError>
    where
        F: FnMut(&[f32]) + Send + 'static,
    {
        ensure_permission()?;
        let stop = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&stop);
        let (ready, started) = mpsc::channel();
        let thread = std::thread::Builder::new()
            .name("fuyu-voice-input-mic".into())
            .spawn(move || run(on_samples, &flag, &ready))
            .map_err(|error| MicrophoneError::Failed(error.to_string()))?;
        match started.recv() {
            Ok(Ok(rate)) => Ok((Self { stop, thread: Some(thread) }, rate)),
            Ok(Err(error)) => {
                let _ = thread.join();
                Err(error)
            }
            Err(_) => {
                let _ = thread.join();
                Err(MicrophoneError::Failed("The microphone thread stopped.".to_string()))
            }
        }
    }
}

impl Drop for Microphone {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}
