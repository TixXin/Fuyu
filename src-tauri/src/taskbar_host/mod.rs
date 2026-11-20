mod dock;
mod layout;
mod snapshot;

use tauri::WebviewWindow;

use crate::{user_error::UserError, win32::taskbar_shell};

pub use snapshot::TaskbarLayout;

#[tauri::command]
pub async fn get_taskbar_layout() -> Vec<TaskbarLayout> {
    let auto_hide = taskbar_shell::auto_hide_enabled();
    snapshot::read()
        .iter()
        .map(|bar| bar.describe(auto_hide, dock::margin(bar.rect, bar.edge)))
        .collect()
}

#[tauri::command]
pub async fn taskbar_dock(window: WebviewWindow, width: f64, order: Option<u8>) -> Result<(), UserError> {
    Ok(dock::dock(window, width, order.unwrap_or(0))?)
}

#[tauri::command]
pub async fn taskbar_undock(window: WebviewWindow) {
    dock::undock(&window);
}

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
