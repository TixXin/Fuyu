use tauri::{Runtime, Webview, Window};

pub(crate) fn attach<R: Runtime>(_webview: &Webview<R>) {}

pub(crate) fn follow<R: Runtime>(_window: &Window<R>, _scale: f64) {}
