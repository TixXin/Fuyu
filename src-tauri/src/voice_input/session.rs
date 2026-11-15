use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, PoisonError,
    },
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::capture::{self, Capture};
use super::{engine, model};
use crate::user_error::UserError;

pub(crate) const STATE_EVENT: &str = "voice-input-state";
pub(crate) const MAX_SECONDS: u64 = 120;
const MIN_MILLIS: u64 = 300;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "phase")]
pub enum VoiceInputState {
    Idle,
    #[serde(rename_all = "camelCase")]
    Recording { started_at_ms: u64, limit_seconds: u64 },
    Transcribing,
    Result { text: String },
    Failed { error: UserError },
}

struct Active {
    _capture: Capture,
    samples: Arc<Mutex<Vec<f32>>>,
    rate: u32,
}

static ACTIVE: Mutex<Option<Active>> = Mutex::new(None);
static PHASE: Mutex<VoiceInputState> = Mutex::new(VoiceInputState::Idle);
static STARTING: AtomicBool = AtomicBool::new(false);
static TRANSCRIBING: AtomicBool = AtomicBool::new(false);

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX)).unwrap_or(0)
}

pub(crate) fn current() -> VoiceInputState {
    PHASE.lock().unwrap_or_else(PoisonError::into_inner).clone()
}

fn publish(app: &AppHandle, state: VoiceInputState) {
    let kept = match &state {
        VoiceInputState::Result { .. } | VoiceInputState::Failed { .. } => VoiceInputState::Idle,
        other => other.clone(),
    };
    *PHASE.lock().unwrap_or_else(PoisonError::into_inner) = kept;
    let _ = app.emit(STATE_EVENT, state);
}

pub(crate) fn fail(app: &AppHandle, error: UserError) {
    publish(app, VoiceInputState::Failed { error });
}

pub(crate) fn is_recording() -> bool {
    ACTIVE.lock().unwrap_or_else(PoisonError::into_inner).is_some()
}

pub(crate) fn toggle(app: &AppHandle) -> Result<(), UserError> {
    if is_recording() {
        stop(app, true)
    } else {
        start(app)
    }
}

pub(crate) fn sample_limit(rate: u32) -> usize {
    usize::try_from(u64::from(rate).saturating_mul(MAX_SECONDS)).unwrap_or(usize::MAX)
}

pub(crate) fn long_enough(samples: usize, rate: u32) -> bool {
    rate > 0 && (samples as u64).saturating_mul(1000) / u64::from(rate) >= MIN_MILLIS
}

pub(crate) fn start(app: &AppHandle) -> Result<(), UserError> {
    if TRANSCRIBING.load(Ordering::SeqCst) || is_recording() || STARTING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    let result = open(app);
    STARTING.store(false, Ordering::SeqCst);
    if let Err(error) = &result {
        fail(app, error.clone());
    }
    result
}

fn open(app: &AppHandle) -> Result<(), UserError> {
    let root = model::root_dir(app)?;
    if !model::is_installed(&root) {
        return Err(UserError::new("voiceInput.noModel", "Download the speech model in Settings first."));
    }
    let samples = Arc::new(Mutex::new(Vec::new()));
    let sink = Arc::clone(&samples);
    let limit_hit = Arc::new(AtomicBool::new(false));
    let limit = Arc::new(std::sync::atomic::AtomicUsize::new(usize::MAX));
    let limit_seen = Arc::clone(&limit);
    let handle = app.clone();
    let (capture, rate) = capture::start(move |chunk: &[f32]| {
        let mut buffer = sink.lock().unwrap_or_else(PoisonError::into_inner);
        let cap = limit_seen.load(Ordering::SeqCst);
        let room = cap.saturating_sub(buffer.len());
        buffer.extend_from_slice(&chunk[..chunk.len().min(room)]);
        if buffer.len() >= cap && !limit_hit.swap(true, Ordering::SeqCst) {
            let app = handle.clone();
            std::thread::spawn(move || {
                let _ = stop(&app, true);
            });
        }
    })?;
    limit.store(sample_limit(rate), Ordering::SeqCst);
    *ACTIVE.lock().unwrap_or_else(PoisonError::into_inner) = Some(Active { _capture: capture, samples, rate });
    publish(app, VoiceInputState::Recording { started_at_ms: now_ms(), limit_seconds: MAX_SECONDS });
    Ok(())
}

pub(crate) fn stop(app: &AppHandle, transcribe: bool) -> Result<(), UserError> {
    let Some(active) = ACTIVE.lock().unwrap_or_else(PoisonError::into_inner).take() else {
        return Ok(());
    };
    let Active { _capture, samples, rate } = active;
    drop(_capture);
    let samples = std::mem::take(&mut *samples.lock().unwrap_or_else(PoisonError::into_inner));
    if !transcribe {
        publish(app, VoiceInputState::Idle);
        return Ok(());
    }
    if !long_enough(samples.len(), rate) {
        publish(app, VoiceInputState::Result { text: String::new() });
        return Ok(());
    }
    TRANSCRIBING.store(true, Ordering::SeqCst);
    publish(app, VoiceInputState::Transcribing);
    let app = app.clone();
    std::thread::spawn(move || {
        let result = model::root_dir(&app).and_then(|root| engine::transcribe(&root, &samples, rate));
        TRANSCRIBING.store(false, Ordering::SeqCst);
        match result {
            Ok(text) => publish(&app, VoiceInputState::Result { text }),
            Err(error) => fail(&app, error),
        }
    });
    Ok(())
}
