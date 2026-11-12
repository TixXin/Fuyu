//! Where a screenshot goes (C41.4): the clipboard as a bitmap, a PNG and a file at once, a PNG in
//! the user's folder, or a pin (pin.rs). The PNGs the clipboard and pins need are kept in the app
//! data folder's `screenshots/`, the newest 50 from the last 7 days; screenshots often show
//! passwords and chats, so they never leave this machine and are never logged.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::OnceLock,
    thread,
    time::{Duration, SystemTime},
};

use clipboard_win::{formats, options::NoClear, raw};
use image::{
    codecs::png::{CompressionType, FilterType, PngEncoder},
    ExtendedColorType, ImageEncoder,
};
use tauri::{AppHandle, Manager};

use super::session::PixelRect;
use crate::win32;

/// Another program may hold the clipboard for a moment; opening it is tried this many times.
const OPEN_ATTEMPTS: usize = 10;
const FOLDER: &str = "screenshots";
const KEEP_FILES: usize = 50;
const KEEP_FOR: Duration = Duration::from_secs(7 * 24 * 60 * 60);

/// A screenshot's pixels: RGBA rows, top to bottom.
pub(super) struct Picture {
    pub(super) width: u32,
    pub(super) height: u32,
    pub(super) rgba: Vec<u8>,
}

/// Lays `pixels` (RGBA rows, `at.width` × `at.height`) over `picture` at (`at.x`, `at.y`); false,
/// changing nothing, when they do not match their size or do not fit inside it.
pub(super) fn lay_over(picture: &mut Picture, at: PixelRect, pixels: &[u8]) -> bool {
    let fits = |start: u32, length: u32, limit: u32| start.checked_add(length).is_some_and(|end| end <= limit);
    if !super::pixels_fit(pixels.len(), at.width, at.height) || !fits(at.x, at.width, picture.width) || !fits(at.y, at.height, picture.height) {
        return false;
    }
    let (row, patch_row) = (picture.width as usize * 4, at.width as usize * 4);
    for (index, line) in pixels.chunks_exact(patch_row).enumerate() {
        let start = (at.y as usize + index) * row + at.x as usize * 4;
        picture.rgba[start..start + patch_row].copy_from_slice(line);
    }
    true
}

/// The fastest PNG that still stays small: screenshots are mostly flat colour, which the "Up"
/// filter and fast deflate shrink well, and copying should not wait on a slow encode.
pub(super) fn encode_png(picture: &Picture) -> Result<Vec<u8>, String> {
    let mut png = Vec::with_capacity(picture.rgba.len() / 4);
    PngEncoder::new_with_quality(&mut png, CompressionType::Fast, FilterType::Up)
        .write_image(&picture.rgba, picture.width, picture.height, ExtendedColorType::Rgba8)
        .map_err(|error| format!("Failed to encode the screenshot: {error}"))?;
    Ok(png)
}

/// The picture as a CF_DIB: a BITMAPINFOHEADER, then 32-bit BGRA rows bottom to top. Windows
/// makes CF_BITMAP and CF_DIBV5 from it for programs that ask for those.
pub(super) fn dib(picture: &Picture) -> Vec<u8> {
    const HEADER: u32 = 40;
    let row = picture.width as usize * 4;
    let mut out = Vec::with_capacity(HEADER as usize + picture.rgba.len());
    for field in [HEADER, picture.width, picture.height] {
        out.extend_from_slice(&field.to_le_bytes());
    }
    out.extend_from_slice(&1u16.to_le_bytes()); // planes
    out.extend_from_slice(&32u16.to_le_bytes()); // bits per pixel
    out.extend_from_slice(&0u32.to_le_bytes()); // BI_RGB
    out.extend_from_slice(&(picture.rgba.len() as u32).to_le_bytes());
    out.extend_from_slice(&[0; 16]); // resolution and palette: none
    for line in picture.rgba.chunks_exact(row).rev() {
        for &[red, green, blue, alpha] in line.as_chunks::<4>().0 {
            out.extend_from_slice(&[blue, green, red, alpha]);
        }
    }
    out
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

fn write_png(folder: &Path, png: &[u8]) -> Result<PathBuf, String> {
    fs::create_dir_all(folder).map_err(|error| format!("Failed to create {}: {error}", folder.display()))?;
    let path = file_name_in(folder, chrono::Local::now());
    fs::write(&path, png).map_err(|error| format!("Failed to write {}: {error}", path.display()))?;
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

/// Writes the PNG kept for the clipboard; the old ones are dropped afterwards, off this thread.
fn keep_png(app: &AppHandle, png: &[u8]) -> Result<PathBuf, String> {
    let dir = screenshots_dir(app).ok_or_else(|| "The app data folder is unavailable.".to_string())?;
    let path = write_png(&dir, png)?;
    thread::spawn(move || prune(&dir));
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

/// Puts the screenshot on the clipboard as a bitmap (CF_DIB), a PNG and the PNG file (CF_HDROP),
/// all in one go so clipboard watchers (our own history too) read it once: image editors paste the
/// bitmap, browsers the PNG, chat apps and Explorer the file, terminals its path. Without the app
/// data folder it goes as a bitmap and PNG only. The PNG is encoded once, fast, for both.
pub(super) fn copy(app: &AppHandle, picture: &Picture) -> Result<(), String> {
    let png = encode_png(picture)?;
    let file = keep_png(app, &png).map_err(|error| eprintln!("screenshot copied without its file: {error}")).ok();
    let dib = dib(picture);
    let _open = clipboard_win::Clipboard::new_attempts(OPEN_ATTEMPTS).map_err(|error| format!("Failed to open the clipboard: {error}"))?;
    let failed = |error: clipboard_win::ErrorCode| format!("Failed to copy the screenshot: {error}");
    raw::empty().map_err(failed)?;
    raw::set_without_clear(formats::CF_DIB, &dib).map_err(failed)?;
    if let Some(format) = raw::register_format("PNG") {
        raw::set_without_clear(format.get(), &png).map_err(failed)?;
    }
    if let Some(path) = file {
        raw::set_file_list_with(&[path.to_string_lossy()], NoClear).map_err(failed)?;
    }
    Ok(())
}

/// Saves the screenshot as a PNG in `folder`, or in Pictures\`default_name` without one.
pub(super) fn save(picture: &Picture, folder: Option<&str>, default_name: &str) -> Result<PathBuf, String> {
    let folder = match folder.map(str::trim).filter(|folder| !folder.is_empty()) {
        Some(folder) => PathBuf::from(folder),
        None => win32::known_folder::pictures().ok_or_else(|| "The Pictures folder is unavailable.".to_string())?.join(sanitized_name(default_name)),
    };
    write_png(&folder, &encode_png(picture)?)
}

/// A folder name without the characters Windows does not allow in one, never empty.
pub(super) fn sanitized_name(name: &str) -> String {
    let name: String = name.chars().filter(|c| !matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') && !c.is_control()).collect();
    let name = name.trim().trim_end_matches('.').to_string();
    if name.is_empty() { "Fuyu".to_string() } else { name }
}
