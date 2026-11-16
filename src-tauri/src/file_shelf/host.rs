use plugin_base::{host_service, ServeError};
use tauri::Emitter;

use super::{add_paths, plugin_view::{CHANGED_EVENT, MAX_PATHS}, service, FileShelfSnapshot};
use crate::island;

#[host_service("fileShelf.list")]
fn list_for_host() -> Result<FileShelfSnapshot, String> {
    service()?.update(|items| items)
}

#[host_service("fileShelf.add")]
fn add_for_host(paths: Vec<String>) -> Result<FileShelfSnapshot, ServeError> {
    if !(1..=MAX_PATHS).contains(&paths.len()) {
        return Err(ServeError::bad_params("fileShelf.add", format!("paths must hold 1-{MAX_PATHS} paths")));
    }
    let snapshot = add_paths(&paths).map_err(|error| ServeError::new("failed", error))?;
    if let Ok(service) = service() {
        let _ = service.app.emit_to(island::WINDOW_LABEL, CHANGED_EVENT, ());
    }
    Ok(snapshot)
}
