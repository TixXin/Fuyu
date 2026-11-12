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

crate::user_error::unsupported_commands!(
    get_qq_notification_state,
    request_qq_notification_access,
    open_qq_notification_settings,
    clear_qq_notifications,
    open_qq,
);

#[tauri::command]
pub fn set_qq_notifications_enabled() {}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::qq_notifications::get_qq_notification_state,
            crate::qq_notifications::set_qq_notifications_enabled,
            crate::qq_notifications::request_qq_notification_access,
            crate::qq_notifications::open_qq_notification_settings,
            crate::qq_notifications::clear_qq_notifications,
            crate::qq_notifications::open_qq,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
