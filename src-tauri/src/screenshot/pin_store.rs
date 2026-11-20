use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use super::{output, output::Picture, pin};

const FOLDER: &str = "screenshot-pins";
const LIST_FILE: &str = "pins.json";
const VERSION: u32 = 1;
const SAVE_DELAY: Duration = Duration::from_millis(800);

static ENABLED: AtomicBool = AtomicBool::new(false);
static RESTORED: AtomicBool = AtomicBool::new(false);
static PENDING: AtomicBool = AtomicBool::new(false);
static FROZEN: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SavedPin {
    pub(super) file: String,
    pub(super) x: i32,
    pub(super) y: i32,
    pub(super) width: u32,
    pub(super) height: u32,
    pub(super) margin: u32,
    pub(super) density: f64,
    pub(super) opacity: f64,
}

#[derive(Debug, Default, PartialEq, Serialize, Deserialize)]
struct SavedPins {
    version: u32,
    pins: Vec<SavedPin>,
}

pub(super) struct StoreItem {
    pub(super) label: String,
    pub(super) picture: Arc<Picture>,
    pub(super) file: Option<String>,
    pub(super) saved: SavedPin,
}

fn folder(app: &AppHandle) -> Option<PathBuf> {
    crate::home_dir::fuyu_home(app.path()).ok().map(|home| home.join(FOLDER))
}

fn parse_list(text: &str) -> Vec<SavedPin> {
    serde_json::from_str::<SavedPins>(text)
        .ok()
        .filter(|list| list.version == VERSION)
        .map(|list| list.pins.into_iter().filter(valid).collect())
        .unwrap_or_default()
}

fn valid(pin: &SavedPin) -> bool {
    let file_ok = !pin.file.is_empty() && pin.file.ends_with(".png") && !pin.file.contains(['/', '\\']) && !pin.file.contains("..");
    file_ok && pin.width > 0 && pin.height > 0 && pin.density.is_finite() && pin.density > 0.0 && pin.opacity.is_finite()
}

pub(super) fn set_enabled(app: &AppHandle, enabled: bool) {
    let was = ENABLED.swap(enabled, Ordering::SeqCst);
    if enabled && !RESTORED.swap(true, Ordering::SeqCst) {
        restore(app);
    } else if enabled && !was {
        request_save(app);
    }
    if !enabled {
        if let Some(dir) = folder(app) {
            let _ = fs::remove_dir_all(dir);
        }
    }
}

pub(super) fn freeze() {
    FROZEN.store(true, Ordering::SeqCst);
}

pub(super) fn thaw() {
    FROZEN.store(false, Ordering::SeqCst);
}

pub(super) fn request_save(app: &AppHandle) {
    if !ENABLED.load(Ordering::SeqCst) || FROZEN.load(Ordering::SeqCst) || PENDING.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(SAVE_DELAY);
        PENDING.store(false, Ordering::SeqCst);
        if ENABLED.load(Ordering::SeqCst) && !FROZEN.load(Ordering::SeqCst) {
            if let Err(error) = save(&app) {
                eprintln!("failed to remember the pins: {error}");
            }
        }
    });
}

fn save(app: &AppHandle) -> Result<(), String> {
    let dir = folder(app).ok_or_else(|| "No home folder.".to_string())?;
    let items = pin::store_items(app);
    if items.is_empty() {
        let _ = fs::remove_dir_all(&dir);
        return Ok(());
    }
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let mut pins = Vec::with_capacity(items.len());
    for item in items {
        let file = match item.file.filter(|file| dir.join(file).is_file()) {
            Some(file) => file,
            None => {
                let file = format!("{}-{}.png", item.label, unique_suffix());
                fs::write(dir.join(&file), output::encode_png(&item.picture)?).map_err(|error| error.to_string())?;
                pin::mark_stored(&item.label, &item.picture, &file);
                file
            }
        };
        pins.push(SavedPin { file, ..item.saved });
    }
    let text = serde_json::to_vec_pretty(&SavedPins { version: VERSION, pins: pins.clone() }).map_err(|error| error.to_string())?;
    crate::fs_write::replace_file(&dir.join(LIST_FILE), &text).map_err(|error| error.to_string())?;
    remove_unlisted(&dir, &pins);
    Ok(())
}

fn unique_suffix() -> u128 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|time| time.as_millis()).unwrap_or(0)
}

fn remove_unlisted(dir: &Path, pins: &[SavedPin]) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.ends_with(".png") && !pins.iter().any(|pin| pin.file == name) {
            let _ = fs::remove_file(entry.path());
        }
    }
}

fn restore(app: &AppHandle) {
    let Some(dir) = folder(app) else { return };
    let Ok(text) = fs::read_to_string(dir.join(LIST_FILE)) else { return };
    let saved = parse_list(&text);
    let app = app.clone();
    thread::spawn(move || {
        for pin in saved {
            let Ok(bytes) = fs::read(dir.join(&pin.file)) else { continue };
            let Ok(image) = image::load_from_memory(&bytes) else { continue };
            let image = image.to_rgba8();
            let picture = Picture { width: image.width(), height: image.height(), rgba: image.into_raw() };
            if let Err(error) = pin::restore(&app, picture, &pin) {
                eprintln!("failed to bring a pin back: {error}");
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn saved(file: &str) -> SavedPin {
        SavedPin { file: file.into(), x: -1200, y: 40, width: 320, height: 200, margin: 15, density: 1.0, opacity: 0.6 }
    }

    #[test]
    fn the_list_round_trips_and_keeps_position_size_and_opacity() {
        let list = SavedPins { version: VERSION, pins: vec![saved("pin-3-1.png")] };
        let text = serde_json::to_string(&list).unwrap();
        assert!(text.contains("\"opacity\":0.6") && text.contains("\"x\":-1200"));
        assert_eq!(parse_list(&text), list.pins);
    }

    #[test]
    fn broken_or_foreign_entries_are_skipped() {
        assert!(parse_list("not json").is_empty());
        assert!(parse_list(r#"{"version":99,"pins":[]}"#).is_empty());
        let list = SavedPins { version: VERSION, pins: vec![saved("../evil.png"), saved("a/b.png"), saved("note.txt"), SavedPin { width: 0, ..saved("x.png") }, saved("ok.png")] };
        let kept = parse_list(&serde_json::to_string(&list).unwrap());
        assert_eq!(kept.into_iter().map(|pin| pin.file).collect::<Vec<_>>(), vec!["ok.png".to_string()]);
    }
}
