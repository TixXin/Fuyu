//! The first-run guide's window (`?window=onboarding`): language, theme, modules and a few
//! choices, built on demand like the settings window and closed when the guide is done.

use std::{thread, time::Duration};
use tauri::{AppHandle, Manager, Monitor, PhysicalPosition, WebviewWindow, WebviewWindowBuilder};

pub const WINDOW_LABEL: &str = "onboarding";

/// Shows a new guide window even if its page never reports in, so it cannot stay invisible.
const SHOW_FALLBACK_DELAY: Duration = Duration::from_secs(2);

/// Opens the guide, or brings an open one to the front. A new window starts hidden and the
/// page shows it after its first paint (show_onboarding_window), centered on the island's screen.
pub fn open(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        let _ = window.unminimize();
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
    let (width, height) = (config.width, config.height);
    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| error.to_string())?
        .visible(false)
        .build()
        .map_err(|error| error.to_string())?;
    if let Some(screen) = crate::settings_window::island_screen(app) {
        let _ = window.set_position(centered(&screen, width, height));
    }

    thread::spawn(move || {
        thread::sleep(SHOW_FALLBACK_DELAY);
        if !window.is_visible().unwrap_or(true) {
            let _ = reveal(&window);
        }
    });
    Ok(())
}

/// Where a window of this logical size sits centered in the screen's work area.
fn centered(monitor: &Monitor, width: f64, height: f64) -> PhysicalPosition<i32> {
    let area = monitor.work_area();
    let scale = monitor.scale_factor();
    let offset = |available: u32, length: f64| {
        ((f64::from(available) - length * scale) / 2.0).max(0.0) as i32
    };
    PhysicalPosition::new(
        area.position.x + offset(area.size.width, width),
        area.position.y + offset(area.size.height, height),
    )
}

fn reveal(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

// Async keeps window creation off the IPC thread, which can deadlock on Windows.
#[tauri::command]
pub async fn open_onboarding_window(app: AppHandle) -> Result<(), String> {
    open(&app)
}

/// Called by the guide once it has painted, to show its hidden new window.
#[tauri::command]
pub async fn show_onboarding_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(WINDOW_LABEL)
        .ok_or_else(|| "Onboarding window was not found.".to_string())?;
    reveal(&window)
}

/// This module's Tauri commands. `lib.rs` chains every module's list into one
/// `generate_handler!`, so adding a command only touches this file.
macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::onboarding_window::open_onboarding_window,
            crate::onboarding_window::show_onboarding_window,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
