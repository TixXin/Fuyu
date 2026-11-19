use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex, OnceLock, PoisonError,
};

use tauri::{AppHandle, Emitter};

const LAYER_EVENT: &str = "island-layer-changed";
const SHORTCUT_STATUS_EVENT: &str = "island-layer-shortcut-status";

static FRONT: AtomicBool = AtomicBool::new(true);
static YIELDING: AtomicBool = AtomicBool::new(false);
static APP: OnceLock<AppHandle> = OnceLock::new();
static PROBLEM: Mutex<Option<&'static str>> = Mutex::new(None);

pub(crate) fn allows_raise() -> bool {
    FRONT.load(Ordering::SeqCst) && !YIELDING.load(Ordering::SeqCst)
}

pub(crate) fn set_front(front: bool) {
    FRONT.store(front, Ordering::SeqCst);
}

#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn set_yielding(yielding: bool) {
    YIELDING.store(yielding, Ordering::SeqCst);
}

fn front() -> bool {
    FRONT.load(Ordering::SeqCst)
}

#[cfg(target_os = "macos")]
pub(super) fn app() -> Option<&'static AppHandle> {
    APP.get()
}

pub(super) fn pressed() {
    if let Some(app) = APP.get() {
        toggle(app);
    }
}

fn toggle(app: &AppHandle) -> bool {
    let front = !front();
    set_front(front);
    apply(app);
    let _ = app.emit(LAYER_EVENT, front);
    front
}

fn apply(app: &AppHandle) {
    let raise = allows_raise();
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || place(&handle, raise));
}

#[cfg(windows)]
fn place(app: &AppHandle, raise: bool) {
    if let Ok(island) = super::main_window(app).and_then(|window| window.hwnd().map_err(|error| error.to_string())) {
        if !crate::win32::z_order::set_topmost(island, raise) {
            eprintln!("could not move the island to the {} layer", if raise { "front" } else { "bottom" });
        }
    }
}

#[cfg(target_os = "macos")]
fn place(app: &AppHandle, raise: bool) {
    crate::macos::island_panel::set_island_front(app, super::WINDOW_LABEL, raise);
}

pub(super) fn report(problem: Option<&'static str>) {
    let changed = {
        let mut slot = PROBLEM.lock().unwrap_or_else(PoisonError::into_inner);
        std::mem::replace(&mut *slot, problem) != problem
    };
    if let (true, Some(app)) = (changed, APP.get()) {
        let _ = app.emit(SHORTCUT_STATUS_EVENT, problem);
    }
}

fn shortcut_of(shortcut: Option<String>) -> Option<String> {
    shortcut.map(|shortcut| shortcut.trim().to_owned()).filter(|shortcut| !shortcut.is_empty())
}

#[cfg(windows)]
pub(crate) fn coexist_refresh() {
    super::layer_hotkey::refresh_later();
}

#[tauri::command]
pub fn set_island_layer_shortcut(app: AppHandle, shortcut: Option<String>) -> Result<(), String> {
    let _ = APP.set(app);
    super::layer_hotkey::configure(shortcut_of(shortcut))
}

#[tauri::command]
pub fn get_island_layer_shortcut_problem() -> Option<&'static str> {
    *PROBLEM.lock().unwrap_or_else(PoisonError::into_inner)
}

#[tauri::command]
pub fn get_island_layer() -> bool {
    front()
}

#[tauri::command]
pub fn toggle_island_layer(app: AppHandle) -> bool {
    let _ = APP.set(app.clone());
    toggle(&app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_island_may_rise_only_when_it_is_in_front_and_not_yielding() {
        set_front(true);
        set_yielding(false);
        assert!(allows_raise());
        set_yielding(true);
        assert!(!allows_raise());
        set_yielding(false);
        set_front(false);
        assert!(!allows_raise());
        set_front(true);
        assert!(allows_raise());
    }

    #[test]
    fn a_blank_shortcut_switches_the_toggle_off() {
        assert_eq!(shortcut_of(None), None);
        assert_eq!(shortcut_of(Some("   ".into())), None);
        assert_eq!(shortcut_of(Some(" Ctrl+Alt+B ".into())).as_deref(), Some("Ctrl+Alt+B"));
    }
}
