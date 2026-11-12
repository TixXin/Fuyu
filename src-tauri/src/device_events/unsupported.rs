use tauri::AppHandle;

pub(crate) fn init(_app: &AppHandle) {}

#[tauri::command]
pub fn set_device_alerts_enabled() {}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::device_events::set_device_alerts_enabled,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
