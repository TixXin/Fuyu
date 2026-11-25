use tauri::{Runtime, Webview};

use crate::win32::webview_visibility;

const DEFER_INITIAL_SYNC: &[&str] = &["main"];

fn sync_initial_for(label: &str) -> bool {
    !DEFER_INITIAL_SYNC.contains(&label)
}

pub(crate) fn attach<R: Runtime>(webview: &Webview<R>) {
    let label = webview.label().to_string();
    let sync_initial = sync_initial_for(&label);
    let window = match webview.window().hwnd() {
        Ok(hwnd) => hwnd.0 as isize,
        Err(error) => return eprintln!("webview visibility for {label}: {error}"),
    };
    let result = webview.with_webview(move |platform| {
        if let Err(error) = webview_visibility::follow_window(window, platform.controller(), sync_initial) {
            eprintln!("webview visibility for {label}: {error}");
        }
    });
    if let Err(error) = result {
        eprintln!("webview visibility: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::sync_initial_for;

    #[test]
    fn the_island_defers_initial_sync_while_auxiliary_windows_sync_immediately() {
        assert!(!sync_initial_for("main"));
        assert!(sync_initial_for("clipboard"));
        assert!(sync_initial_for("clipboard-preview"));
        assert!(sync_initial_for("translation"));
        assert!(sync_initial_for("tray-menu"));
        assert!(sync_initial_for("screenshot-0"));
        assert!(sync_initial_for("plugin-window-1"));
    }
}
