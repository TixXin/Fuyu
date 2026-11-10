//! The clipboard window's actions panel (C38): pasting any text (transformed, merged, edited),
//! saving an edit as a new entry, pausing the history, converting Chinese scripts, reading a QR
//! code in an image and a link's title.

use tauri::AppHandle;

use super::clipboard_io::ClipboardCapture;
use super::secrets::looks_like_secret;
use super::store::{hash_bytes, preview_text};
use super::{capture_pause, current_unix_millis, link_preview, popup, service, ClipboardHistorySnapshot, SecretHandling};

/// Puts `text` on the clipboard (not into the history) and pastes it into the window that was in
/// front; `enter` presses Enter after it.
#[tauri::command]
pub async fn paste_clipboard_text(app: AppHandle, text: String, enter: Option<bool>) -> Result<(), String> {
    if text.is_empty() {
        return Err("Nothing to paste.".into());
    }
    popup::paste_text(&app, &text, enter.unwrap_or(false))
}

/// Adds `text` to the history as a new entry, as if just copied (an edit saved from the window).
#[tauri::command]
pub fn add_clipboard_history_text(text: String) -> Result<ClipboardHistorySnapshot, String> {
    if text.trim().is_empty() {
        return Err("Nothing to save.".into());
    }
    let service = service()?;
    let masked = looks_like_secret(&text) && service.snapshot()?.settings.secrets == SecretHandling::Mask;
    let capture = ClipboardCapture::Text {
        hash: hash_bytes([b"text:", text.as_bytes()].concat().as_slice()),
        preview: preview_text(&text),
        text,
        html: None,
    };
    service.insert_capture(capture, None, masked)?;
    service.snapshot()
}

/// Stops recording copies for `minutes`, or until resumed when none.
#[tauri::command]
pub fn pause_clipboard_capture(minutes: Option<u32>) -> Result<ClipboardHistorySnapshot, String> {
    let minutes = minutes.map(|minutes| minutes.clamp(1, 24 * 60));
    capture_pause::pause(minutes, current_unix_millis());
    // A timed pause tells the windows when it ends, so the pause bar goes at once (C42).
    if let Some(minutes) = minutes {
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(u64::from(minutes) * 60 + 1));
            if !capture_pause::paused() {
                let _ = changed();
            }
        });
    }
    changed()
}

#[tauri::command]
pub fn resume_clipboard_capture() -> Result<ClipboardHistorySnapshot, String> {
    capture_pause::resume();
    changed()
}

/// The next copy is not recorded.
#[tauri::command]
pub fn ignore_next_clipboard_copy() -> Result<ClipboardHistorySnapshot, String> {
    capture_pause::ignore_next();
    changed()
}

/// Pauses until resumed, or resumes: the tray menu's item.
pub(crate) fn toggle_capture_pause() {
    if capture_pause::paused() {
        capture_pause::resume();
    } else {
        capture_pause::pause(None, current_unix_millis());
    }
    let _ = changed();
}

fn changed() -> Result<ClipboardHistorySnapshot, String> {
    let service = service()?;
    service.emit_changed();
    service.snapshot()
}

/// `text` in simplified (`to` = "simplified") or traditional characters, by Windows' own tables.
#[tauri::command]
pub fn convert_chinese_text(text: String, to: String) -> Result<String, String> {
    let converted = match to.as_str() {
        "simplified" => crate::win32::chinese::to_simplified(&text),
        "traditional" => crate::win32::chinese::to_traditional(&text),
        _ => return Err(format!("Unknown script \"{to}\".")),
    };
    converted.ok_or_else(|| "Windows could not convert the text.".to_string())
}

/// The text of a QR code in an image entry; null when it has none.
#[tauri::command]
pub async fn read_clipboard_image_qr(id: String) -> Result<Option<String>, String> {
    let path = service()?
        .snapshot()?
        .items
        .into_iter()
        .find(|item| item.id == id)
        .and_then(|item| item.image.map(|image| image.original_path))
        .ok_or_else(|| "Not an image entry.".to_string())?;
    tauri::async_runtime::spawn_blocking(move || read_qr(&path))
        .await
        .map_err(|error| format!("Failed to join the QR task: {error}"))?
}

fn read_qr(path: &str) -> Result<Option<String>, String> {
    const MAX_SIDE: u32 = 1600;
    let image = image::open(path).map_err(|error| format!("Failed to load the image: {error}"))?;
    let image = if image.width() > MAX_SIDE || image.height() > MAX_SIDE {
        image.resize(MAX_SIDE, MAX_SIDE, image::imageops::FilterType::Triangle)
    } else {
        image
    };
    let grey = image.to_luma8();
    let mut prepared = rqrr::PreparedImage::prepare_from_greyscale(grey.width() as usize, grey.height() as usize, |x, y| {
        grey.get_pixel(x as u32, y as u32).0[0]
    });
    Ok(prepared.detect_grids().into_iter().find_map(|grid| grid.decode().ok().map(|(_, content)| content)))
}

/// A link's page title and icon, when link previews are on in the settings.
#[tauri::command]
pub async fn get_clipboard_link_preview(url: String) -> Result<link_preview::LinkPreview, String> {
    if !service()?.snapshot()?.settings.link_preview {
        return Err("Link previews are off.".into());
    }
    link_preview::fetch(&url).await
}
