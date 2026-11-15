use tauri::WebviewWindow;

use super::state::{IslandWindowState, MonitorFollow};
use crate::win32;

pub(super) fn followed_point(window: &WebviewWindow, state: IslandWindowState) -> Option<(i32, i32)> {
    match state.monitor_follow {
        MonitorFollow::Primary => None,
        MonitorFollow::Cursor => win32::window::cursor_position().map(|point| (point.x, point.y)),
        MonitorFollow::Foreground => {
            let foreground = win32::window::foreground_window();
            let own = window.hwnd().is_ok_and(|island| island == foreground)
                || win32::process::window_process_id(foreground) == std::process::id();
            if own || foreground.is_invalid() {
                return None;
            }
            let rect = win32::window::window_rect(foreground)?;
            Some(((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2))
        }
    }
}
