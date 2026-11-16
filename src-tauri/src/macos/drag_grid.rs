use tauri::{Manager, WebviewWindow};
use tauri_nspanel::{tauri_panel, CollectionBehavior, ManagerExt, PanelLevel, StyleMask, WebviewWindowExt};

tauri_panel! {
    panel!(DragGridPanel {
        config: {
            can_become_key_window: false,
            is_floating_panel: true
        }
    })
}

const LEVELS_ABOVE_MENU_BAR: i64 = 2;

pub(crate) fn make_grid_panel(window: &WebviewWindow) -> Result<(), String> {
    let panel = window.to_panel::<DragGridPanel>().map_err(|error| error.to_string())?;
    panel.set_level(PanelLevel::MainMenu.value() + LEVELS_ABOVE_MENU_BAR);
    panel.set_collection_behavior(
        CollectionBehavior::new()
            .can_join_all_spaces()
            .stationary()
            .full_screen_auxiliary()
            .ignores_cycle()
            .into(),
    );
    panel.set_has_shadow(false);
    panel.set_ignores_mouse_events(true);
    panel
        .add_style_mask(StyleMask::empty().nonactivating_panel().into())
        .map_err(|error| format!("Could not make the drag grid a non-activating panel: {error:?}"))
}

pub(crate) fn show_grid_panel(window: &WebviewWindow) -> bool {
    let Ok(panel) = window.app_handle().get_webview_panel(window.label()) else {
        return false;
    };
    panel.show();
    true
}

pub(crate) fn hide_grid_panel(window: &WebviewWindow) -> bool {
    let Ok(panel) = window.app_handle().get_webview_panel(window.label()) else {
        return false;
    };
    panel.hide();
    true
}
