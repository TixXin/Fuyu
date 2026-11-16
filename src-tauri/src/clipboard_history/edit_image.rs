use std::{fs, time::Duration};

use tauri::ipc::{InvokeBody, Request, Response};

use super::clipboard_io::ClipboardCapture;
use super::edit::{self, Edit};
use super::store::hash_bytes;
use super::{current_unix_millis, service, ClipboardHistoryImage, ClipboardHistoryItem, ClipboardHistoryItemKind, ClipboardHistoryService, ClipboardHistorySnapshot};

const KEEP_AFTER_UNDO_MS: i64 = 2_000;

pub(super) fn image_hash(width: usize, height: usize, rgba: &[u8]) -> String {
    let mut input = Vec::with_capacity(16 + rgba.len());
    input.extend_from_slice(&width.to_le_bytes());
    input.extend_from_slice(&height.to_le_bytes());
    input.extend_from_slice(rgba);
    hash_bytes(&input)
}

fn editable(item: &ClipboardHistoryItem) -> Result<(), String> {
    if item.kind == ClipboardHistoryItemKind::Image && item.image.is_some() {
        Ok(())
    } else {
        Err("Only image entries can be edited as images.".to_string())
    }
}

pub(super) fn apply_image_edit(items: &mut [ClipboardHistoryItem], id: &str, image: ClipboardHistoryImage, hash: String, now: i64) -> Result<Option<Edit>, String> {
    let item = items.iter_mut().find(|item| item.id == id).ok_or_else(|| "That clipboard entry is gone.".to_string())?;
    editable(item)?;
    if item.hash == hash {
        return Ok(None);
    }
    let edit = Edit::new(item.clone(), hash.clone(), now);
    *item = ClipboardHistoryItem {
        preview: format!("{} x {} image", image.width, image.height),
        image: Some(image),
        hash,
        ocr_text: None,
        edited_at: Some(now),
        ..item.clone()
    };
    Ok(Some(edit))
}

pub(super) fn remove_unused(items: &[ClipboardHistoryItem], image: &ClipboardHistoryImage) -> bool {
    let used = items.iter().filter_map(|item| item.image.as_ref()).any(|kept| kept.original_path == image.original_path);
    if !used {
        let _ = fs::remove_file(&image.original_path);
        let _ = fs::remove_file(&image.thumbnail_path);
    }
    !used
}

pub(super) fn remove_if_unused(image: &ClipboardHistoryImage) {
    let Ok(service) = service() else { return };
    let Ok(state) = service.state.lock() else { return };
    remove_unused(&state.items, image);
}

fn remove_later(image: ClipboardHistoryImage) {
    std::thread::spawn(move || {
        let wait = edit::UNDO_WINDOW_MS + KEEP_AFTER_UNDO_MS;
        std::thread::sleep(Duration::from_millis(u64::try_from(wait).unwrap_or(0)));
        remove_if_unused(&image);
    });
}

fn read_text_later(id: String, path: String) {
    std::thread::spawn(move || {
        let Some(text) = super::service::read_image_text(&path) else { return };
        let Ok(service) = service() else { return };
        let Ok(mut state) = service.state.lock() else { return };
        let still_this_image = |item: &&mut ClipboardHistoryItem| item.id == id && item.image.as_ref().is_some_and(|image| image.original_path == path);
        let Some(item) = state.items.iter_mut().find(still_this_image) else { return };
        item.ocr_text = Some(text);
        if service.persist_locked(&state).is_ok() {
            drop(state);
            service.emit_changed();
        }
    });
}

fn replace(service: &ClipboardHistoryService, id: &str, width: usize, height: usize, rgba: Vec<u8>) -> Result<ClipboardHistorySnapshot, String> {
    let hash = image_hash(width, height, &rgba);
    {
        let state = service.state.lock().map_err(|error| error.to_string())?;
        let item = state.items.iter().find(|item| item.id == id).ok_or_else(|| "That clipboard entry is gone.".to_string())?;
        editable(item)?;
        if item.hash == hash {
            return Ok(ClipboardHistoryService::snapshot_locked(&state));
        }
    }
    let image = service.persist_image(&hash, width, height, rgba)?;
    let mut state = service.state.lock().map_err(|error| error.to_string())?;
    let edit = match apply_image_edit(&mut state.items, id, image.clone(), hash, current_unix_millis()) {
        Ok(Some(edit)) => edit,
        Ok(None) => return Ok(ClipboardHistoryService::snapshot_locked(&state)),
        Err(error) => {
            remove_unused(&state.items, &image);
            return Err(error);
        }
    };
    service.persist_locked(&state)?;
    let snapshot = ClipboardHistoryService::snapshot_locked(&state);
    let ocr = state.settings.ocr;
    drop(state);
    let old = edit.before().image.clone();
    edit::remember(edit);
    service.emit_changed();
    if ocr {
        read_text_later(id.to_string(), image.original_path);
    }
    if let Some(old) = old {
        remove_later(old);
    }
    Ok(snapshot)
}

#[tauri::command]
pub async fn save_clipboard_history_image(request: Request<'_>) -> Result<ClipboardHistorySnapshot, String> {
    let InvokeBody::Raw(body) = request.body() else {
        return Err("The image pixels must come as raw bytes.".to_string());
    };
    let header = |name: &str| request.headers().get(name).and_then(|value| value.to_str().ok());
    let number = |name: &str| header(name).and_then(|value| value.parse::<usize>().ok()).filter(|value| *value > 0);
    let (width, height) = number("x-width").zip(number("x-height")).ok_or_else(|| "The image size is missing.".to_string())?;
    if width.checked_mul(height).and_then(|pixels| pixels.checked_mul(4)) != Some(body.len()) {
        return Err("The image pixels do not match its size.".to_string());
    }
    let service = service()?;
    match header("x-mode") {
        Some("replace") => replace(service, header("x-id").ok_or_else(|| "The entry id is missing.".to_string())?, width, height, body.clone()),
        Some("new") => {
            let capture = ClipboardCapture::Image { hash: image_hash(width, height, body), width, height, rgba: body.clone() };
            service.insert_capture(capture, None, false)?;
            service.snapshot()
        }
        _ => Err("Unknown image save mode.".to_string()),
    }
}

#[tauri::command]
pub async fn read_clipboard_history_image(id: String) -> Result<Response, String> {
    let path = {
        let state = service()?.state.lock().map_err(|error| error.to_string())?;
        state.items.iter().find(|item| item.id == id).and_then(|item| item.image.as_ref()).map(|image| image.original_path.clone())
    };
    let path = path.ok_or_else(|| "That image is gone.".to_string())?;
    fs::read(path).map(Response::new).map_err(|error| format!("Failed to read the clipboard image: {error}"))
}

#[cfg(test)]
#[path = "edit_image_tests.rs"]
mod tests;
