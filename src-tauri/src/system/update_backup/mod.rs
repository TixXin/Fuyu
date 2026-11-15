mod store;

use std::{collections::BTreeMap, path::PathBuf};

use tauri::AppHandle;

pub use store::{BackupList, BackupSummary};

use crate::user_error::UserError;

fn home(app: &AppHandle) -> Result<PathBuf, UserError> {
    crate::home_dir::fuyu_home(tauri::Manager::path(app))
        .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))
}

async fn blocking<T: Send + 'static>(work: impl FnOnce() -> Result<T, UserError> + Send + 'static) -> Result<T, UserError> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

#[tauri::command]
pub async fn update_backup_create(app: AppHandle, to_version: String, local_storage: String) -> Result<BackupSummary, UserError> {
    let home = home(&app)?;
    let from_version = app.package_info().version.to_string();
    blocking(move || {
        let now = chrono::Local::now();
        let stamp = now.format("%Y%m%d-%H%M%S").to_string();
        store::create(
            &home,
            &store::Request {
                from_version: &from_version,
                to_version: &to_version,
                snapshot: &local_storage,
                now_millis: now.timestamp_millis(),
                stamp: &stamp,
            },
        )
    })
    .await
}

#[tauri::command]
pub async fn update_backup_list(app: AppHandle) -> Result<BackupList, UserError> {
    let home = home(&app)?;
    blocking(move || Ok(store::list(&home))).await
}

#[tauri::command]
pub async fn update_backup_restore(app: AppHandle, id: String) -> Result<BTreeMap<String, String>, UserError> {
    let home = home(&app)?;
    blocking(move || store::prepare_restore(&home, &id)).await
}

pub(crate) fn apply_pending_restore() {
    let Some(home) = crate::home_dir::current() else { return };
    match store::apply_pending(home) {
        Ok(Some(id)) => eprintln!("restored the files of backup {id}"),
        Ok(None) => {}
        Err(error) => eprintln!("could not restore the backup: {error}"),
    }
}

#[cfg(test)]
mod tests;
