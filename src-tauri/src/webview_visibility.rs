use tauri::{Manager, Runtime, Webview};

use crate::{
    home_dir::panic_log::{append_capped, now_text},
    win32::webview_visibility,
};

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
    let log = crate::home_dir::fuyu_home(webview.app_handle().path())
        .ok()
        .map(|home| home.join(crate::webview_recovery::FILE_NAME));
    let healed_label = label.clone();
    let healed = move |reason: &'static str| {
        if let Some(log) = &log {
            append_capped(log, &restored_line(&now_text(), &healed_label, reason));
        }
    };
    let result = webview.with_webview(move |platform| {
        if let Err(error) = webview_visibility::follow_window(window, platform.controller(), sync_initial, healed) {
            eprintln!("webview visibility for {label}: {error}");
        }
    });
    if let Err(error) = result {
        eprintln!("webview visibility: {error}");
    }
}

fn restored_line(time: &str, label: &str, reason: &str) -> String {
    format!("{time} {label} webview-visibility-restored after={reason}\n")
}

#[cfg(test)]
mod tests {
    use super::{restored_line, sync_initial_for};

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

    #[test]
    fn a_restored_visibility_is_logged_with_time_window_and_trigger() {
        assert_eq!(
            restored_line("2026-11-27 10:00:00+08:00", "settings", "activated"),
            "2026-11-27 10:00:00+08:00 settings webview-visibility-restored after=activated\n"
        );
    }
}
