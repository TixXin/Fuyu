mod dock;
mod layout;
mod preview;
mod snapshot;

use tauri::WebviewWindow;

use crate::{user_error::UserError, win32::taskbar_shell};

pub(crate) use dock::{current, reserve, resize_reserved, set_preferred, set_raised, undock, DockState, DockStatus};
pub(crate) use layout::{BarEdge, Rect};
pub(crate) use preview::{drop_at, forget as forget_preview, DropSpot};
pub use snapshot::TaskbarLayout;

pub(crate) fn supported() -> bool {
    taskbar_shell::is_windows_11()
}

#[tauri::command]
pub async fn get_taskbar_layout() -> Vec<TaskbarLayout> {
    if !supported() {
        return Vec::new();
    }
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
    undock(&window);
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
