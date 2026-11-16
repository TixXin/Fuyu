use tauri::{Manager, WebviewWindow};
use tauri_nspanel::{tauri_panel, CollectionBehavior, ManagerExt, PanelLevel, StyleMask, WebviewWindowExt};

tauri_panel! {
    panel!(TrayCardPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

const LEVELS_ABOVE_MENU_BAR: i64 = 5;

pub(crate) fn make_tray_panel(window: &WebviewWindow) -> Result<(), String> {
    let panel = window.to_panel::<TrayCardPanel>().map_err(|error| error.to_string())?;
    panel.set_level(PanelLevel::MainMenu.value() + LEVELS_ABOVE_MENU_BAR);
    panel.set_collection_behavior(
        CollectionBehavior::new()
            .move_to_active_space()
            .full_screen_auxiliary()
            .ignores_cycle()
            .into(),
    );
    panel
        .add_style_mask(StyleMask::empty().nonactivating_panel().into())
        .map_err(|error| format!("Could not make the tray card a non-activating panel: {error:?}"))
}

pub(crate) fn show_tray_panel(window: &WebviewWindow) -> bool {
    let Ok(panel) = window.app_handle().get_webview_panel(window.label()) else {
        return false;
    };
    panel.show_and_make_key();
    true
}

pub(crate) fn hide_tray_panel(window: &WebviewWindow) -> bool {
    let Ok(panel) = window.app_handle().get_webview_panel(window.label()) else {
        return false;
    };
    panel.hide();
    true
}
