use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::{island, settings_window, tray};

pub(crate) const FILE_NAME: &str = "tray-icon.json";

static VISIBLE: AtomicBool = AtomicBool::new(true);

#[derive(Serialize, Deserialize)]
struct Saved {
    visible: bool,
}

fn parse(text: &str) -> bool {
    serde_json::from_str::<Saved>(text).map(|saved| saved.visible).unwrap_or(true)
}

fn file_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    crate::home_dir::fuyu_home(app.path())
        .map(|dir| dir.join(FILE_NAME))
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

fn apply(app: &AppHandle, visible: bool) {
    VISIBLE.store(visible, Ordering::Relaxed);
    if let Some(icon) = app.tray_by_id(tray::TRAY_ID) {
        if let Err(error) = icon.set_visible(visible) {
            eprintln!("failed to change the tray icon's visibility: {error}");
        }
    }
}

pub(crate) fn apply_saved(app: &AppHandle) {
    let visible = file_path(app)
        .ok()
        .and_then(|path| std::fs::read_to_string(path).ok())
        .is_none_or(|text| parse(&text));
    if !visible {
        apply(app, false);
    }
}

pub(crate) fn reopen(app: &AppHandle) {
    let _ = island::show_island(app);
    if VISIBLE.load(Ordering::Relaxed) {
        return;
    }
    if let Ok(window) = island::main_window(app) {
        let request = r#"localStorage.setItem("fuyu-settings-focus", JSON.stringify({ section: "general", requestedAt: Date.now() }))"#;
        if let Err(error) = window.eval(request) {
            eprintln!("failed to ask settings for the general page: {error}");
        }
    }
    if let Err(error) = settings_window::open(app) {
        eprintln!("failed to open settings window: {error}");
    }
}

#[tauri::command]
pub fn get_tray_icon_visible() -> bool {
    VISIBLE.load(Ordering::Relaxed)
}

#[tauri::command]
pub async fn set_tray_icon_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    let path = file_path(&app)?;
    let json = serde_json::to_string(&Saved { visible }).map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|error| error.to_string())?;
        }
        crate::fs_write::replace_file(&path, json.as_bytes()).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())??;
    let handle = app.clone();
    app.run_on_main_thread(move || apply(&handle, visible)).map_err(|error| error.to_string())
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::tray_visibility::get_tray_icon_visible,
            crate::tray_visibility::set_tray_icon_visible,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::parse;

    #[test]
    fn the_icon_stays_unless_the_file_clearly_hides_it() {
        assert!(!parse(r#"{"visible":false}"#));
        assert!(parse(r#"{"visible":true}"#));
        assert!(parse(""));
        assert!(parse("not json"));
        assert!(parse(r#"{"visible":"no"}"#));
    }
}
