use tauri::{AppHandle, Manager, WebviewWindow};
use windows::Win32::Foundation::HWND;

use super::focus_slots::FocusSlots;
use super::main_window;
use crate::win32;

static FOCUS_SLOTS: FocusSlots = FocusSlots::new();

fn hwnd_target(window: HWND) -> isize {
    if window.is_invalid() {
        0
    } else {
        window.0 as isize
    }
}

fn restore_foreground(island: HWND, target: isize) {
    let previous = HWND(target as *mut _);
    if win32::window::foreground_window() == island && win32::window::is_visible(previous) {
        win32::window::bring_to_foreground(previous);
    }
}

fn take_focus(app: &AppHandle, note: impl FnOnce(isize)) -> Result<bool, String> {
    if win32::input::is_left_button_down() {
        return Ok(false);
    }
    let window = main_window(app)?;
    let island = window.hwnd().map_err(|error| error.to_string())?;
    let foreground = win32::window::foreground_window();
    if foreground == island {
        note(0);
        return Ok(true);
    }
    if !win32::window::activate_from_background(island) {
        return Ok(true);
    }
    note(hwnd_target(foreground));
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn take_island_hover_focus(app: AppHandle) -> Result<bool, String> {
    take_focus(&app, |target| FOCUS_SLOTS.note_hover(target))
}

#[tauri::command]
pub fn take_island_click_focus(app: AppHandle) -> Result<bool, String> {
    take_focus(&app, |target| FOCUS_SLOTS.note_expanded(target))
}

pub(crate) fn focus_island_for_shortcut(window: &WebviewWindow) {
    set_click_activation(window, true);
    let Ok(island) = window.hwnd() else {
        return;
    };
    let foreground = win32::window::foreground_window();
    if foreground == island {
        FOCUS_SLOTS.note_expanded(0);
        let _ = window.set_focus();
        return;
    }
    let activated = win32::window::activate_from_background(island);
    let _ = window.set_focus();
    if activated || win32::window::foreground_window() == island {
        FOCUS_SLOTS.note_expanded(hwnd_target(foreground));
    }
}

pub(crate) fn show_island_at_startup(window: &WebviewWindow) -> Result<(), String> {
    let island = window.hwnd().map_err(|error| error.to_string())?;
    let previous = win32::window::foreground_window();
    window.show().map_err(|error| error.to_string())?;
    if previous != island
        && !previous.is_invalid()
        && win32::window::foreground_window() == island
        && win32::window::is_visible(previous)
    {
        win32::window::bring_to_foreground(previous);
    }
    crate::tray::refresh_now(window.app_handle());
    Ok(())
}

pub(crate) fn show_island(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    crate::tray::refresh_now(window.app_handle());
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
    let Some(previous) = FOCUS_SLOTS.take_expanded() else {
        return;
    };
    if let Ok(island) = window.hwnd() {
        restore_foreground(island, previous);
    }
}

#[tauri::command]
pub fn release_island_hover_focus(app: AppHandle) -> Result<bool, String> {
    if win32::input::is_left_button_down() {
        return Ok(false);
    }
    let Some(previous) = FOCUS_SLOTS.take_hover() else {
        return Ok(true);
    };
    let island = main_window(&app)?.hwnd().map_err(|error| error.to_string())?;
    restore_foreground(island, previous);
    Ok(true)
}

#[tauri::command]
pub fn island_is_foreground(app: AppHandle) -> Result<bool, String> {
    let island = main_window(&app)?.hwnd().map_err(|error| error.to_string())?;
    Ok(win32::window::foreground_window() == island)
}
