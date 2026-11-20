use std::{
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Mutex, OnceLock, PoisonError,
    },
    thread,
    time::Duration,
};

use tauri::{AppHandle, Emitter};

const LAYER_EVENT: &str = "island-layer-changed";
const SHORTCUT_STATUS_EVENT: &str = "island-layer-shortcut-status";
const DROP_DELAY: Duration = Duration::from_millis(1200);

static FRONT: AtomicBool = AtomicBool::new(true);
static YIELDING: AtomicBool = AtomicBool::new(false);
static CHANGES: AtomicU64 = AtomicU64::new(0);
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

fn is_behind(visible: bool, front: bool) -> bool {
    visible && !front
}

pub(crate) fn behind(app: &AppHandle) -> bool {
    is_behind(crate::tray::island_visible(app), front())
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
    change(app, front);
    front
}

fn change(app: &AppHandle, front: bool) {
    set_front(front);
    let stamp = CHANGES.fetch_add(1, Ordering::SeqCst) + 1;
    let _ = app.emit(LAYER_EVENT, front);
    crate::tray::refresh_now(app);
    if front {
        apply(app);
    } else {
        drop_later(app, stamp);
    }
}

fn drop_later(app: &AppHandle, stamp: u64) {
    let handle = app.clone();
    let spawned = thread::Builder::new().name("island-layer-drop".into()).spawn(move || {
        thread::sleep(DROP_DELAY);
        if CHANGES.load(Ordering::SeqCst) == stamp {
            apply(&handle);
        }
    });
    if spawned.is_err() {
        apply(app);
    }
}

pub(crate) fn bring_front(app: &AppHandle) {
    if !front() {
        change(app, true);
    }
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
    fn the_island_counts_as_behind_only_while_it_is_shown_and_sent_back() {
        assert!(is_behind(true, false));
        assert!(!is_behind(true, true));
        assert!(!is_behind(false, false));
        assert!(!is_behind(false, true));
    }

    #[test]
    fn a_blank_shortcut_switches_the_toggle_off() {
        assert_eq!(shortcut_of(None), None);
        assert_eq!(shortcut_of(Some("   ".into())), None);
        assert_eq!(shortcut_of(Some(" Ctrl+Alt+B ".into())).as_deref(), Some("Ctrl+Alt+B"));
    }
}
