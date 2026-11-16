use tauri::WebviewWindow;
use tauri_nspanel::{tauri_panel, WebviewWindowExt};

use super::island_panel::PreviewPanel;

tauri_panel! {
    panel!(EditingPreviewPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

pub(crate) fn take_keys(window: &WebviewWindow, on: bool) {
    let swapped = if on { window.to_panel::<EditingPreviewPanel>() } else { window.to_panel::<PreviewPanel>() };
    match swapped {
        Ok(panel) if on => panel.make_key_and_order_front(),
        Ok(_) => {}
        Err(error) => eprintln!("failed to switch the clipboard preview panel: {error}"),
    }
}
