use std::sync::atomic::{AtomicIsize, Ordering};
use tauri::{AppHandle, WebviewWindow};
use windows::Win32::Foundation::HWND;

use super::main_window;
use crate::win32;

static PREVIOUS_FOREGROUND: AtomicIsize = AtomicIsize::new(0);

#[tauri::command]
pub fn take_island_hover_focus(app: AppHandle) -> Result<bool, String> {
    if win32::input::is_left_button_down() {
        return Ok(false);
    }
    let window = main_window(&app)?;
    let island = window.hwnd().map_err(|error| error.to_string())?;
    let foreground = win32::window::foreground_window();
    if foreground == island {
        return Ok(true);
    }
    if !win32::window::activate_from_background(island) {
        return Ok(true);
    }
    if !foreground.is_invalid() {
        PREVIOUS_FOREGROUND.store(foreground.0 as isize, Ordering::SeqCst);
    }
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(true)
}

pub(crate) fn focus_island_for_shortcut(window: &WebviewWindow) {
    let foreground = win32::window::foreground_window();
    let _ = window.set_focus();
    let Ok(island) = window.hwnd() else {
        return;
    };
    if foreground != island
        && !foreground.is_invalid()
        && win32::window::foreground_window() == island
    {
        PREVIOUS_FOREGROUND.store(foreground.0 as isize, Ordering::SeqCst);
    }
}

#[tauri::command]
pub fn release_island_hover_focus(app: AppHandle) -> Result<bool, String> {
    if win32::input::is_left_button_down() {
        return Ok(false);
    }
    let previous = PREVIOUS_FOREGROUND.swap(0, Ordering::SeqCst);
    if previous == 0 {
        return Ok(true);
    }
    let island = main_window(&app)?.hwnd().map_err(|error| error.to_string())?;
    let previous = HWND(previous as *mut _);
    if win32::window::foreground_window() == island && win32::window::is_visible(previous) {
        win32::window::bring_to_foreground(previous);
    }
    Ok(true)
}

#[tauri::command]
pub fn island_is_foreground(app: AppHandle) -> Result<bool, String> {
    let island = main_window(&app)?.hwnd().map_err(|error| error.to_string())?;
    Ok(win32::window::foreground_window() == island)
}
