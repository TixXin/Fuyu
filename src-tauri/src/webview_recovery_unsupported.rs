use tauri::{Runtime, Webview};

pub(crate) const FILE_NAME: &str = "webview-crashes.log";

pub(crate) fn attach<R: Runtime>(_webview: &Webview<R>) {
    crate::home_dir::panic_log::install();
}
