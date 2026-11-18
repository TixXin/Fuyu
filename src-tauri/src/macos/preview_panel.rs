use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{Manager, WebviewWindow};
use tauri_nspanel::ManagerExt;

static CAN_BECOME_KEY: AtomicBool = AtomicBool::new(false);

pub(super) fn can_become_key() -> bool {
    CAN_BECOME_KEY.load(Ordering::SeqCst)
}

pub(super) fn reset_can_become_key() {
    CAN_BECOME_KEY.store(false, Ordering::SeqCst);
}

pub(crate) fn take_keys(window: &WebviewWindow, on: bool) {
    CAN_BECOME_KEY.store(on, Ordering::SeqCst);
    let app = window.app_handle();
    let label = window.label();
    if app.get_webview_panel(label).is_err() {
        if let Err(error) = super::island_panel::make_preview_panel(window) {
            eprintln!("failed to create the clipboard preview panel: {error}");
            return;
        }
        CAN_BECOME_KEY.store(on, Ordering::SeqCst);
    }
    if let Ok(panel) = app.get_webview_panel(label) {
        if on {
            panel.make_key_and_order_front();
        } else {
            panel.resign_key_window();
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::Ordering;

    use super::{can_become_key, reset_can_become_key, CAN_BECOME_KEY};

    #[test]
    fn preview_key_flag_defaults_false_and_resets() {
        reset_can_become_key();
        assert!(!can_become_key());
        CAN_BECOME_KEY.store(true, Ordering::SeqCst);
        assert!(can_become_key());
        reset_can_become_key();
        assert!(!can_become_key());
    }
}
