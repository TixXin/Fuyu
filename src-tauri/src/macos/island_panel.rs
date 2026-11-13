use tauri::WebviewWindow;
use tauri_nspanel::{tauri_panel, CollectionBehavior, PanelLevel, StyleMask, WebviewWindowExt};

tauri_panel! {
    panel!(IslandPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })

    panel!(OverlayPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

const LEVELS_ABOVE_MENU_BAR: i64 = 3;
const OVERLAY_ABOVE_ISLAND: i64 = 1;

pub(crate) fn make_overlay_panel(window: &WebviewWindow) -> Result<(), String> {
    let panel = window.to_panel::<OverlayPanel>().map_err(|error| error.to_string())?;
    panel.set_level(PanelLevel::MainMenu.value() + LEVELS_ABOVE_MENU_BAR + OVERLAY_ABOVE_ISLAND);
    panel.set_collection_behavior(
        CollectionBehavior::new()
            .can_join_all_spaces()
            .stationary()
            .full_screen_auxiliary()
            .ignores_cycle()
            .into(),
    );
    panel.set_has_shadow(false);
    panel
        .add_style_mask(StyleMask::empty().nonactivating_panel().into())
        .map_err(|error| format!("Could not make the screenshot overlay a non-activating panel: {error:?}"))
}

pub(crate) fn make_panel(window: &WebviewWindow) -> Result<(), String> {
    let panel = window.to_panel::<IslandPanel>().map_err(|error| error.to_string())?;
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
    panel
        .add_style_mask(StyleMask::empty().nonactivating_panel().into())
        .map_err(|error| format!("Could not make the island a non-activating panel: {error:?}"))
}
