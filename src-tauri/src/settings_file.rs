use serde_json::{Map, Value};
use std::{
    path::Path,
    sync::{Mutex, MutexGuard, PoisonError},
};
use tauri::AppHandle;

use crate::sync::{clock, settings_meta};

pub(crate) const FILE_NAME: &str = "settings.json";
const MAX_BYTES: usize = 4 * 1024 * 1024;

fn file_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    crate::home_dir::fuyu_home(app.path())
        .map(|dir| dir.join(FILE_NAME))
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

fn is_settings_file(text: &str) -> bool {
    if text.len() > MAX_BYTES {
        return false;
    }
    let Ok(Value::Object(file)) = serde_json::from_str::<Value>(text) else {
        return false;
    };
    file.get("app").and_then(Value::as_str) == Some("fuyu")
        && file.get("version").and_then(Value::as_u64) == Some(1)
        && file
            .get("keys")
            .and_then(Value::as_object)
            .is_some_and(|keys| keys.iter().all(|(key, value)| key.starts_with("fuyu-") && value.is_string()))
}

fn keys_of(text: &str) -> Option<Map<String, Value>> {
    match serde_json::from_str::<Value>(text).ok()? {
        Value::Object(mut file) => match file.remove("keys")? {
            Value::Object(keys) => Some(keys),
            _ => None,
        },
        _ => None,
    }
}

pub(crate) fn lock() -> MutexGuard<'static, ()> {
    static WRITING: Mutex<()> = Mutex::new(());
    WRITING.lock().unwrap_or_else(PoisonError::into_inner)
}

fn stamp_changes(path: &Path, new: &str) {
    let Some(dir) = path.parent() else {
        return;
    };
    let Some(new) = keys_of(new) else {
        return;
    };
    let old = std::fs::read_to_string(path).ok().filter(|text| is_settings_file(text)).and_then(|text| keys_of(&text));
    let meta_path = dir.join(settings_meta::FILE_NAME);
    let meta = settings_meta::load(&meta_path);
    clock::observe(settings_meta::all(&meta));
    let next = clock::with(|clock, wall| settings_meta::restamp(settings_meta::whitelist(), old.as_ref(), &new, &meta, clock, wall));
    if next != meta || !meta_path.exists() {
        if let Err(error) = settings_meta::save(&meta_path, &next) {
            eprintln!("could not save {}: {error}", meta_path.display());
        }
    }
}

#[tauri::command]
pub async fn read_settings_file(app: AppHandle) -> Result<Option<String>, String> {
    let path = file_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || std::fs::read_to_string(path).ok())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn write_settings_file(app: AppHandle, text: String) -> Result<(), String> {
    if !is_settings_file(&text) {
        return Err("Not a settings file.".into());
    }
    let path = file_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|error| error.to_string())?;
        }
        let _writing = lock();
        stamp_changes(&path, &text);
        crate::fs_write::replace_file(&path, text.as_bytes()).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::settings_file::read_settings_file,
            crate::settings_file::write_settings_file,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::is_settings_file;

    #[test]
    fn only_the_settings_backup_format_is_written() {
        assert!(is_settings_file(r#"{"app":"fuyu","version":1,"exportedAt":"x","keys":{"fuyu-locale":"en"}}"#));
        assert!(is_settings_file(r#"{"app":"fuyu","version":1,"keys":{}}"#));
        assert!(!is_settings_file(r#"{"app":"other","version":1,"keys":{}}"#));
        assert!(!is_settings_file(r#"{"app":"fuyu","version":2,"keys":{}}"#));
        assert!(!is_settings_file(r#"{"app":"fuyu","version":1,"keys":{"fuyu-x":1}}"#));
        assert!(!is_settings_file(r#"{"app":"fuyu","version":1,"keys":{"other":"x"}}"#));
        assert!(!is_settings_file("not json"));
    }

    #[test]
    fn a_huge_file_is_refused() {
        let big = format!(r#"{{"app":"fuyu","version":1,"keys":{{"fuyu-x":"{}"}}}}"#, "a".repeat(super::MAX_BYTES));
        assert!(!is_settings_file(&big));
    }
}
