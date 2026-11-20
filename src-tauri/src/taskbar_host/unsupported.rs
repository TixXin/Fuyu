#[tauri::command]
pub fn get_taskbar_layout() -> Vec<()> {
    Vec::new()
}

#[tauri::command]
pub fn taskbar_undock() {}

crate::user_error::unsupported_commands!(taskbar_dock);

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::taskbar_host::get_taskbar_layout,
            crate::taskbar_host::taskbar_dock,
            crate::taskbar_host::taskbar_undock,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
