use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex, OnceLock, PoisonError,
};

use global_hotkey::hotkey::HotKey;
use tauri::{AppHandle, Emitter};

use super::session;
use super::shortcuts::{default_shortcuts, plan, ShortcutAction, ShortcutConfig, ShortcutStatus, STATUS_EVENT};
use crate::clipboard_history::{to_hotkey, ShortcutBinding};
use crate::macos::hotkeys;

static APP: OnceLock<AppHandle> = OnceLock::new();
static ENABLED: AtomicBool = AtomicBool::new(false);
static CONFIG: Mutex<Option<Vec<ShortcutConfig>>> = Mutex::new(None);
static REGISTERED: Mutex<Vec<HotKey>> = Mutex::new(Vec::new());
static STATUS: Mutex<Vec<ShortcutStatus>> = Mutex::new(Vec::new());

pub(super) fn start(app: &AppHandle) {
    let _ = APP.set(app.clone());
    refresh_on_main_thread();
}

pub(super) fn is_enabled() -> bool {
    ENABLED.load(Ordering::SeqCst)
}

pub(super) fn configure(enabled: bool, shortcuts: Option<Vec<ShortcutConfig>>, _print_screen: Option<bool>) {
    if let Some(shortcuts) = shortcuts {
        *CONFIG.lock().unwrap_or_else(PoisonError::into_inner) = Some(shortcuts);
    }
    ENABLED.store(enabled, Ordering::SeqCst);
    refresh_on_main_thread();
}

pub(super) fn status() -> Vec<ShortcutStatus> {
    STATUS.lock().unwrap_or_else(PoisonError::into_inner).clone()
}

fn refresh_on_main_thread() {
    if let Some(app) = APP.get() {
        let _ = app.run_on_main_thread(refresh);
    }
}

fn refresh() {
    for hotkey in REGISTERED.lock().unwrap_or_else(PoisonError::into_inner).drain(..) {
        hotkeys::unregister(hotkey);
    }
    let mut problems = Vec::new();
    if ENABLED.load(Ordering::SeqCst) {
        let config = CONFIG.lock().unwrap_or_else(PoisonError::into_inner).clone().unwrap_or_else(default_shortcuts);
        let (bindings, planned) = plan(&config);
        problems = planned;
        let mut registered = Vec::new();
        for binding in bindings {
            let action = binding.action;
            let shortcut = ShortcutBinding { label: String::new(), modifiers: binding.modifiers, key_code: binding.key_code };
            let Some(hotkey) = to_hotkey(&shortcut) else {
                problems.push(ShortcutStatus { action, problem: "invalid" });
                continue;
            };
            match hotkeys::register(hotkey, move || run_action(action)) {
                Ok(()) => registered.push(hotkey),
                Err(_) => problems.push(ShortcutStatus { action, problem: "taken" }),
            }
        }
        *REGISTERED.lock().unwrap_or_else(PoisonError::into_inner) = registered;
    }
    *STATUS.lock().unwrap_or_else(PoisonError::into_inner) = problems.clone();
    if let Some(app) = APP.get() {
        let _ = app.emit(STATUS_EVENT, problems);
    }
}

fn run_action(action: ShortcutAction) {
    let Some(app) = APP.get() else { return };
    if !ENABLED.load(Ordering::SeqCst) {
        return;
    }
    match action.mode() {
        Some(mode) => session::start(app, mode),
        None => super::pin::toggle_all(app),
    }
}
