use std::sync::OnceLock;
use tauri::{AppHandle, WebviewWindow};

use super::state::{IslandGlassFrame, IslandWindowState};
use crate::win32;

pub(super) static NATIVE_GLASS_INITIALIZED: OnceLock<()> = OnceLock::new();

pub(super) fn clear_window_glass_region(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|error| error.to_string())?;
    if !win32::window::clear_window_region(hwnd) {
        return Err("Failed to clear the liquid glass window region.".to_string());
    }
    Ok(())
}

pub(super) fn apply_glass_material(
    window: &WebviewWindow,
    state: IslandWindowState,
    _frame: Option<IslandGlassFrame>,
) -> Result<String, String> {
    if NATIVE_GLASS_INITIALIZED.get().is_none() {
        let _ = window_vibrancy::clear_acrylic(window);
        clear_window_glass_region(window)?;
        let _ = NATIVE_GLASS_INITIALIZED.set(());
    }

    if state.glass_enabled {
        Ok("css-fallback".to_string())
    } else {
        Ok("disabled".to_string())
    }
}

pub(super) fn refresh_glass(_window: &WebviewWindow) {}

#[tauri::command]
pub fn sync_island_glass_frame(_app: AppHandle, _frame: IslandGlassFrame) -> Result<(), String> {
    Ok(())
}
