use tauri::{Runtime, Webview};

use crate::win32::webview_visibility;

const KEEP_VISIBLE: &[&str] = &["main"];

fn follows(label: &str) -> bool {
    !KEEP_VISIBLE.contains(&label)
}

pub(crate) fn attach<R: Runtime>(webview: &Webview<R>) {
    let label = webview.label().to_string();
    if !follows(&label) {
        return;
    }
    let window = match webview.window().hwnd() {
        Ok(hwnd) => hwnd.0 as isize,
        Err(error) => return eprintln!("webview visibility for {label}: {error}"),
    };
    let result = webview.with_webview(move |platform| {
        if let Err(error) = webview_visibility::follow_window(window, platform.controller()) {
            eprintln!("webview visibility for {label}: {error}");
        }
    });
    if let Err(error) = result {
        eprintln!("webview visibility: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::follows;

    #[test]
    fn the_island_keeps_its_webview_visible() {
        assert!(!follows("main"));
        assert!(follows("clipboard"));
        assert!(follows("clipboard-preview"));
        assert!(follows("translation"));
        assert!(follows("tray-menu"));
        assert!(follows("screenshot-0"));
        assert!(follows("plugin-window-1"));
    }
}
