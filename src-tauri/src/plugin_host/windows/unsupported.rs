use serde_json::Value;
use tauri::AppHandle;

#[cfg_attr(not(windows), allow(dead_code))]
pub(super) struct Caller<'a> {
    pub app: &'a AppHandle,
    pub plugin_id: &'a str,
    pub display_name: &'a str,
}

pub(super) fn answer(_caller: Caller<'_>, _method: &str, _params: &Value) -> Result<Value, (u16, String)> {
    Err((501, "Plugin windows are not supported on this system yet.".into()))
}

pub(super) fn has_any(_plugin_id: &str) -> bool {
    false
}

pub(super) fn close_plugin(_app: &AppHandle, _plugin_id: &str) {}

pub(super) fn apply_rules(_app: &AppHandle, _plugin_id: &str) {}
