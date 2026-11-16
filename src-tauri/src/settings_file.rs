use serde_json::{Map, Value};
use std::{
    path::Path,
    sync::{Mutex, MutexGuard, PoisonError},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};

use crate::sync::{clock, settings_meta};

pub(crate) const FILE_NAME: &str = "settings.json";
const MAX_BYTES: usize = 4 * 1024 * 1024;
const SYNC_APPLIED_EVENT: &str = "settings-sync-applied";
const SYNC_HOLD: Duration = Duration::from_secs(15);

type SyncedChange = (String, Option<Value>, Value);
static RECENT_SYNC: Mutex<Option<(Instant, Vec<SyncedChange>)>> = Mutex::new(None);

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
        let text = keep_synced(&text, Instant::now());
        stamp_changes(&path, &text);
        crate::fs_write::replace_file(&path, text.as_bytes()).map_err(|error| error.to_string())?;
        crate::sync::notify_local_change();
        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?
}

fn keep_synced(text: &str, now: Instant) -> String {
    let recent = RECENT_SYNC.lock().unwrap_or_else(PoisonError::into_inner);
    let Some(changes) = recent.as_ref().filter(|(at, _)| now.duration_since(*at) < SYNC_HOLD).map(|(_, changes)| changes) else {
        return text.to_string();
    };
    let Ok(Value::Object(mut file)) = serde_json::from_str::<Value>(text) else {
        return text.to_string();
    };
    let Some(Value::Object(keys)) = file.get_mut("keys") else {
        return text.to_string();
    };
    let mut kept = false;
    for (key, before, after) in changes {
        if keys.get(key) == before.as_ref() && keys.get(key) != Some(after) {
            keys.insert(key.clone(), after.clone());
            kept = true;
        }
    }
    if !kept {
        return text.to_string();
    }
    serde_json::to_string_pretty(&Value::Object(file)).map(|text| format!("{text}\n")).unwrap_or_else(|_| text.to_string())
}

fn sync_paths(app: &AppHandle) -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
    let path = file_path(app)?;
    let meta = path.with_file_name(settings_meta::FILE_NAME);
    Ok((path, meta))
}

fn current_keys(path: &Path) -> Option<Map<String, Value>> {
    std::fs::read_to_string(path).ok().filter(|text| is_settings_file(text)).and_then(|text| keys_of(&text))
}

pub(crate) type SyncedSettings = (Map<String, Value>, settings_meta::SettingsMeta);

pub(crate) fn load_for_sync(app: &AppHandle) -> Result<Option<SyncedSettings>, String> {
    let (path, meta_path) = sync_paths(app)?;
    let _writing = lock();
    let Some(keys) = current_keys(&path) else { return Ok(None) };
    Ok(Some((keys, settings_meta::load(&meta_path))))
}

pub(crate) fn changed_keys(before: &Map<String, Value>, after: &Map<String, Value>) -> Vec<SyncedChange> {
    after.iter().filter(|(key, value)| before.get(*key) != Some(*value)).map(|(key, value)| (key.clone(), before.get(key).cloned(), value.clone())).collect()
}

pub(crate) fn store_from_sync(app: &AppHandle, expected: &Map<String, Value>, keys: Map<String, Value>, meta: &settings_meta::SettingsMeta) -> Result<(), String> {
    let (path, meta_path) = sync_paths(app)?;
    let _writing = lock();
    let text = std::fs::read_to_string(&path).map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    let Ok(Value::Object(mut file)) = serde_json::from_str::<Value>(&text) else {
        return Err(format!("{} is not readable.", path.display()));
    };
    if current_keys(&path).as_ref() != Some(expected) {
        return Err("The settings changed while syncing; trying again later.".into());
    }
    clock::observe(settings_meta::all(meta));
    settings_meta::save(&meta_path, meta)?;
    let changes = changed_keys(expected, &keys);
    file.insert("keys".into(), Value::Object(keys));
    let text = serde_json::to_string_pretty(&Value::Object(file)).map_err(|error| error.to_string())?;
    crate::fs_write::replace_file(&path, format!("{text}\n").as_bytes()).map_err(|error| error.to_string())?;
    if changes.is_empty() {
        return Ok(());
    }
    let applied: Map<String, Value> = changes.iter().map(|(key, _, after)| (key.clone(), after.clone())).collect();
    *RECENT_SYNC.lock().unwrap_or_else(PoisonError::into_inner) = Some((Instant::now(), changes));
    let _ = app.emit_to(crate::island::WINDOW_LABEL, SYNC_APPLIED_EVENT, serde_json::json!({ "keys": applied }));
    Ok(())
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
