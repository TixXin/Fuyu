use plugin_base::{host_service, ServeError};

use super::{add_paths, notify_island, service, FileShelfSnapshot, MAX_PATHS};

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
    notify_island();
    Ok(snapshot)
}
