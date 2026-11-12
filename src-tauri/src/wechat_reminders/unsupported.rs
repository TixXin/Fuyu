use serde_json::Value;
use tauri::AppHandle;

pub fn init(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}

pub(crate) fn diagnostic_state() -> Result<Value, String> {
    Err(crate::user_error::unsupported().to_string())
}

pub(crate) fn plugin_messages() -> Vec<Value> {
    Vec::new()
}

pub(crate) fn shutdown() {}

crate::user_error::unsupported_commands!(
    open_wechat,
    clear_wechat_reminders,
);

#[tauri::command]
pub fn set_wechat_reminders_enabled() {}

#[tauri::command]
pub fn set_wechat_expose_ui() {}

#[tauri::command]
pub fn set_wechat_hide_taskbar_button() {}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::wechat_reminders::set_wechat_reminders_enabled,
            crate::wechat_reminders::open_wechat,
            crate::wechat_reminders::set_wechat_expose_ui,
            crate::wechat_reminders::set_wechat_hide_taskbar_button,
            crate::wechat_reminders::clear_wechat_reminders,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
