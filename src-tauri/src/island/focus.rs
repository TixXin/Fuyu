use std::sync::atomic::{AtomicIsize, Ordering};
use tauri::{AppHandle, WebviewWindow};
use windows::Win32::Foundation::HWND;

use super::main_window;
use crate::win32;

static PREVIOUS_FOREGROUND: AtomicIsize = AtomicIsize::new(0);
static CLICK_PREVIOUS_FOREGROUND: AtomicIsize = AtomicIsize::new(0);

fn take_focus(app: &AppHandle, previous: &AtomicIsize) -> Result<bool, String> {
    if win32::input::is_left_button_down() {
        return Ok(false);
    }
    let window = main_window(app)?;
    let island = window.hwnd().map_err(|error| error.to_string())?;
    let foreground = win32::window::foreground_window();
    if foreground == island {
        return Ok(true);
    }
    if !win32::window::activate_from_background(island) {
        return Ok(true);
    }
    if !foreground.is_invalid() {
        previous.store(foreground.0 as isize, Ordering::SeqCst);
    }
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn take_island_hover_focus(app: AppHandle) -> Result<bool, String> {
    take_focus(&app, &PREVIOUS_FOREGROUND)
}

#[tauri::command]
pub fn take_island_click_focus(app: AppHandle) -> Result<bool, String> {
    take_focus(&app, &CLICK_PREVIOUS_FOREGROUND)
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

pub(crate) fn show_island_at_startup(window: &WebviewWindow) -> Result<(), String> {
    let island = window.hwnd().map_err(|error| error.to_string())?;
    win32::window::show_without_activating(island);
    Ok(())
}

pub(crate) fn set_click_activation(window: &WebviewWindow, activates: bool) {
    if let Ok(island) = window.hwnd() {
        win32::window::set_no_activate(island, !activates);
    }
}

pub(crate) fn island_mode_synced(window: &WebviewWindow, expanded: bool) {
    set_click_activation(window, expanded);
    if expanded {
        return;
    }
    let previous = CLICK_PREVIOUS_FOREGROUND.swap(0, Ordering::SeqCst);
    if previous == 0 {
        return;
    }
    let Ok(island) = window.hwnd() else {
        return;
    };
    let previous = HWND(previous as *mut _);
    if win32::window::foreground_window() == island && win32::window::is_visible(previous) {
        win32::window::bring_to_foreground(previous);
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
