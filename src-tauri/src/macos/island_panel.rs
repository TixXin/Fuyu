use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication};
use tauri::{Manager, WebviewWindow};
use tauri_nspanel::{tauri_panel, CollectionBehavior, ManagerExt, PanelHandle, PanelLevel, StyleMask, WebviewWindowExt};

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

    panel!(PreviewPanel {
        config: {
            can_become_key_window: false,
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

static HOVER_KEY_LOOK: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

objc2::define_class!(
    #[unsafe(super(RawIslandPanel, objc2_app_kit::NSPanel, objc2_app_kit::NSWindow, objc2_app_kit::NSResponder, objc2_foundation::NSObject))]
    #[name = "FuyuHoveredIslandPanel"]
    struct HoveredIslandPanel;

    unsafe impl NSObjectProtocol for HoveredIslandPanel {}

    impl HoveredIslandPanel {
        #[unsafe(method(isKeyWindow))]
        fn is_key_window(&self) -> bool {
            let real: bool = unsafe { objc2::msg_send![super(self), isKeyWindow] };
            real || HOVER_KEY_LOOK.load(std::sync::atomic::Ordering::SeqCst)
        }

        #[unsafe(method(fuyuHasRealKey))]
        fn has_real_key(&self) -> bool {
            unsafe { objc2::msg_send![super(self), isKeyWindow] }
        }
    }
);

const LEVELS_ABOVE_MENU_BAR: i64 = 3;
const TOP_SPACE_CHECK: std::time::Duration = std::time::Duration::from_secs(2);
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
    float_above_island(window, window.to_panel::<PopupPanel>().map_err(|error| error.to_string())?)
}

pub(crate) fn make_preview_panel(window: &WebviewWindow) -> Result<(), String> {
    float_above_island(window, window.to_panel::<PreviewPanel>().map_err(|error| error.to_string())?)
}

fn float_above_island(window: &WebviewWindow, panel: PanelHandle<tauri::Wry>) -> Result<(), String> {
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

pub(crate) fn forget_panel<R: tauri::Runtime>(app: &tauri::AppHandle<R>, label: &str) {
    let _ = app.remove_webview_panel(label);
}

pub(crate) fn show_panel_without_key<R: tauri::Runtime>(app: &tauri::AppHandle<R>, label: &str) -> bool {
    let Ok(panel) = app.get_webview_panel(label) else {
        return false;
    };
    panel.show();
    true
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
        .map_err(|error| format!("Could not make the island a non-activating panel: {error:?}"))?;
    if let Err(error) = look_key_while_hovered(panel.as_panel()) {
        eprintln!("{error}");
    }
    Ok(())
}

fn look_key_while_hovered(panel: &objc2_app_kit::NSPanel) -> Result<(), String> {
    let object: &objc2::runtime::AnyObject = panel.as_ref();
    let from = <RawIslandPanel as objc2::ClassType>::class();
    let to = <HoveredIslandPanel as objc2::ClassType>::class();
    if !std::ptr::eq(object.class(), from) {
        return Err(format!("The island panel is a {}, so hover styles will need a click.", object.class().name().to_string_lossy()));
    }
    if from.instance_size() != to.instance_size() {
        return Err("The hovered island panel class has a different size, so hover styles will need a click.".to_string());
    }
    unsafe { objc2::runtime::AnyObject::set_class(object, to) };
    Ok(())
}

pub(crate) fn set_hover_key_look<R: tauri::Runtime>(app: &tauri::AppHandle<R>, label: &str, on: bool) {
    if HOVER_KEY_LOOK.swap(on, std::sync::atomic::Ordering::SeqCst) == on || !on {
        return;
    }
    let handle = app.clone();
    let label = label.to_string();
    let _ = app.run_on_main_thread(move || {
        if island_has_real_key(&handle, &label) {
            return;
        }
        let Ok(panel) = handle.get_webview_panel(&label) else {
            return;
        };
        let center = objc2_foundation::NSNotificationCenter::defaultCenter();
        unsafe { center.postNotificationName_object(objc2_app_kit::NSWindowDidBecomeKeyNotification, Some(panel.as_panel())) };
    });
}

pub(crate) fn island_has_real_key<R: tauri::Runtime>(app: &tauri::AppHandle<R>, label: &str) -> bool {
    let Ok(panel) = app.get_webview_panel(label) else {
        return false;
    };
    let window = panel.as_panel();
    let hovered: bool = unsafe { objc2::msg_send![window, respondsToSelector: objc2::sel!(fuyuHasRealKey)] };
    if hovered {
        unsafe { objc2::msg_send![window, fuyuHasRealKey] }
    } else {
        window.isKeyWindow()
    }
}

pub(crate) fn keep_in_top_space(window: WebviewWindow) {
    let _ = std::thread::Builder::new().name("island-top-space".into()).spawn(move || loop {
        let target = window.clone();
        let _ = window.run_on_main_thread(move || pin_to_top_space(&target));
        std::thread::sleep(TOP_SPACE_CHECK);
    });
}

fn pin_to_top_space(window: &WebviewWindow) {
    let Ok(panel) = window.app_handle().get_webview_panel(window.label()) else {
        return;
    };
    if let Ok(number) = u32::try_from(panel.as_panel().windowNumber()) {
        if number > 0 {
            super::top_space::pin(number);
        }
    }
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
