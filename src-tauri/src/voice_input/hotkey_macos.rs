use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex, OnceLock, PoisonError,
};

use global_hotkey::hotkey::HotKey;
use tauri::{AppHandle, Emitter};

use super::{on_hotkey, SHORTCUT_EVENT};
use crate::clipboard_history::{parse_shortcut_binding, to_hotkey};
use crate::macos::hotkeys;

static APP: OnceLock<AppHandle> = OnceLock::new();
static STARTED: AtomicBool = AtomicBool::new(false);
static WANTED: Mutex<Option<String>> = Mutex::new(None);
static REGISTERED: Mutex<Option<HotKey>> = Mutex::new(None);
static PROBLEM: Mutex<Option<&'static str>> = Mutex::new(None);

pub(super) fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
}

pub(super) fn start() -> Result<(), String> {
    STARTED.store(true, Ordering::SeqCst);
    refresh_on_main_thread();
    Ok(())
}

pub(super) fn stop() {
    STARTED.store(false, Ordering::SeqCst);
    refresh_on_main_thread();
}

pub(super) fn running() -> bool {
    STARTED.load(Ordering::SeqCst)
}

pub(super) fn configure(shortcut: Option<String>) {
    *WANTED.lock().unwrap_or_else(PoisonError::into_inner) = shortcut;
    if STARTED.load(Ordering::SeqCst) {
        refresh_on_main_thread();
    }
}

pub(super) fn problem() -> Option<&'static str> {
    *PROBLEM.lock().unwrap_or_else(PoisonError::into_inner)
}

fn refresh_on_main_thread() {
    if let Some(app) = APP.get() {
        let _ = app.run_on_main_thread(refresh);
    }
}

fn refresh() {
    if let Some(hotkey) = REGISTERED.lock().unwrap_or_else(PoisonError::into_inner).take() {
        hotkeys::unregister(hotkey);
    }
    let problem = if STARTED.load(Ordering::SeqCst) {
        let wanted = WANTED.lock().unwrap_or_else(PoisonError::into_inner).clone();
        match wanted.map(|shortcut| parse_shortcut_binding(&shortcut).and_then(|binding| to_hotkey(&binding))) {
            None => None,
            Some(None) => Some("invalid"),
            Some(Some(hotkey)) => match hotkeys::register(hotkey, on_hotkey) {
                Ok(()) => {
                    *REGISTERED.lock().unwrap_or_else(PoisonError::into_inner) = Some(hotkey);
                    None
                }
                Err(_) => Some("taken"),
            },
        }
    } else {
        None
    };
    *PROBLEM.lock().unwrap_or_else(PoisonError::into_inner) = problem;
    if let Some(app) = APP.get() {
        let _ = app.emit(SHORTCUT_EVENT, problem);
    }
}
