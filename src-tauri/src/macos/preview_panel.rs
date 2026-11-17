use tauri::{Manager, WebviewWindow};
use tauri_nspanel::{tauri_panel, WebviewWindowExt};

tauri_panel! {
    panel!(EditingPreviewPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

pub(crate) fn take_keys(window: &WebviewWindow, on: bool) {
    super::island_panel::forget_panel(window.app_handle(), window.label());
    let swapped = if on {
        window
            .to_panel::<EditingPreviewPanel>()
            .map_err(|error| error.to_string())
            .and_then(|panel| {
                super::island_panel::float_above_island(window, panel.clone())?;
                panel.make_key_and_order_front();
                Ok(())
            })
    } else {
        super::island_panel::make_preview_panel(window)
    };
    if let Err(error) = swapped {
        eprintln!("failed to switch the clipboard preview panel: {error}");
    }
}
