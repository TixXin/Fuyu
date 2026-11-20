use tauri::{AppHandle, WebviewWindow};

pub(super) fn exclude(window: &WebviewWindow, excluded: bool) -> bool {
    window.hwnd().is_ok_and(|hwnd| crate::win32::window::exclude_from_capture(hwnd, excluded))
}

pub(super) fn show_clipboard(app: &AppHandle) {
    crate::clipboard_history::unprotect_for_recording(app);
}

pub(super) fn is_clipboard(label: &str) -> bool {
    crate::clipboard_history::is_clipboard_window(label)
}
