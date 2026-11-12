use tauri::AppHandle;

pub(crate) fn init(_app: &AppHandle) {}

#[tauri::command]
pub fn set_level_popup_enabled() {}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::system_levels::set_level_popup_enabled,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
