mod backend;
mod backend_folder;
mod base;
mod categories;
pub(crate) mod clock;
mod codec;
mod config;
pub(crate) mod device;
mod engine;
pub(crate) mod layout;
mod merge;
pub(crate) mod record;
mod round;
pub(crate) mod settings_meta;
mod status;
pub(crate) mod webdav;
#[cfg(test)]
mod test_devices;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod two_devices;

pub(crate) use clock::{Clock, Hlc};
pub(crate) use engine::notify_local_change;
pub(crate) use record::Tombstone;

pub(crate) type SyncRecords = (Vec<serde_json::Value>, Vec<Tombstone>);

pub use config::SyncCategory;
pub use status::SyncStatus;

pub(crate) const LOCAL_FILES: [&str; 3] = [device::FILE_NAME, config::FILE_NAME, base::DIR_NAME];

pub(crate) fn init(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let dir = match crate::home_dir::app_data_dir(&app.config().identifier) {
        Some(dir) => dir,
        None => app
            .path()
            .app_data_dir()
            .map_err(|error| format!("Failed to resolve the app data directory: {error}"))?,
    };
    device::init(dir.clone());
    let data_home = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve the data folder: {error}"))?;
    engine::start(app, dir, data_home);
    Ok(())
}

#[tauri::command]
pub(crate) fn get_sync_status() -> Result<SyncStatus, crate::user_error::UserError> {
    engine::status()
}

#[tauri::command]
pub(crate) async fn set_sync_config(
    folder: Option<String>,
    categories: Vec<SyncCategory>,
    optional_groups: Vec<String>,
) -> Result<SyncStatus, crate::user_error::UserError> {
    tauri::async_runtime::spawn_blocking(move || engine::configure(folder, categories, optional_groups))
        .await
        .map_err(|error| crate::user_error::UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

#[tauri::command]
pub(crate) async fn set_sync_webdav(
    url: String,
    username: String,
    password: Option<String>,
    categories: Vec<SyncCategory>,
    optional_groups: Vec<String>,
) -> Result<SyncStatus, crate::user_error::UserError> {
    tauri::async_runtime::spawn_blocking(move || {
        engine::configure_webdav(url, username, password, categories, optional_groups)
    })
    .await
    .map_err(|error| crate::user_error::UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

#[tauri::command]
pub(crate) async fn test_sync_webdav(
    url: String,
    username: String,
    password: Option<String>,
) -> Result<(), crate::user_error::UserError> {
    engine::test_webdav(url, username, password).await
}

#[tauri::command]
pub(crate) async fn stop_sync(forget_webdav: Option<bool>) -> Result<SyncStatus, crate::user_error::UserError> {
    tauri::async_runtime::spawn_blocking(move || engine::stop(forget_webdav.unwrap_or(false)))
        .await
        .map_err(|error| crate::user_error::UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

#[tauri::command]
pub(crate) fn sync_now() -> Result<(), crate::user_error::UserError> {
    engine::sync_now()
}

#[tauri::command]
pub(crate) fn confirm_sync_deletions() -> Result<(), crate::user_error::UserError> {
    engine::confirm()
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::sync::get_sync_status,
            crate::sync::set_sync_config,
            crate::sync::set_sync_webdav,
            crate::sync::test_sync_webdav,
            crate::sync::stop_sync,
            crate::sync::sync_now,
            crate::sync::confirm_sync_deletions,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
