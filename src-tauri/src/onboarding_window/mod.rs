pub(crate) mod overlay;

use std::{thread, time::Duration};
use tauri::{AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, WebviewWindow, WebviewWindowBuilder, WindowEvent};

pub const WINDOW_LABEL: &str = "onboarding";

const SHOW_FALLBACK_DELAY: Duration = Duration::from_secs(2);
const DESKTOP_CLEAR_DELAY: Duration = Duration::from_millis(350);

pub fn open(app: &AppHandle, clear: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        return reveal(&window);
    }

    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == WINDOW_LABEL)
        .ok_or_else(|| "Onboarding window config was not found.".to_string())?
        .clone();
    let cleared = clear && clear_desktop(app);
    if cleared {
        thread::sleep(DESKTOP_CLEAR_DELAY);
    }
    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| error.to_string())?
        .visible(false)
        .build()
        .map_err(|error| error.to_string())?;
    if let Some(screen) = crate::settings_window::island_screen(app) {
        let (position, size) = overlay_area(&screen);
        let _ = window.set_position(position);
        let _ = window.set_size(size);
    }
    let _ = window.set_ignore_cursor_events(true);
    if cleared {
        let app = app.clone();
        window.on_window_event(move |event| {
            if matches!(event, WindowEvent::Destroyed) {
                restore_desktop(&app);
                keep_settings_in_front(&app);
            }
        });
    }
    overlay::start(app, window.clone());

    thread::spawn(move || {
        thread::sleep(SHOW_FALLBACK_DELAY);
        if !window.is_visible().unwrap_or(true) {
            let _ = reveal(&window);
        }
    });
    Ok(())
}

fn keep_settings_in_front(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(DESKTOP_CLEAR_DELAY);
        let settings = app
            .get_webview_window(crate::settings_window::WINDOW_LABEL)
            .filter(|settings| settings.is_visible().unwrap_or(false));
        if let Some(settings) = settings {
            let _ = settings.set_focus();
        }
    });
}

#[cfg(windows)]
fn clear_desktop(_app: &AppHandle) -> bool {
    crate::win32::desktop::minimize_all_windows()
}

#[cfg(windows)]
fn restore_desktop(_app: &AppHandle) {
    crate::win32::desktop::undo_minimize_all_windows();
}

#[cfg(target_os = "macos")]
fn clear_desktop(app: &AppHandle) -> bool {
    app.run_on_main_thread(crate::macos::desktop::hide_other_applications).is_ok()
}

#[cfg(target_os = "macos")]
fn restore_desktop(app: &AppHandle) {
    let _ = app.run_on_main_thread(crate::macos::desktop::unhide_all_applications);
}

#[cfg(target_os = "macos")]
fn overlay_area(screen: &Monitor) -> (PhysicalPosition<i32>, PhysicalSize<u32>) {
    (*screen.position(), *screen.size())
}

#[cfg(not(target_os = "macos"))]
fn overlay_area(screen: &Monitor) -> (PhysicalPosition<i32>, PhysicalSize<u32>) {
    let area = screen.work_area();
    (area.position, area.size)
}

fn reveal(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn open_onboarding_window(app: AppHandle, clear_desktop: Option<bool>) -> Result<(), String> {
    open(&app, clear_desktop.unwrap_or(false))
}

#[tauri::command]
pub async fn show_onboarding_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(WINDOW_LABEL)
        .ok_or_else(|| "Onboarding window was not found.".to_string())?;
    reveal(&window)
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::onboarding_window::open_onboarding_window,
            crate::onboarding_window::show_onboarding_window,
            crate::onboarding_window::overlay::set_onboarding_card_rects,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
