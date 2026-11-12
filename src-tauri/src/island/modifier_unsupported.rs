use tauri::WebviewWindow;

#[tauri::command]
pub fn set_island_panel_resizable(resizable: bool) {
    let _ = resizable;
}

pub(super) fn start_resize(_window: &WebviewWindow) -> bool {
    false
}
