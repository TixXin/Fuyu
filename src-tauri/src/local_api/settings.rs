use arboard::Clipboard;
#[cfg(target_os = "macos")]
use arboard::SetExtApple;
#[cfg(windows)]
use arboard::SetExtWindows;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalApiInfo {
    running: bool,
    url: String,
    config_path: String,
}

fn info(status: super::LocalApiStatus) -> LocalApiInfo {
    LocalApiInfo { running: super::server::running_port().is_some(), url: status.url, config_path: status.config_path }
}

#[tauri::command]
pub fn get_local_api_info() -> Result<LocalApiInfo, String> {
    super::status().map(info)
}

#[tauri::command]
pub async fn reset_local_api_token() -> Result<LocalApiInfo, String> {
    super::reset_token().map(info)
}

#[tauri::command]
pub async fn copy_local_api_token() -> Result<(), String> {
    let token = super::status()?.token;
    if token.is_empty() {
        return Err("The local API has no access token yet.".into());
    }
    let mut clipboard = Clipboard::new().map_err(|error| format!("Could not open the clipboard: {error}"))?;
    let set = clipboard.set();
    #[cfg(windows)]
    let set = set.exclude_from_monitoring();
    #[cfg(target_os = "macos")]
    let set = set.exclude_from_history();
    set.text(token).map_err(|error| format!("Could not write the clipboard: {error}"))
}
