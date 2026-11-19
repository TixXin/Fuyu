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

pub(super) fn exclude_from_backdrop(_window: &WebviewWindow) {}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlassCaptureStart {
    started: bool,
    reason: Option<&'static str>,
}

#[tauri::command]
pub fn start_glass_capture(
    _on_frame: tauri::ipc::Channel<tauri::ipc::InvokeResponseBody>,
    _blur: f32,
    _saturation: f32,
) -> GlassCaptureStart {
    GlassCaptureStart { started: false, reason: Some("unsupported") }
}

#[tauri::command]
pub fn set_glass_capture_options(_blur: f32, _saturation: f32) {}

#[tauri::command]
pub fn stop_glass_capture() {}
