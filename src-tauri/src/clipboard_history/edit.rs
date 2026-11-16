use std::sync::{Mutex, PoisonError};

use super::secrets::{looks_like_secret, mask};
use super::store::{hash_bytes, preview_text};
use super::{current_unix_millis, service, ClipboardHistoryItem, ClipboardHistoryItemKind, ClipboardHistorySnapshot, SecretHandling};

pub(super) const UNDO_WINDOW_MS: i64 = 10_000;

static LAST_EDIT: Mutex<Option<Edit>> = Mutex::new(None);

#[derive(Debug, Clone)]
pub(super) struct Edit {
    before: ClipboardHistoryItem,
    hash: String,
    at: i64,
}

impl Edit {
    pub(super) fn new(before: ClipboardHistoryItem, hash: String, at: i64) -> Self {
        Self { before, hash, at }
    }

    pub(super) fn before(&self) -> &ClipboardHistoryItem {
        &self.before
    }
}

pub(super) fn remember(edit: Edit) {
    *LAST_EDIT.lock().unwrap_or_else(PoisonError::into_inner) = Some(edit);
}

pub(super) fn text_hash(text: &str) -> String {
    hash_bytes([b"text:", text.as_bytes()].concat().as_slice())
}

pub(super) fn rewritten(item: &ClipboardHistoryItem, text: &str, secrets: SecretHandling, limit: usize, now: i64) -> Result<ClipboardHistoryItem, String> {
    if item.kind != ClipboardHistoryItemKind::Text {
        return Err("Only text entries can be edited.".to_string());
    }
    if text.trim().is_empty() {
        return Err("Nothing to save.".to_string());
    }
    let (text, _, truncated) = super::privacy::cap_text(text.to_string(), None, limit);
    let masked = secrets != SecretHandling::Keep && looks_like_secret(&text);
    Ok(ClipboardHistoryItem {
        hash: text_hash(&text),
        preview: if masked { mask(&text) } else { preview_text(&text) },
        text: Some(text),
        html: None,
        masked,
        truncated,
        edited_at: Some(now),
        ..item.clone()
    })
}

fn with_content_of(current: &ClipboardHistoryItem, before: &ClipboardHistoryItem) -> ClipboardHistoryItem {
    ClipboardHistoryItem {
        hash: before.hash.clone(),
        preview: before.preview.clone(),
        text: before.text.clone(),
        html: before.html.clone(),
        masked: before.masked,
        truncated: before.truncated,
        edited_at: before.edited_at,
        image: before.image.clone(),
        ocr_text: before.ocr_text.clone(),
        ..current.clone()
    }
}

pub(super) fn apply_edit(items: &mut [ClipboardHistoryItem], id: &str, text: &str, secrets: SecretHandling, limit: usize, now: i64) -> Result<Option<Edit>, String> {
    let item = items.iter_mut().find(|item| item.id == id).ok_or_else(|| "That clipboard entry is gone.".to_string())?;
    if item.text.as_deref() == Some(text) {
        return Ok(None);
    }
    let next = rewritten(item, text, secrets, limit, now)?;
    let edit = Edit::new(item.clone(), next.hash.clone(), now);
    *item = next;
    Ok(Some(edit))
}

pub(super) fn apply_undo(items: &mut [ClipboardHistoryItem], id: &str, edit: &Edit, now: i64) -> Result<ClipboardHistoryItem, String> {
    if edit.before.id != id || now.saturating_sub(edit.at) > UNDO_WINDOW_MS {
        return Err("This edit can no longer be undone.".to_string());
    }
    let item = items.iter_mut().find(|item| item.id == id).ok_or_else(|| "That clipboard entry is gone.".to_string())?;
    if item.hash != edit.hash {
        return Err("This entry changed again, so the edit can no longer be undone.".to_string());
    }
    let undone = item.clone();
    *item = with_content_of(item, &edit.before);
    Ok(undone)
}

#[tauri::command]
pub fn edit_clipboard_history_text(id: String, text: String) -> Result<ClipboardHistorySnapshot, String> {
    let service = service()?;
    let mut state = service.state.lock().map_err(|error| error.to_string())?;
    let (secrets, limit) = (state.settings.secrets, state.settings.privacy.max_text_bytes());
    let Some(edit) = apply_edit(&mut state.items, &id, &text, secrets, limit, current_unix_millis())? else {
        return Ok(super::ClipboardHistoryService::snapshot_locked(&state));
    };
    service.persist_locked(&state)?;
    let snapshot = super::ClipboardHistoryService::snapshot_locked(&state);
    drop(state);
    remember(edit);
    service.emit_changed();
    Ok(snapshot)
}

#[tauri::command]
pub fn undo_clipboard_history_edit(id: String) -> Result<ClipboardHistorySnapshot, String> {
    let service = service()?;
    let mut last = LAST_EDIT.lock().unwrap_or_else(PoisonError::into_inner);
    let edit = last.as_ref().ok_or_else(|| "There is no edit to undo.".to_string())?;
    let mut state = service.state.lock().map_err(|error| error.to_string())?;
    let undone = apply_undo(&mut state.items, &id, edit, current_unix_millis())?;
    *last = None;
    drop(last);
    service.persist_locked(&state)?;
    let snapshot = super::ClipboardHistoryService::snapshot_locked(&state);
    drop(state);
    service.emit_changed();
    if let Some(image) = undone.image {
        super::edit_image::remove_if_unused(&image);
    }
    Ok(snapshot)
}

