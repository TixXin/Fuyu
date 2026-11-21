use tauri::AppHandle;

#[tauri::command]
pub fn start_island_resize(app: AppHandle, width_sign: i8, height: bool) -> Result<(), String> {
    let _ = (app, width_sign, height);
    Ok(())
}

pub(super) fn is_resizing() -> bool {
    false
}
