mod audio;
mod control;
mod format;
mod mixer;
mod pacing;
mod session;
mod state;
#[cfg(test)]
mod tests;

use tauri::AppHandle;

use crate::user_error::UserError;
pub(crate) use control::{begin, is_busy, stop_in_background, Request};
use session::Summary;
use state::State;

#[tauri::command]
pub async fn screen_recording_start(app: AppHandle, request: Request) -> Result<String, UserError> {
    control::start_now(&app, request)
}

#[tauri::command]
pub async fn screen_recording_pause(app: AppHandle, paused: bool) -> Result<(), UserError> {
    control::pause(&app, paused)
}

#[tauri::command]
pub async fn screen_recording_stop(app: AppHandle) -> Result<Option<Summary>, UserError> {
    control::stop(&app)
}

#[tauri::command]
pub fn screen_recording_status() -> State {
    control::state()
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::recording::screen_recording_start,
            crate::recording::screen_recording_pause,
            crate::recording::screen_recording_stop,
            crate::recording::screen_recording_status,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
