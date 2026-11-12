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

const OPEN_ATTEMPTS: usize = 10;
const PASTE_DELAY: Duration = Duration::from_millis(220);
const FOLDER: &str = "screenshots";
const KEEP_FILES: usize = 50;
const KEEP_FOR: Duration = Duration::from_secs(7 * 24 * 60 * 60);

pub(super) struct Picture {
    pub(super) width: u32,
    pub(super) height: u32,
    pub(super) rgba: Vec<u8>,
}

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

pub(super) fn encode_png(picture: &Picture) -> Result<Vec<u8>, String> {
    let mut png = Vec::with_capacity(picture.rgba.len() / 4);
    PngEncoder::new_with_quality(&mut png, CompressionType::Fast, FilterType::Up)
        .write_image(&picture.rgba, picture.width, picture.height, ExtendedColorType::Rgba8)
        .map_err(|error| format!("Failed to encode the screenshot: {error}"))?;
    Ok(png)
}

pub(super) fn dib(picture: &Picture) -> Vec<u8> {
    const HEADER: u32 = 40;
    let row = picture.width as usize * 4;
    let mut out = Vec::with_capacity(HEADER as usize + picture.rgba.len());
    for field in [HEADER, picture.width, picture.height] {
        out.extend_from_slice(&field.to_le_bytes());
    }
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&32u16.to_le_bytes());
    out.extend_from_slice(&0u32.to_le_bytes());
    out.extend_from_slice(&(picture.rgba.len() as u32).to_le_bytes());
    out.extend_from_slice(&[0; 16]);
    for line in picture.rgba.chunks_exact(row).rev() {
        for &[red, green, blue, alpha] in line.as_chunks::<4>().0 {
            out.extend_from_slice(&[blue, green, red, alpha]);
        }
    }
    out
}

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

static SCREENSHOTS_DIR: OnceLock<PathBuf> = OnceLock::new();

fn screenshots_dir(app: &AppHandle) -> Option<PathBuf> {
    if let Some(dir) = SCREENSHOTS_DIR.get() {
        return Some(dir.clone());
    }
    let dir = crate::home_dir::fuyu_home(app.path()).ok()?.join(FOLDER);
    Some(SCREENSHOTS_DIR.get_or_init(|| dir).clone())
}

pub(crate) fn is_screenshot_file(path: &Path) -> bool {
    SCREENSHOTS_DIR.get().is_some_and(|dir| path.parent() == Some(dir.as_path()))
}

fn keep_png(app: &AppHandle, png: &[u8]) -> Result<PathBuf, String> {
    let dir = screenshots_dir(app).ok_or_else(|| "The app data folder is unavailable.".to_string())?;
    let path = write_png(&dir, png)?;
    thread::spawn(move || prune(&dir));
    Ok(path)
}

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

pub(super) fn stale(files: &mut [(SystemTime, PathBuf)], now: SystemTime) -> Vec<PathBuf> {
    files.sort_by_key(|(modified, _)| std::cmp::Reverse(*modified));
    files
        .iter()
        .enumerate()
        .filter(|(index, (modified, _))| *index >= KEEP_FILES || now.duration_since(*modified).is_ok_and(|age| age > KEEP_FOR))
        .map(|(_, (_, path))| path.clone())
        .collect()
}

pub(super) fn prune_at_start(app: &AppHandle) {
    if let Some(dir) = screenshots_dir(app) {
        thread::spawn(move || prune(&dir));
    }
}

pub(super) fn copy(app: &AppHandle, picture: &Picture) -> Result<Option<PathBuf>, String> {
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
    if let Some(path) = &file {
        raw::set_file_list_with(&[path.to_string_lossy()], NoClear).map_err(failed)?;
    }
    Ok(file)
}

pub(super) fn thumbnail(picture: &Picture) -> Option<String> {
    use base64::Engine;
    const BOX: (u32, u32) = (192, 108);
    let scale = (f64::from(BOX.0) / f64::from(picture.width)).min(f64::from(BOX.1) / f64::from(picture.height)).min(1.0);
    let size = (((f64::from(picture.width) * scale).round() as u32).max(1), ((f64::from(picture.height) * scale).round() as u32).max(1));
    let image = image::RgbaImage::from_raw(picture.width, picture.height, picture.rgba.clone())?;
    let small = image::imageops::thumbnail(&image, size.0, size.1);
    let png = encode_png(&Picture { width: size.0, height: size.1, rgba: small.into_raw() }).ok()?;
    Some(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png)))
}

pub(super) fn paste_path(path: &Path) -> Result<(), String> {
    {
        let _open = clipboard_win::Clipboard::new_attempts(OPEN_ATTEMPTS).map_err(|error| format!("Failed to open the clipboard: {error}"))?;
        let failed = |error: clipboard_win::ErrorCode| format!("Failed to copy the screenshot: {error}");
        raw::empty().map_err(failed)?;
        raw::set_file_list_with(&[path.to_string_lossy()], NoClear).map_err(failed)?;
        raw::set_string_with(&format!("\"{}\"", path.display()), NoClear).map_err(failed)?;
    }
    thread::sleep(PASTE_DELAY);
    win32::input::send_paste_shortcut();
    Ok(())
}

pub(super) fn copy_text(text: &str) -> Result<(), String> {
    let _open = clipboard_win::Clipboard::new_attempts(OPEN_ATTEMPTS).map_err(|error| format!("Failed to open the clipboard: {error}"))?;
    raw::set_string(text).map_err(|error| format!("Failed to copy the text: {error}"))
}

pub(super) fn save(picture: &Picture, folder: Option<&str>, default_name: &str) -> Result<PathBuf, String> {
    let folder = match folder.map(str::trim).filter(|folder| !folder.is_empty()) {
        Some(folder) => chosen_folder(folder)?,
        None => win32::known_folder::pictures().ok_or_else(|| "The Pictures folder is unavailable.".to_string())?.join(sanitized_name(default_name)),
    };
    write_png(&folder, &encode_png(picture)?)
}

pub(super) fn chosen_folder(folder: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(folder);
    if path.is_absolute() && !path.components().any(|part| matches!(part, std::path::Component::ParentDir)) {
        Ok(path)
    } else {
        Err(format!("The save folder must be a full path such as D:\\Screenshots, not {folder}."))
    }
}

pub(super) fn sanitized_name(name: &str) -> String {
    let name: String = name.chars().filter(|c| !matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') && !c.is_control()).collect();
    let name = name.trim().trim_end_matches('.').to_string();
    if name.is_empty() { "Fuyu".to_string() } else { name }
}
