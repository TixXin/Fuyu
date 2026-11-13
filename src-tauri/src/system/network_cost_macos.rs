#[tauri::command]
pub async fn updater_metered() -> bool {
    tauri::async_runtime::spawn_blocking(|| crate::macos::network::is_metered().unwrap_or(false)).await.unwrap_or(false)
}
