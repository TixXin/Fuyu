#[tauri::command]
pub fn get_launch_at_startup() -> Result<bool, String> {
    Ok(false)
}

#[tauri::command]
pub fn set_launch_at_startup(enabled: bool) -> Result<(), String> {
    crate::dev_lane::refuse_in_preview("change launch at startup")?;
    let _ = enabled;
    Err(crate::user_error::unsupported().to_string())
}
