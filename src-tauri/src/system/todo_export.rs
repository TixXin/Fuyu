use serde::Serialize;
use std::{fs, path::PathBuf};

use super::windows_home_dir;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTodoMarkdownResult {
    pub(super) file_path: String,
}

#[tauri::command]
pub fn save_todo_markdown(
    directory: String,
    date: String,
    content: String,
) -> Result<SaveTodoMarkdownResult, String> {
    let directory = directory.trim();

    if directory.is_empty() {
        return Err("Todo save path is empty.".to_string());
    }

    if !date.chars().all(|ch| ch.is_ascii_digit() || ch == '-') {
        return Err("Todo date contains invalid filename characters.".to_string());
    }

    let directory_path = PathBuf::from(directory);
    fs::create_dir_all(&directory_path).map_err(|error| error.to_string())?;

    let file_path = directory_path.join(format!("{date}.md"));
    fs::write(&file_path, content).map_err(|error| error.to_string())?;

    Ok(SaveTodoMarkdownResult {
        file_path: file_path.to_string_lossy().to_string(),
    })
}

fn legacy_default_directory() -> Result<PathBuf, String> {
    Ok(windows_home_dir()?.join("Documents").join("FocuSD"))
}

#[tauri::command]
pub fn get_default_todo_save_directory(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let home = crate::home_dir::fuyu_home(app.path()).map_err(|error| error.to_string())?;
    let app_data = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let directory = if home == app_data { legacy_default_directory()? } else { home.join(crate::home_dir::TODO_DIR) };
    Ok(directory.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_legacy_todo_save_directory() -> Result<String, String> {
    Ok(legacy_default_directory()?.to_string_lossy().to_string())
}
