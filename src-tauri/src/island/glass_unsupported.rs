use tauri::WebviewWindow;

use super::state::IslandWindowState;

pub(super) fn apply_glass_material(_window: &WebviewWindow, state: IslandWindowState) -> Result<String, String> {
    Ok(if state.glass_enabled { "css-fallback" } else { "disabled" }.to_string())
}
