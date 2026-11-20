use tauri::{AppHandle, WebviewWindow};

pub(super) fn exclude(_window: &WebviewWindow, _excluded: bool) -> bool {
    false
}

pub(super) fn show_clipboard(_app: &AppHandle) {}

pub(super) fn is_clipboard(_label: &str) -> bool {
    false
}
