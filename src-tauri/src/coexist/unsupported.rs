use serde_json::{json, Value};

pub(crate) fn init(_app: &tauri::AppHandle) {}

pub(crate) fn banner_visible(visible: bool) -> bool {
    visible
}

pub(crate) fn yielding() -> bool {
    false
}

#[tauri::command]
pub fn get_dev_priority() -> Value {
    json!({ "priority": "releaseFirst", "yielding": false, "releaseRunning": false, "releaseYields": false })
}

crate::user_error::unsupported_commands!(set_dev_priority);

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::coexist::get_dev_priority,
            crate::coexist::set_dev_priority,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
