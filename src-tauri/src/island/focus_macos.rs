use std::sync::atomic::{AtomicI32, Ordering};
use tauri::{AppHandle, WebviewWindow};

use super::{main_window, WINDOW_LABEL};
use crate::macos::{apps, input, island_panel};

static PREVIOUS_APP: AtomicI32 = AtomicI32::new(0);

fn other_frontmost_app() -> Option<i32> {
    let own = i32::try_from(std::process::id()).ok();
    apps::frontmost_pid().filter(|pid| Some(*pid) != own)
}

#[tauri::command]
pub fn take_island_hover_focus(app: AppHandle) -> Result<bool, String> {
    if input::is_left_button_down() {
        return Ok(false);
    }
    if main_window(&app)?.is_focused().unwrap_or(false) {
        return Ok(true);
    }
    if let Some(pid) = other_frontmost_app() {
        PREVIOUS_APP.store(pid, Ordering::SeqCst);
    }
    let handle = app.clone();
    app.run_on_main_thread(move || {
        if let Err(error) = island_panel::make_island_key(&handle, WINDOW_LABEL) {
            eprintln!("{error}");
        }
    })
    .map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn release_island_hover_focus(app: AppHandle) -> Result<bool, String> {
    if input::is_left_button_down() {
        return Ok(false);
    }
    let previous = PREVIOUS_APP.swap(0, Ordering::SeqCst);
    if previous == 0 || !main_window(&app)?.is_focused().unwrap_or(false) {
        return Ok(true);
    }
    let handle = app.clone();
    app.run_on_main_thread(move || island_panel::hand_key_back(&handle, WINDOW_LABEL, previous))
        .map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn island_is_foreground(app: AppHandle) -> Result<bool, String> {
    main_window(&app)?.is_focused().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn take_island_click_focus() -> Result<bool, String> {
    Ok(true)
}

pub(crate) fn set_click_activation(_window: &WebviewWindow, _activates: bool) {}

pub(crate) fn island_mode_synced(_window: &WebviewWindow, _expanded: bool) {}

pub(crate) fn show_island_at_startup(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

pub(crate) fn focus_island_for_shortcut(window: &WebviewWindow) {
    let previous = other_frontmost_app();
    let _ = window.set_focus();
    if let Some(pid) = previous {
        PREVIOUS_APP.store(pid, Ordering::SeqCst);
    }
}
