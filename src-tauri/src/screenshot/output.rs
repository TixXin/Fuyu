//! Where a screenshot goes (C41.4): the clipboard as a bitmap, a PNG and a file at once, a PNG in
//! the user's folder, or a pin (pin.rs). The PNGs the clipboard and pins need are kept in the app
//! data folder's `screenshots/`, the newest 50 from the last 7 days; screenshots often show
//! passwords and chats, so they never leave this machine and are never logged.

use std::{
    borrow::Cow,
    fs,
    io::Cursor,
    path::{Path, PathBuf},
    thread,
    sync::OnceLock,
    time::{Duration, SystemTime},
};

use arboard::{Clipboard, ImageData};
use image::{ImageFormat, RgbaImage};
use tauri::{AppHandle, Manager};

use crate::win32;

/// Another program may hold the clipboard for a moment; try a few times.
const ATTEMPTS: u32 = 4;
const RETRY_DELAY: Duration = Duration::from_millis(60);
const FOLDER: &str = "screenshots";
const KEEP_FILES: usize = 50;
const KEEP_FOR: Duration = Duration::from_secs(7 * 24 * 60 * 60);

/// A screenshot's pixels: RGBA rows, top to bottom.
pub(super) struct Picture {
    pub(super) width: u32,
    pub(super) height: u32,
    pub(super) rgba: Vec<u8>,
}

fn encode_png(picture: &Picture) -> Result<Vec<u8>, String> {
    let image = RgbaImage::from_raw(picture.width, picture.height, picture.rgba.clone()).ok_or_else(|| "The screenshot pixels do not match their size.".to_string())?;
    let mut png = Cursor::new(Vec::new());
    image.write_to(&mut png, ImageFormat::Png).map_err(|error| format!("Failed to encode the screenshot: {error}"))?;
    Ok(png.into_inner())
}

/// `Fuyu_2026-11-12_10-30-15.png`, with `_2`, `_3`... when that name is taken in `folder`.
pub(super) fn file_name_in(folder: &Path, now: chrono::DateTime<chrono::Local>) -> PathBuf {
    let stem = format!("Fuyu_{}", now.format("%Y-%m-%d_%H-%M-%S"));
    let mut path = folder.join(format!("{stem}.png"));
    let mut next = 2;
    while path.exists() {
        path = folder.join(format!("{stem}_{next}.png"));
        next += 1;
    }
    path
}

fn write_png(folder: &Path, picture: &Picture) -> Result<PathBuf, String> {
    fs::create_dir_all(folder).map_err(|error| format!("Failed to create {}: {error}", folder.display()))?;
    let path = file_name_in(folder, chrono::Local::now());
    fs::write(&path, encode_png(picture)?).map_err(|error| format!("Failed to write {}: {error}", path.display()))?;
    Ok(path)
}

/// The app data folder's `screenshots/`, found once at startup.
static SCREENSHOTS_DIR: OnceLock<PathBuf> = OnceLock::new();

fn screenshots_dir(app: &AppHandle) -> Option<PathBuf> {
    if let Some(dir) = SCREENSHOTS_DIR.get() {
        return Some(dir.clone());
    }
    let dir = app.path().app_data_dir().ok()?.join(FOLDER);
    Some(SCREENSHOTS_DIR.get_or_init(|| dir).clone())
}

/// Whether `path` is one of the PNGs a screenshot copy put on the clipboard, so the clipboard
/// history keeps that copy as an image rather than as a file.
pub(crate) fn is_screenshot_file(path: &Path) -> bool {
    SCREENSHOTS_DIR.get().is_some_and(|dir| path.parent() == Some(dir.as_path()))
}

/// Writes the PNG kept for the clipboard, and drops the old ones.
fn keep_png(app: &AppHandle, picture: &Picture) -> Result<PathBuf, String> {
    let dir = screenshots_dir(app).ok_or_else(|| "The app data folder is unavailable.".to_string())?;
    let path = write_png(&dir, picture)?;
    prune(&dir);
    Ok(path)
}

/// Keeps the newest `KEEP_FILES` PNGs younger than `KEEP_FOR`.
pub(super) fn prune(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut files: Vec<(SystemTime, PathBuf)> = entries
        .flatten()
        .filter(|entry| entry.path().extension().is_some_and(|extension| extension.eq_ignore_ascii_case("png")))
        .filter_map(|entry| Some((entry.metadata().ok()?.modified().ok()?, entry.path())))
        .collect();
    let now = SystemTime::now();
    for path in stale(&mut files, now) {
        let _ = fs::remove_file(path);
    }
}

/// The files to delete: past the newest `KEEP_FILES`, or older than `KEEP_FOR`.
pub(super) fn stale(files: &mut [(SystemTime, PathBuf)], now: SystemTime) -> Vec<PathBuf> {
    files.sort_by_key(|(modified, _)| std::cmp::Reverse(*modified));
    files
        .iter()
        .enumerate()
        .filter(|(index, (modified, _))| *index >= KEEP_FILES || now.duration_since(*modified).is_ok_and(|age| age > KEEP_FOR))
        .map(|(_, (_, path))| path.clone())
        .collect()
}

/// Drops old PNGs at startup.
pub(super) fn prune_at_start(app: &AppHandle) {
    if let Some(dir) = screenshots_dir(app) {
        thread::spawn(move || prune(&dir));
    }
}

fn retry(mut write: impl FnMut() -> Result<(), arboard::Error>) -> Result<(), String> {
    let mut last_error = String::new();
    for attempt in 0..ATTEMPTS {
        if attempt > 0 {
            thread::sleep(RETRY_DELAY);
        }
        match write() {
            Ok(()) => return Ok(()),
            Err(error) => last_error = error.to_string(),
        }
    }
    Err(format!("Failed to copy the screenshot: {last_error}"))
}

/// Puts the screenshot on the clipboard as a bitmap and a PNG (arboard writes both), and as a PNG
/// file (CF_HDROP): image editors paste the bitmap, chat apps and Explorer the file, terminals the
/// path. Without the app data folder it goes as a bitmap and PNG only.
pub(super) fn copy(app: &AppHandle, picture: &Picture) -> Result<(), String> {
    let image = ImageData { width: picture.width as usize, height: picture.height as usize, bytes: Cow::Borrowed(&picture.rgba) };
    retry(|| Clipboard::new()?.set_image(image.clone()))?;
    match keep_png(app, picture) {
        // Adds to what is on the clipboard, as the clipboard history's "copy as file" does.
        Ok(path) => retry(|| Clipboard::new()?.set().file_list(&[path.as_path()])),
        Err(error) => {
            eprintln!("screenshot copied without its file: {error}");
            Ok(())
        }
    }
}

/// Saves the screenshot as a PNG in `folder`, or in Pictures\`default_name` without one.
pub(super) fn save(picture: &Picture, folder: Option<&str>, default_name: &str) -> Result<PathBuf, String> {
    let folder = match folder.map(str::trim).filter(|folder| !folder.is_empty()) {
        Some(folder) => PathBuf::from(folder),
        None => win32::known_folder::pictures().ok_or_else(|| "The Pictures folder is unavailable.".to_string())?.join(sanitized_name(default_name)),
    };
    write_png(&folder, picture)
}

/// A folder name without the characters Windows does not allow in one, never empty.
pub(super) fn sanitized_name(name: &str) -> String {
    let name: String = name.chars().filter(|c| !matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') && !c.is_control()).collect();
    let name = name.trim().trim_end_matches('.').to_string();
    if name.is_empty() { "Fuyu".to_string() } else { name }
}
