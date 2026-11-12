//! The island's settings as a file, `settings.json` in its data folder (#50, D30.2), so they can
//! be opened, backed up and moved with the rest of the data. localStorage stays where the pages
//! read and write them; the island window copies them here when they change, and every window
//! reads the file once at start (src/features/settings-backup/settingsFile.ts). The format is
//! the settings backup's: `{ app, version, exportedAt, keys }`.

use serde_json::Value;
use tauri::AppHandle;

pub(crate) const FILE_NAME: &str = "settings.json";
/// Far above what the settings take (a few hundred KB with many presets).
const MAX_BYTES: usize = 4 * 1024 * 1024;

fn file_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    crate::home_dir::fuyu_home(app.path())
        .map(|dir| dir.join(FILE_NAME))
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

/// Whether `text` is a settings file this module may write: the backup format, every value text.
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

/// The file's text, or null when there is none yet (or it cannot be read).
#[tauri::command]
pub async fn read_settings_file(app: AppHandle) -> Result<Option<String>, String> {
    let path = file_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || std::fs::read_to_string(path).ok())
        .await
        .map_err(|error| error.to_string())
}

/// Replaces the file with `text`, which must be in the settings backup format.
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
        crate::fs_write::replace_file(&path, text.as_bytes()).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

/// This module's Tauri commands. `lib.rs` chains every module's list into one
/// `generate_handler!`, so adding a command only touches this file.
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
