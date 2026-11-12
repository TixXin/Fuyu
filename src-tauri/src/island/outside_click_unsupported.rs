#[tauri::command]
pub async fn set_island_outside_click_watch(watch: bool) -> Result<(), String> {
    let _ = watch;
    Ok(())
}
