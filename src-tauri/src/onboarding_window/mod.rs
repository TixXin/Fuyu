pub(crate) mod overlay;

use std::{thread, time::Duration};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WebviewWindowBuilder, WindowEvent};

pub const WINDOW_LABEL: &str = "onboarding";

const SHOW_FALLBACK_DELAY: Duration = Duration::from_secs(2);
const DESKTOP_CLEAR_DELAY: Duration = Duration::from_millis(350);

pub fn open(app: &AppHandle) -> Result<(), String> {
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
    let cleared = crate::win32::desktop::minimize_all_windows();
    if cleared {
        thread::sleep(DESKTOP_CLEAR_DELAY);
    }
    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| error.to_string())?
        .visible(false)
        .build()
        .map_err(|error| error.to_string())?;
    if let Some(screen) = crate::settings_window::island_screen(app) {
        let area = screen.work_area();
        let _ = window.set_position(PhysicalPosition::new(area.position.x, area.position.y));
        let _ = window.set_size(PhysicalSize::new(area.size.width, area.size.height));
    }
    let _ = window.set_ignore_cursor_events(true);
    if cleared {
        window.on_window_event(|event| {
            if matches!(event, WindowEvent::Destroyed) {
                crate::win32::desktop::undo_minimize_all_windows();
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

fn reveal(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn open_onboarding_window(app: AppHandle) -> Result<(), String> {
    open(&app)
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
