//! Built-in screenshots (C41; plan in docs/architecture/screenshot-plan.md): the shortcuts, the
//! frozen picture of every monitor, the overlay windows where a region is chosen, and copying it.

mod hotkeys;
mod output;
mod session;
mod targets;
#[cfg(test)]
mod tests;

use tauri::{AppHandle, WebviewWindow};

pub(crate) use session::WINDOW_PREFIX;
use session::{OverlaySession, PixelRect};
use targets::LocalTarget;

pub(crate) fn init(app: &AppHandle) {
    hotkeys::start(app);
}

/// Closing an overlay (Alt+F4) cancels the screenshot instead.
pub(crate) fn cancel(app: &AppHandle) {
    session::end(app);
}

/// Turns the module on or off: its shortcuts, and the overlay windows kept ready while on.
#[tauri::command]
pub async fn screenshot_configure(app: AppHandle, enabled: bool) {
    hotkeys::set_enabled(enabled);
    if enabled {
        session::prepare(&app);
    }
}

/// The open screenshot as the calling overlay shows it, for an overlay that loaded late.
#[tauri::command]
pub fn screenshot_session(window: WebviewWindow) -> Option<OverlaySession> {
    session::current(window.label())
}

/// The calling overlay's monitor picture: RGBA, rows top to bottom, size from the session.
#[tauri::command]
pub async fn screenshot_frame(window: WebviewWindow) -> Result<tauri::ipc::Response, String> {
    session::frame(window.label())
        .map(tauri::ipc::Response::new)
        .ok_or_else(|| "No screenshot is open.".to_string())
}

/// What the calling overlay can snap to: windows, then controls once they are read.
#[tauri::command]
pub fn screenshot_targets(window: WebviewWindow) -> Vec<LocalTarget> {
    session::targets_for(window.label())
}

/// The calling overlay has drawn screenshot `session`'s picture and can be shown.
#[tauri::command]
pub fn screenshot_overlay_ready(window: WebviewWindow, session: u64) {
    session::overlay_ready(&window, session);
}

/// Copies `rect` of the calling overlay's picture and closes the screenshot.
#[tauri::command]
pub async fn screenshot_copy(app: AppHandle, window: WebviewWindow, rect: PixelRect) -> Result<(), String> {
    let (width, height, rgba) = session::selection(window.label(), rect).ok_or_else(|| "Nothing is selected.".to_string())?;
    session::end(&app);
    output::copy_image(width, height, rgba)
}

#[tauri::command]
pub fn screenshot_cancel(app: AppHandle) {
    session::end(&app);
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::screenshot::screenshot_configure,
            crate::screenshot::screenshot_session,
            crate::screenshot::screenshot_frame,
            crate::screenshot::screenshot_targets,
            crate::screenshot::screenshot_overlay_ready,
            crate::screenshot::screenshot_copy,
            crate::screenshot::screenshot_cancel,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
