use serde::Serialize;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

use super::{
    lock::{self, LOCK_FILE},
    migration::{self, has_island_data, State, STATE_FILE},
    Source, POINTER_FILE,
};
use crate::{rename_migration::data_dirs::copy_tree, user_error::UserError};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataHome {
    home: String,
    default_home: String,
    source: Source,
}

fn app_data(app: &AppHandle) -> Result<PathBuf, UserError> {
    app.path().app_data_dir().map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))
}

fn current(app: &AppHandle) -> Result<PathBuf, UserError> {
    super::fuyu_home(app.path()).map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))
}

#[tauri::command]
pub fn get_data_home(app: AppHandle) -> Result<DataHome, UserError> {
    Ok(DataHome {
        home: current(&app)?.display().to_string(),
        default_home: super::default_home().unwrap_or_default().display().to_string(),
        source: super::source(),
    })
}

fn copy_into(from: &std::path::Path, to: &std::path::Path) -> std::io::Result<()> {
    copy_tree(from, to)?;
    for name in [LOCK_FILE, POINTER_FILE] {
        let _ = fs::remove_file(to.join(name));
    }
    Ok(())
}

#[tauri::command]
pub async fn set_data_home(app: AppHandle, path: Option<String>) -> Result<String, UserError> {
    crate::dev_lane::refuse_in_preview("move its data").map_err(|message| UserError::new("plain", message))?;
    if super::source() == Source::Env {
        return Err(UserError::new("home.envSet", "The home folder is set by FUYU_HOME.").arg("home", current(&app)?.display().to_string()));
    }
    let target = match path.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        Some(value) => PathBuf::from(value),
        None => super::default_home().ok_or_else(|| UserError::new("home.notAbsolute", "Enter a full folder path."))?,
    };
    if !target.is_absolute() {
        return Err(UserError::new("home.notAbsolute", "Enter a full folder path."));
    }
    let from = current(&app)?;
    let app_data = app_data(&app)?;
    if target == from {
        return Ok(target.display().to_string());
    }
    if let Some(holder) = lock::conflict(&target) {
        return Err(UserError::new("home.inUse", "Another computer uses this folder.").arg("computer", holder.computer));
    }
    let copy_target = target.clone();
    tauri::async_runtime::spawn_blocking(move || -> std::io::Result<()> {
        fs::create_dir_all(&copy_target)?;
        if !has_island_data(&copy_target) {
            copy_into(&from, &copy_target)?;
        }
        let mut state: State = fs::read_to_string(copy_target.join(STATE_FILE))
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default();
        state.from = Some(from.display().to_string());
        state.hooks = false;
        state.todos = true;
        migration::write_state(&copy_target, &state)?;
        let pointer = app_data.join(POINTER_FILE);
        if path.as_deref().map(str::trim).is_some_and(|value| !value.is_empty()) {
            fs::create_dir_all(&app_data)?;
            let text = serde_json::to_string_pretty(&serde_json::json!({ "home": copy_target.display().to_string() })).map_err(std::io::Error::other)?;
            crate::fs_write::replace_file(&pointer, text.as_bytes())
        } else {
            match fs::remove_file(&pointer) {
                Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error),
                _ => Ok(()),
            }
        }
    })
    .await
    .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?
    .map_err(|error| UserError::new("home.copy", "Could not copy the data.").arg("path", target.display().to_string()).detail(error))?;
    Ok(target.display().to_string())
}