#[cfg(test)]
mod tests {
    use super::{apply_edit, apply_undo, text_hash, SecretHandling};
    use crate::clipboard_history::ClipboardHistoryItem;

    fn item() -> ClipboardHistoryItem {
        serde_json::from_value(serde_json::json!({
            "id": "a", "kind": "text", "hash": "old", "createdAt": 5, "copiedAt": 9, "favorite": true, "note": "keep",
            "preview": "Hello", "text": "Hello", "html": "<b>Hello</b>", "image": null, "tags": ["work"], "pinKey": "K",
            "source": { "path": "C:/notes.exe", "name": "Notes" },
        }))
        .unwrap()
    }

    #[test]
    fn an_edit_keeps_the_entry_and_recomputes_what_comes_from_the_text() {
        let mut items = vec![item()];
        let edit = apply_edit(&mut items, "a", "Hello\n  world", SecretHandling::Mask, 0, 42).unwrap();
        assert!(edit.is_some());
        let edited = &items[0];
        assert_eq!((edited.id.as_str(), edited.created_at, edited.copied_at, edited.favorite), ("a", 5, 9, true));
        assert_eq!((edited.note.as_str(), edited.tags.clone(), edited.pin_key.as_deref()), ("keep", vec!["work".to_string()], Some("K")));
        assert!(edited.source.is_some());
        assert_eq!(edited.text.as_deref(), Some("Hello\n  world"));
        assert_eq!(edited.preview, "Hello world");
        assert_eq!(edited.hash, text_hash("Hello\n  world"));
        assert_eq!(edited.html, None);
        assert_eq!(edited.edited_at, Some(42));
    }

    #[test]
    fn an_edit_into_a_secret_is_masked_unless_secrets_are_kept() {
        let secret = "ghp_abcdefghijklmnopqrstuvwxyz0123";
        let mut items = vec![item()];
        apply_edit(&mut items, "a", secret, SecretHandling::Skip, 0, 1).unwrap();
        assert!(items[0].masked);
        assert_eq!(items[0].preview, "ghp_••••••••");
        let mut kept = vec![item()];
        apply_edit(&mut kept, "a", secret, SecretHandling::Keep, 0, 1).unwrap();
        assert!(!kept[0].masked);
    }

    #[test]
    fn an_edit_is_capped_and_unchanged_text_or_non_text_is_not_an_edit() {
        let mut items = vec![item()];
        apply_edit(&mut items, "a", "abcdef", SecretHandling::Mask, 4, 1).unwrap();
        assert_eq!((items[0].text.as_deref(), items[0].truncated), (Some("abcd"), true));
        let mut same = vec![item()];
        assert!(apply_edit(&mut same, "a", "Hello", SecretHandling::Mask, 0, 1).unwrap().is_none());
        assert!(apply_edit(&mut same, "a", "  ", SecretHandling::Mask, 0, 1).is_err());
        assert!(apply_edit(&mut same, "missing", "x", SecretHandling::Mask, 0, 1).is_err());
        let mut image: Vec<ClipboardHistoryItem> = vec![serde_json::from_value(serde_json::json!({
            "id": "i", "kind": "image", "hash": "i", "createdAt": 0, "copiedAt": 0, "preview": "1 x 1 image", "text": null, "image": null,
        }))
        .unwrap()];
        assert!(apply_edit(&mut image, "i", "x", SecretHandling::Mask, 0, 1).is_err());
    }

    #[test]
    fn undo_puts_the_old_text_back_and_keeps_later_changes_to_the_rest() {
        let mut items = vec![item()];
        let edit = apply_edit(&mut items, "a", "Changed", SecretHandling::Mask, 0, 1_000).unwrap().unwrap();
        items[0].favorite = false;
        apply_undo(&mut items, "a", &edit, 7_000).unwrap();
        assert_eq!((items[0].text.as_deref(), items[0].html.as_deref(), items[0].hash.as_str()), (Some("Hello"), Some("<b>Hello</b>"), "old"));
        assert_eq!((items[0].edited_at, items[0].favorite), (None, false));
    }

    #[test]
    fn undo_is_refused_when_late_for_another_entry_or_after_another_edit() {
        let mut items = vec![item()];
        let edit = apply_edit(&mut items, "a", "Changed", SecretHandling::Mask, 0, 1_000).unwrap().unwrap();
        assert!(apply_undo(&mut items, "a", &edit, 12_000).is_err());
        assert!(apply_undo(&mut items, "b", &edit, 2_000).is_err());
        apply_edit(&mut items, "a", "Again", SecretHandling::Mask, 0, 1_500).unwrap();
        assert!(apply_undo(&mut items, "a", &edit, 2_000).is_err());
    }
}
