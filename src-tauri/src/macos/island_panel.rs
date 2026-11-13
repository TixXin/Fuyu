use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication};
use tauri::WebviewWindow;
use tauri_nspanel::{tauri_panel, CollectionBehavior, ManagerExt, PanelLevel, StyleMask, WebviewWindowExt};

tauri_panel! {
    panel!(IslandPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })

    panel!(PopupPanel {
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

pub(crate) fn make_overlay_panel(window: &WebviewWindow) -> Result<u32, String> {
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
        .map_err(|error| format!("Could not make the screenshot overlay a non-activating panel: {error:?}"))?;
    u32::try_from(panel.as_panel().windowNumber()).map_err(|_| "The screenshot overlay has no window number yet.".to_string())
}

const POPUP_ABOVE_ISLAND: i64 = 1;

pub(crate) fn make_popup_panel(window: &WebviewWindow) -> Result<(), String> {
    let panel = window.to_panel::<PopupPanel>().map_err(|error| error.to_string())?;
    panel.set_level(PanelLevel::MainMenu.value() + LEVELS_ABOVE_MENU_BAR + POPUP_ABOVE_ISLAND);
    panel.set_collection_behavior(
        CollectionBehavior::new()
            .move_to_active_space()
            .full_screen_auxiliary()
            .ignores_cycle()
            .into(),
    );
    panel
        .add_style_mask(StyleMask::empty().nonactivating_panel().into())
        .map_err(|error| format!("Could not make {} a non-activating panel: {error:?}", window.label()))
}

pub(crate) fn make_panel_key<R: tauri::Runtime>(app: &tauri::AppHandle<R>, label: &str) -> bool {
    let Ok(panel) = app.get_webview_panel(label) else {
        return false;
    };
    panel.make_key_and_order_front();
    true
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

pub(crate) fn make_island_key<R: tauri::Runtime>(app: &tauri::AppHandle<R>, label: &str) -> Result<(), String> {
    let panel = app.get_webview_panel(label).map_err(|error| format!("The island panel is missing: {error:?}"))?;
    panel.make_key_window();
    Ok(())
}

pub(crate) fn hand_key_back<R: tauri::Runtime>(app: &tauri::AppHandle<R>, label: &str, pid: i32) {
    if let Ok(panel) = app.get_webview_panel(label) {
        panel.resign_key_window();
    }
    if let Some(running) = NSRunningApplication::runningApplicationWithProcessIdentifier(pid) {
        running.activateWithOptions(NSApplicationActivationOptions::empty());
    }
}
