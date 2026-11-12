use serde::Deserialize;
use tauri::AppHandle;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalHotkey {}

#[tauri::command]
pub fn set_agent_approval_hotkeys(app: AppHandle, hotkeys: Vec<ApprovalHotkey>) {
    let _ = (app, hotkeys);
}
