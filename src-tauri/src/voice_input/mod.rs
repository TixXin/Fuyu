mod background;
#[cfg_attr(target_os = "macos", path = "capture_macos.rs")]
mod capture;
mod download;
mod engine;
#[cfg_attr(target_os = "macos", path = "hotkey_macos.rs")]
mod hotkey;
mod model;
mod packs;
mod session;

use std::sync::OnceLock;

use tauri::AppHandle;

use crate::user_error::UserError;

pub use model::VoiceModelStatus;
pub use session::VoiceInputState;

pub(crate) const PLUGIN_ID: &str = "voice-input";
pub(crate) const SHORTCUT_EVENT: &str = "voice-input-shortcut-status";

static APP: OnceLock<AppHandle> = OnceLock::new();

pub(crate) fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
    hotkey::init(app);
    background::register(app);
}

pub(crate) fn is_enabled() -> bool {
    crate::plugin_kernel::builtins::is_enabled(PLUGIN_ID)
}

fn on_hotkey() {
    if !is_enabled() {
        return;
    }
    let Some(app) = APP.get().cloned() else { return };
    std::thread::spawn(move || {
        let _ = session::toggle(&app);
    });
}

#[tauri::command]
pub fn voice_input_state() -> VoiceInputState {
    session::current()
}

#[tauri::command]
pub async fn voice_input_configure(app: AppHandle, enabled: bool, shortcut: String) {
    let shortcut = shortcut.trim().to_string();
    let wanted = if is_enabled() {
        (enabled && !shortcut.is_empty()).then_some(shortcut)
    } else {
        (!shortcut.is_empty()).then_some(shortcut)
    };
    hotkey::configure(wanted);
    if !enabled {
        let _ = session::stop(&app, false);
        engine::unload();
    }
}

#[tauri::command]
pub fn voice_input_shortcut_problem() -> Option<&'static str> {
    hotkey::problem()
}

#[tauri::command]
pub async fn voice_input_toggle(app: AppHandle) -> Result<(), UserError> {
    tauri::async_runtime::spawn_blocking(move || session::toggle(&app))
        .await
        .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

#[tauri::command]
pub async fn voice_input_cancel(app: AppHandle) -> Result<(), UserError> {
    session::stop(&app, false)
}

#[tauri::command]
pub async fn voice_input_model_status(app: AppHandle) -> Result<VoiceModelStatus, UserError> {
    Ok(model::status(&model::root_dir(&app)?, download::is_downloading()))
}

#[tauri::command]
pub async fn voice_input_download_model(app: AppHandle) -> Result<VoiceModelStatus, UserError> {
    download::download(app.clone()).await?;
    Ok(model::status(&model::root_dir(&app)?, false))
}

#[tauri::command]
pub fn voice_input_cancel_download() {
    download::cancel();
}

#[tauri::command]
pub async fn voice_input_delete_model(app: AppHandle) -> Result<VoiceModelStatus, UserError> {
    if download::is_downloading() {
        return Err(UserError::new("voiceInput.downloadBusy", "The speech model is already downloading."));
    }
    let _ = session::stop(&app, false);
    engine::unload();
    let root = model::root_dir(&app)?;
    model::remove(&root)?;
    Ok(model::status(&root, false))
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::voice_input::voice_input_state,
            crate::voice_input::voice_input_configure,
            crate::voice_input::voice_input_shortcut_problem,
            crate::voice_input::voice_input_toggle,
            crate::voice_input::voice_input_cancel,
            crate::voice_input::voice_input_model_status,
            crate::voice_input::voice_input_download_model,
            crate::voice_input::voice_input_cancel_download,
            crate::voice_input::voice_input_delete_model,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests;
