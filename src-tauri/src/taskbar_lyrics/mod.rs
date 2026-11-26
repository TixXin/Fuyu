use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder};

use crate::{taskbar_host, user_error::UserError, win32::{taskbar_shell, window}};

pub(crate) const WINDOW_LABEL: &str = "taskbar-lyrics";

fn create(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        return Ok(window);
    }
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == WINDOW_LABEL)
        .ok_or_else(|| "The taskbar lyrics window config was not found.".to_string())?
        .clone();
    WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| error.to_string())?
        .visible(false)
        .focused(false)
        .build()
        .map_err(|error| format!("Could not create the taskbar lyrics window: {error}"))
}

#[tauri::command]
pub async fn set_taskbar_lyrics(app: AppHandle, open: bool) -> Result<(), UserError> {
    if open && taskbar_host::supported() {
        create(&app)?;
    } else if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        taskbar_host::undock(&window);
        let _ = window.destroy();
    }
    Ok(())
}

#[tauri::command]
pub async fn show_taskbar_lyrics(window: WebviewWindow, shown: bool) {
    let Some(hwnd) = window.hwnd().ok().filter(|handle| !handle.is_invalid()) else {
        return;
    };
    if shown {
        if !window::is_visible(hwnd) {
            window::show_without_activating(hwnd);
        }
        taskbar_shell::raise(hwnd);
    } else if window::is_visible(hwnd) {
        window::hide_window(hwnd);
    }
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::taskbar_lyrics::set_taskbar_lyrics,
            crate::taskbar_lyrics::show_taskbar_lyrics,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
