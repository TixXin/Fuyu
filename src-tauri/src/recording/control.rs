use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex, PoisonError,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Emitter, Manager};

use crate::{user_error::UserError, win32};

use super::{
    format,
    session::{Options, Recording, Summary},
    state::{Phase, State},
};

const STATE_EVENT: &str = "recording-state";
const FINISHED_EVENT: &str = "recording-finished";
const COUNTDOWN: u32 = 3;

static ACTIVE: Mutex<Option<Recording>> = Mutex::new(None);
static STATE: Mutex<State> = Mutex::new(State { phase: Phase::Idle, countdown: 0, paused: false, elapsed_ms: 0, since_ms: 0 });
static HIDDEN: Mutex<Vec<String>> = Mutex::new(Vec::new());
static RUN: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub(crate) x: i32,
    pub(crate) y: i32,
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) fps: Option<u32>,
    pub(crate) quality: Option<String>,
    pub(crate) system_audio: Option<bool>,
    pub(crate) microphone: Option<bool>,
    pub(crate) gif: Option<bool>,
    pub(crate) folder_name: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Finished {
    summary: Option<Summary>,
    error: Option<UserError>,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |time| time.as_millis() as u64)
}

pub(crate) fn failed(error: impl std::fmt::Display) -> UserError {
    UserError::new("recording.failed", "The recording failed.").detail(error)
}

fn idle() -> UserError {
    UserError::new("recording.idle", "Nothing is being recorded.")
}

pub(crate) fn state() -> State {
    STATE.lock().unwrap_or_else(PoisonError::into_inner).clone()
}

fn set(app: &AppHandle, next: State) {
    *STATE.lock().unwrap_or_else(PoisonError::into_inner) = next.clone();
    let _ = app.emit_to(crate::island::WINDOW_LABEL, STATE_EVENT, next);
}

pub(crate) fn is_busy() -> bool {
    state().phase != Phase::Idle
}

fn hide_own_windows(app: &AppHandle) {
    let mut hidden = HIDDEN.lock().unwrap_or_else(PoisonError::into_inner);
    for (label, window) in app.webview_windows() {
        if label.starts_with(crate::screenshot::WINDOW_PREFIX) || label.starts_with(crate::screenshot::PIN_PREFIX) {
            continue;
        }
        if window.hwnd().is_ok_and(|hwnd| win32::window::exclude_from_capture(hwnd, true)) {
            hidden.push(label);
        }
    }
}

fn show_own_windows(app: &AppHandle) {
    for label in HIDDEN.lock().unwrap_or_else(PoisonError::into_inner).drain(..) {
        if let Some(hwnd) = app.get_webview_window(&label).and_then(|window| window.hwnd().ok()) {
            win32::window::exclude_from_capture(hwnd, false);
        }
    }
}

pub(crate) fn start_now(app: &AppHandle, request: Request) -> Result<String, UserError> {
    let mut active = ACTIVE.lock().unwrap_or_else(PoisonError::into_inner);
    if active.is_some() {
        return Err(UserError::new("recording.busy", "A recording is already running."));
    }
    let videos = win32::known_folder::videos().ok_or_else(|| failed("The Videos folder is unavailable."))?;
    let folder = videos.join(crate::screenshot::sanitized_name(&request.folder_name));
    std::fs::create_dir_all(&folder).map_err(|error| failed(format!("Failed to create {}: {error}", folder.display())))?;
    let gif = request.gif.unwrap_or(false);
    let path = format::file_name_in(&folder, chrono::Local::now(), if gif { "gif" } else { "mp4" });
    let video = if gif { std::env::temp_dir().join(format!("fuyu-recording-{}.mp4", std::process::id())) } else { path.clone() };
    let options = Options {
        x: request.x,
        y: request.y,
        width: request.width,
        height: request.height,
        fps: format::fps(request.fps),
        high_quality: request.quality.as_deref() == Some("high"),
        system_audio: !gif && request.system_audio.unwrap_or(true),
        microphone: !gif && request.microphone.unwrap_or(false),
        path: video,
        gif: gif.then(|| path.clone()),
    };
    hide_own_windows(app);
    match Recording::start(options) {
        Ok(recording) => *active = Some(recording),
        Err(error) => {
            show_own_windows(app);
            return Err(failed(error));
        }
    }
    set(app, State::recording(now_ms()));
    Ok(path.display().to_string())
}

pub(crate) fn begin(app: &AppHandle, request: Request) {
    if is_busy() {
        return;
    }
    let run = RUN.fetch_add(1, Ordering::SeqCst) + 1;
    set(app, State::counting(COUNTDOWN));
    let app = app.clone();
    std::thread::spawn(move || {
        for left in (1..=COUNTDOWN).rev() {
            if RUN.load(Ordering::SeqCst) != run {
                return;
            }
            set(&app, State::counting(left));
            std::thread::sleep(Duration::from_secs(1));
        }
        if RUN.load(Ordering::SeqCst) != run {
            return;
        }
        if let Err(error) = start_now(&app, request) {
            set(&app, State::default());
            let _ = app.emit_to(crate::island::WINDOW_LABEL, FINISHED_EVENT, Finished { summary: None, error: Some(error) });
        }
    });
}

pub(crate) fn pause(app: &AppHandle, paused: bool) -> Result<(), UserError> {
    let active = ACTIVE.lock().unwrap_or_else(PoisonError::into_inner);
    let recording = active.as_ref().ok_or_else(idle)?;
    recording.pause(paused);
    set(app, state().paused(paused, now_ms()));
    Ok(())
}

pub(crate) fn stop(app: &AppHandle) -> Result<Option<Summary>, UserError> {
    RUN.fetch_add(1, Ordering::SeqCst);
    let recording = ACTIVE.lock().unwrap_or_else(PoisonError::into_inner).take();
    let Some(recording) = recording else {
        let counting = state().phase == Phase::Countdown;
        set(app, State::default());
        return if counting { Ok(None) } else { Err(idle()) };
    };
    let result = recording.stop().map_err(failed);
    show_own_windows(app);
    set(app, State::default());
    let finished = match &result {
        Ok(summary) => Finished { summary: Some(summary.clone()), error: None },
        Err(error) => Finished { summary: None, error: Some(error.clone()) },
    };
    let _ = app.emit_to(crate::island::WINDOW_LABEL, FINISHED_EVENT, finished);
    result.map(Some)
}

pub(crate) fn stop_in_background(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let _ = stop(&app);
    });
}
