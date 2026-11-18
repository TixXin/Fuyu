use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex, PoisonError,
};

use global_hotkey::hotkey::HotKey;

use crate::clipboard_history::{parse_shortcut_binding, to_hotkey};
use crate::macos::hotkeys;

static RUNNING: AtomicBool = AtomicBool::new(false);
static WANTED: Mutex<Option<String>> = Mutex::new(None);
static REGISTERED: Mutex<Option<HotKey>> = Mutex::new(None);

pub(super) fn start(shortcut: Option<String>) -> Result<(), String> {
    *WANTED.lock().unwrap_or_else(PoisonError::into_inner) = shortcut;
    RUNNING.store(true, Ordering::SeqCst);
    refresh_on_main_thread();
    Ok(())
}

pub(super) fn stop() {
    RUNNING.store(false, Ordering::SeqCst);
    refresh_on_main_thread();
}

pub(super) fn running() -> bool {
    RUNNING.load(Ordering::SeqCst)
}

pub(super) fn configure(shortcut: Option<String>) {
    *WANTED.lock().unwrap_or_else(PoisonError::into_inner) = shortcut;
    refresh_on_main_thread();
}

fn refresh_on_main_thread() {
    if let Some(app) = super::shortcut::app() {
        let _ = app.run_on_main_thread(refresh);
    }
}

fn refresh() {
    if let Some(hotkey) = REGISTERED.lock().unwrap_or_else(PoisonError::into_inner).take() {
        hotkeys::unregister(hotkey);
    }
    let wanted = if RUNNING.load(Ordering::SeqCst) { WANTED.lock().unwrap_or_else(PoisonError::into_inner).clone() } else { None };
    let problem = match wanted.map(|shortcut| parse_shortcut_binding(&shortcut).and_then(|binding| to_hotkey(&binding))) {
        None => None,
        Some(None) => Some("invalid"),
        Some(Some(hotkey)) => match hotkeys::register(hotkey, super::shortcut::pressed) {
            Ok(()) => {
                *REGISTERED.lock().unwrap_or_else(PoisonError::into_inner) = Some(hotkey);
                None
            }
            Err(_) => Some("taken"),
        },
    };
    super::shortcut::report(problem);
}
