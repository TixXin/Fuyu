use tauri::{Runtime, Webview, WebviewWindow};

pub(crate) fn hidden<R: Runtime>(_window: &WebviewWindow<R>) {}

pub(crate) fn showing<R: Runtime>(_window: &WebviewWindow<R>) {}

pub(crate) fn page_loaded<R: Runtime>(_webview: &Webview<R>) {}
