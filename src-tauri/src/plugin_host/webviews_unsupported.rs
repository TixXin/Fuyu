use serde::Deserialize;
use serde_json::Value;
use tauri::AppHandle;

use super::view_specs::DEFAULT_WEBVIEW_HEIGHT;

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct WebviewBounds {}

pub(super) fn forget_plugin(_plugin_id: &str) {}

pub(super) fn page_height(height: Option<u32>) -> u32 {
    height.unwrap_or(DEFAULT_WEBVIEW_HEIGHT)
}

pub(super) fn post_from_plugin(_app: &AppHandle, _plugin_id: &str, _params: &Value) -> Result<Value, (u16, String)> {
    Err((501, crate::user_error::unsupported().to_string()))
}

#[tauri::command]
pub fn show_plugin_webview(app: AppHandle, id: String, view_id: String, bounds: WebviewBounds, locale: String, ink: Option<String>) -> Result<(), String> {
    let _ = (app, id, view_id, bounds, locale, ink);
    Err(crate::user_error::unsupported().to_string())
}

#[tauri::command]
pub fn hide_plugin_webview(app: AppHandle, id: String, view_id: String) -> Result<(), String> {
    let _ = (app, id, view_id);
    Ok(())
}
