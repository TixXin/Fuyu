use tauri::{AppHandle, WebviewWindow};

use super::state::{IslandGlassFrame, IslandWindowState};

pub(super) fn apply_glass_material(
    _window: &WebviewWindow,
    state: IslandWindowState,
    _frame: Option<IslandGlassFrame>,
) -> Result<String, String> {
    Ok(if state.glass_enabled { "css-fallback" } else { "disabled" }.to_string())
}

pub(super) fn refresh_glass(_window: &WebviewWindow) {}

#[tauri::command]
pub fn sync_island_glass_frame(_app: AppHandle, _frame: IslandGlassFrame) -> Result<(), String> {
    Ok(())
}
