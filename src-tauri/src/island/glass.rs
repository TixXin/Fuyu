use tauri::{
    ipc::{Channel, InvokeResponseBody},
    AppHandle, WebviewWindow,
};

use super::glass_capture::{self, GlassCaptureStart};
use super::state::{IslandGlassFrame, IslandWindowState};

pub(super) fn apply_glass_material(
    _window: &WebviewWindow,
    state: IslandWindowState,
    _frame: Option<IslandGlassFrame>,
) -> Result<String, String> {
    glass_capture::wake();
    if state.glass_enabled {
        Ok("css-fallback".to_string())
    } else {
        Ok("disabled".to_string())
    }
}

pub(super) fn refresh_glass(_window: &WebviewWindow) {
    glass_capture::wake();
}

pub(super) fn exclude_from_backdrop(window: &WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        crate::win32::desktop_duplication::exclude_from_duplication(hwnd, true);
    }
}

#[tauri::command]
pub fn sync_island_glass_frame(_app: AppHandle, _frame: IslandGlassFrame) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn start_glass_capture(
    app: AppHandle,
    on_frame: Channel<InvokeResponseBody>,
    blur: f32,
    saturation: f32,
) -> Result<GlassCaptureStart, String> {
    let window = super::main_window(&app)?;
    let scale = window.scale_factor().map_err(|error| error.to_string())? as f32;
    let hwnd = window.hwnd().map_err(|error| error.to_string())?;
    glass_capture::set_options(blur, saturation, Some(scale));
    Ok(glass_capture::start(hwnd, on_frame, scale))
}

#[tauri::command]
pub fn set_glass_capture_options(app: AppHandle, blur: f32, saturation: f32) {
    let scale = super::main_window(&app).ok().and_then(|window| window.scale_factor().ok()).map(|scale| scale as f32);
    glass_capture::set_options(blur, saturation, scale);
}

#[tauri::command]
pub fn stop_glass_capture(app: AppHandle) {
    glass_capture::stop(super::main_window(&app).ok().and_then(|window| window.hwnd().ok()));
}
