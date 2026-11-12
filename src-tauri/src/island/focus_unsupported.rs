use tauri::AppHandle;

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
