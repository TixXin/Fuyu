mod format;
mod pacing;
mod session;
#[cfg(test)]
mod tests;

use std::sync::{Mutex, PoisonError};

use crate::user_error::UserError;
use session::{Options, Recording, Summary};

static ACTIVE: Mutex<Option<Recording>> = Mutex::new(None);

fn failed(error: impl std::fmt::Display) -> UserError {
    UserError::new("recording.failed", "The recording failed.").detail(error)
}

#[tauri::command]
pub async fn screen_recording_start(x: i32, y: i32, width: u32, height: u32, fps: Option<u32>, folder_name: String) -> Result<String, UserError> {
    let mut active = ACTIVE.lock().unwrap_or_else(PoisonError::into_inner);
    if active.is_some() {
        return Err(UserError::new("recording.busy", "A recording is already running."));
    }
    let videos = crate::win32::known_folder::videos().ok_or_else(|| failed("The Videos folder is unavailable."))?;
    let folder = videos.join(crate::screenshot::sanitized_name(&folder_name));
    std::fs::create_dir_all(&folder).map_err(|error| failed(format!("Failed to create {}: {error}", folder.display())))?;
    let path = format::file_name_in(&folder, chrono::Local::now());
    let options = Options { x, y, width, height, fps: format::fps(fps), path: path.clone() };
    *active = Some(Recording::start(options).map_err(failed)?);
    Ok(path.display().to_string())
}

#[tauri::command]
pub async fn screen_recording_pause(paused: bool) -> Result<(), UserError> {
    let active = ACTIVE.lock().unwrap_or_else(PoisonError::into_inner);
    let recording = active.as_ref().ok_or_else(|| UserError::new("recording.idle", "Nothing is being recorded."))?;
    recording.pause(paused);
    Ok(())
}

#[tauri::command]
pub async fn screen_recording_stop() -> Result<Summary, UserError> {
    let recording = ACTIVE.lock().unwrap_or_else(PoisonError::into_inner).take();
    let recording = recording.ok_or_else(|| UserError::new("recording.idle", "Nothing is being recorded."))?;
    recording.stop().map_err(failed)
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::recording::screen_recording_start,
            crate::recording::screen_recording_pause,
            crate::recording::screen_recording_stop,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
