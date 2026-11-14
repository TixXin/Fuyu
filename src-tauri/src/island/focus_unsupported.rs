use tauri::{AppHandle, WebviewWindow};

use super::main_window;

#[tauri::command]
pub fn take_island_hover_focus() -> Result<bool, String> {
    Ok(false)
}

#[tauri::command]
pub fn release_island_hover_focus() -> Result<bool, String> {
    Ok(true)
}

#[tauri::command]
pub fn island_is_foreground(app: AppHandle) -> Result<bool, String> {
    main_window(&app)?.is_focused().map_err(|error| error.to_string())
}

pub(crate) fn show_island_at_startup(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

pub(crate) fn focus_island_for_shortcut(window: &WebviewWindow) {
    let _ = window.set_focus();
}
