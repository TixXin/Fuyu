use serde::Serialize;
use std::{sync::Mutex, thread, time::Duration};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use crate::{island, win32};

pub(crate) const FOREGROUND_FULLSCREEN_CHANGED_EVENT: &str = "foreground-fullscreen-changed";

const POLL_INTERVAL: Duration = Duration::from_millis(800);

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForegroundFullscreen {
    active: bool,
    on_island_monitor: bool,
}

static STATE: Mutex<ForegroundFullscreen> = Mutex::new(ForegroundFullscreen {
    active: false,
    on_island_monitor: false,
});

#[cfg(windows)]
fn read(app: &AppHandle) -> ForegroundFullscreen {
    let active = win32::notification_state::fullscreen_app_in_front();
    let on_island_monitor = active
        && island::main_window(app)
            .and_then(|window| window.hwnd().map_err(|error| error.to_string()))
            .map_or(true, |island| {
                win32::window::share_monitor(win32::window::foreground_window(), island)
            });
    ForegroundFullscreen { active, on_island_monitor }
}

#[cfg(not(windows))]
fn read(_app: &AppHandle) -> ForegroundFullscreen {
    ForegroundFullscreen::default()
}

pub(crate) fn start(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || loop {
        let next = read(&app);
        let changed = {
            let mut state = STATE.lock().unwrap_or_else(|poison| poison.into_inner());
            std::mem::replace(&mut *state, next) != next
        };
        if changed {
            let _ = app.emit(FOREGROUND_FULLSCREEN_CHANGED_EVENT, next);
        }
        thread::sleep(POLL_INTERVAL);
    });
}

#[tauri::command]
pub fn get_foreground_fullscreen() -> ForegroundFullscreen {
    *STATE.lock().unwrap_or_else(|poison| poison.into_inner())
}
