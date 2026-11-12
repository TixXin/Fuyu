use tauri::WebviewWindow;

#[tauri::command]
pub fn set_island_cursor_tracking(enabled: bool) {
    let _ = enabled;
}

pub(crate) fn start_cursor_passthrough_loop(_window: WebviewWindow) {}
