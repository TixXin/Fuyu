use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Once;
use tauri::{AppHandle, Listener, Manager, WebviewWindow};

use super::banner_hit::ISLAND_BANNER_HOVER_CHANGED_EVENT;
use super::focus_slots::FocusSlots;
use super::{main_window, WINDOW_LABEL};
use crate::macos::{apps, input, island_panel};

const ISLAND_HOVER_CHANGED_EVENT: &str = "island-hover-changed";

static FOCUS_SLOTS: FocusSlots = FocusSlots::new();
static ON_ISLAND: AtomicBool = AtomicBool::new(false);
static ON_BANNER: AtomicBool = AtomicBool::new(false);
static FOLLOW_HOVER: Once = Once::new();

fn follow_hover(app: &AppHandle) {
    FOLLOW_HOVER.call_once(|| {
        for (event, flag) in [(ISLAND_HOVER_CHANGED_EVENT, &ON_ISLAND), (ISLAND_BANNER_HOVER_CHANGED_EVENT, &ON_BANNER)] {
            let handle = app.clone();
            app.listen_any(event, move |event| {
                flag.store(event.payload() == "true", Ordering::SeqCst);
                let hovered = ON_ISLAND.load(Ordering::SeqCst) || ON_BANNER.load(Ordering::SeqCst);
                island_panel::set_hover_key_look(&handle, WINDOW_LABEL, hovered);
            });
        }
    });
}

fn island_has_real_key(app: &AppHandle) -> bool {
    island_panel::island_has_real_key(app, WINDOW_LABEL)
}

fn other_frontmost_app() -> Option<i32> {
    let own = i32::try_from(std::process::id()).ok();
    apps::frontmost_pid().filter(|pid| Some(*pid) != own)
}

fn other_frontmost_target() -> isize {
    other_frontmost_app().map_or(0, |pid| pid as isize)
}

#[tauri::command]
pub fn take_island_hover_focus(app: AppHandle) -> Result<bool, String> {
    if input::is_left_button_down() {
        return Ok(false);
    }
    if island_has_real_key(&app) {
        return Ok(true);
    }
    if let Some(pid) = other_frontmost_app() {
        FOCUS_SLOTS.note_hover(pid as isize);
    }
    let handle = app.clone();
    app.run_on_main_thread(move || {
        if let Err(error) = island_panel::make_island_key(&handle, WINDOW_LABEL) {
            eprintln!("{error}");
        }
    })
    .map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn release_island_hover_focus(app: AppHandle) -> Result<bool, String> {
    if input::is_left_button_down() {
        return Ok(false);
    }
    let Some(previous) = FOCUS_SLOTS.take_hover().and_then(|pid| i32::try_from(pid).ok()) else {
        return Ok(true);
    };
    if !island_has_real_key(&app) {
        return Ok(true);
    }
    let handle = app.clone();
    app.run_on_main_thread(move || island_panel::hand_key_back(&handle, WINDOW_LABEL, previous))
        .map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn island_is_foreground(app: AppHandle) -> Result<bool, String> {
    main_window(&app)?.is_focused().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn take_island_click_focus() -> Result<bool, String> {
    Ok(true)
}

pub(crate) fn set_click_activation(_window: &WebviewWindow, _activates: bool) {}

pub(crate) fn island_mode_synced(window: &WebviewWindow, expanded: bool) {
    super::watch::note_interaction_ready();
    if expanded {
        return;
    }
    let Some(previous) = FOCUS_SLOTS.take_expanded().and_then(|pid| i32::try_from(pid).ok()) else {
        return;
    };
    let app = window.app_handle().clone();
    let _ = window.run_on_main_thread(move || {
        if island_has_real_key(&app) {
            island_panel::hand_key_back(&app, WINDOW_LABEL, previous);
        }
    });
}

pub(crate) fn show_island_at_startup(window: &WebviewWindow) -> Result<(), String> {
    let app = window.app_handle().clone();
    follow_hover(&app);
    let fallback = window.clone();
    window
        .run_on_main_thread(move || {
            if !island_panel::show_panel_without_key(&app, WINDOW_LABEL) {
                if let Err(error) = fallback.show() {
                    eprintln!("could not show the island at startup: {error}");
                }
            }
            crate::tray::refresh_now(&app);
        })
        .map_err(|error| error.to_string())
}

pub(crate) fn show_island(window: &WebviewWindow) -> Result<(), String> {
    let app = window.app_handle().clone();
    follow_hover(&app);
    FOCUS_SLOTS.note_expanded(other_frontmost_target());
    let fallback = window.clone();
    window
        .run_on_main_thread(move || {
            if !island_panel::show_panel_without_key(&app, WINDOW_LABEL) {
                if let Err(error) = fallback.show() {
                    eprintln!("could not show the island: {error}");
                }
            }
            let _ = island_panel::make_island_key(&app, WINDOW_LABEL);
            crate::tray::refresh_now(&app);
        })
        .map_err(|error| error.to_string())
}

pub(crate) fn focus_island_for_shortcut(window: &WebviewWindow) {
    let app = window.app_handle().clone();
    follow_hover(&app);
    FOCUS_SLOTS.note_expanded(other_frontmost_target());
    let fallback = window.clone();
    let _ = window.run_on_main_thread(move || {
        if !island_panel::show_panel_without_key(&app, WINDOW_LABEL) {
            let _ = fallback.show();
        }
        if let Err(error) = island_panel::make_island_key(&app, WINDOW_LABEL) {
            eprintln!("{error}");
            let _ = fallback.set_focus();
        }
    });
}
