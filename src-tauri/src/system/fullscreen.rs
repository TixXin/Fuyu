use serde::Serialize;
use std::{sync::Mutex, thread, time::Duration};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use crate::win32;
use crate::island;

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

#[cfg(target_os = "macos")]
fn read(app: &AppHandle) -> ForegroundFullscreen {
    let Some(display) = crate::macos::fullscreen::fullscreen_display_in_front() else {
        return ForegroundFullscreen::default();
    };
    let island_center = island::main_window(app).ok().and_then(|window| {
        let scale = window.scale_factor().ok()?;
        let position = window.outer_position().ok()?.to_logical::<f64>(scale);
        let size = window.outer_size().ok()?.to_logical::<f64>(scale);
        Some((position.x + size.width / 2.0, position.y + 1.0))
    });
    let on_island_monitor = island_center.is_none_or(|(x, y)| display.contains(x, y));
    ForegroundFullscreen { active: true, on_island_monitor }
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
