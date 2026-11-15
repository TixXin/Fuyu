use std::sync::OnceLock;

use tauri::{webview::PlatformWebview, Runtime, Webview, WebviewWindow};

use crate::win32::webview_memory;

const ENV_FLAG: &str = "FUYU_WEBVIEW_LOW_MEMORY";

fn enabled() -> bool {
    static ENABLED: OnceLock<bool> = OnceLock::new();
    *ENABLED.get_or_init(|| flag_on(std::env::var(ENV_FLAG).ok().as_deref()))
}

fn flag_on(value: Option<&str>) -> bool {
    value.is_some_and(|value| value.trim() == "1")
}

fn is_target(label: &str) -> bool {
    label == crate::translation::WINDOW_LABEL || label == crate::clipboard_history::POPUP_WINDOW_LABEL
}

pub(crate) fn hidden<R: Runtime>(window: &WebviewWindow<R>) {
    if enabled() {
        report(window.with_webview(set_level(window.label(), true)));
    }
}

pub(crate) fn showing<R: Runtime>(window: &WebviewWindow<R>) {
    if enabled() {
        report(window.with_webview(set_level(window.label(), false)));
    }
}

pub(crate) fn page_loaded<R: Runtime>(webview: &Webview<R>) {
    if enabled() && is_target(webview.label()) && !webview.window().is_visible().unwrap_or(true) {
        report(webview.with_webview(set_level(webview.label(), true)));
    }
}

fn set_level(label: &str, low: bool) -> impl FnOnce(PlatformWebview) + Send + 'static {
    let label = label.to_string();
    move |platform| {
        if let Err(error) = webview_memory::set_low(&platform.controller(), low) {
            eprintln!("webview memory level for {label}: {error}");
        }
    }
}

fn report(result: tauri::Result<()>) {
    if let Err(error) = result {
        eprintln!("webview memory level: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::flag_on;

    #[test]
    fn only_one_turns_the_flag_on() {
        assert!(flag_on(Some("1")));
        assert!(flag_on(Some(" 1 ")));
        assert!(!flag_on(None));
        assert!(!flag_on(Some("")));
        assert!(!flag_on(Some("0")));
        assert!(!flag_on(Some("true")));
    }
}
