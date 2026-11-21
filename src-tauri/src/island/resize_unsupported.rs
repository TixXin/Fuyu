use tauri::AppHandle;

#[tauri::command]
pub fn start_island_resize(app: AppHandle, width_sign: i8, height: bool, reach: Option<serde_json::Value>) -> Result<(), String> {
    let _ = (app, width_sign, height, reach);
    Ok(())
}

pub(super) fn is_resizing() -> bool {
    false
}
