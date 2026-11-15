use std::sync::{Mutex, OnceLock, PoisonError};

use global_hotkey::hotkey::HotKey;
use tauri::{AppHandle, Emitter};

use super::{on_hotkey, SHORTCUT_EVENT};
use crate::clipboard_history::{parse_shortcut_binding, to_hotkey};
use crate::macos::hotkeys;

static APP: OnceLock<AppHandle> = OnceLock::new();
static WANTED: Mutex<Option<String>> = Mutex::new(None);
static REGISTERED: Mutex<Option<HotKey>> = Mutex::new(None);
static PROBLEM: Mutex<Option<&'static str>> = Mutex::new(None);

pub(super) fn start(app: &AppHandle) {
    let _ = APP.set(app.clone());
    refresh_on_main_thread();
}

pub(super) fn configure(shortcut: Option<String>) {
    *WANTED.lock().unwrap_or_else(PoisonError::into_inner) = shortcut;
    refresh_on_main_thread();
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
    let wanted = WANTED.lock().unwrap_or_else(PoisonError::into_inner).clone();
    let problem = match wanted.map(|shortcut| parse_shortcut_binding(&shortcut).and_then(|binding| to_hotkey(&binding))) {
        None => None,
        Some(None) => Some("invalid"),
        Some(Some(hotkey)) => match hotkeys::register(hotkey, on_hotkey) {
            Ok(()) => {
                *REGISTERED.lock().unwrap_or_else(PoisonError::into_inner) = Some(hotkey);
                None
            }
            Err(_) => Some("taken"),
        },
    };
    *PROBLEM.lock().unwrap_or_else(PoisonError::into_inner) = problem;
    if let Some(app) = APP.get() {
        let _ = app.emit(SHORTCUT_EVENT, problem);
    }
}
