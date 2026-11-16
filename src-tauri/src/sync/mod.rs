pub(crate) mod clock;
pub(crate) mod device;
pub(crate) mod record;
pub(crate) mod settings_meta;
#[cfg(test)]
mod tests;

pub(crate) use clock::{Clock, Hlc};
pub(crate) use record::Tombstone;

pub(crate) fn init(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let dir = match crate::home_dir::app_data_dir(&app.config().identifier) {
        Some(dir) => dir,
        None => app.path().app_data_dir().map_err(|error| format!("Failed to resolve the app data directory: {error}"))?,
    };
    device::init(dir);
    Ok(())
}
