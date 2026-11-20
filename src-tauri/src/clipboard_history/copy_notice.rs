use serde::Serialize;
use tauri::Emitter;

use super::{service, ClipboardHistoryItem};

const COPIED_EVENT: &str = "clipboard-item-copied";
pub(super) const DEFAULT_CARD_SECONDS: u32 = 3;
const MAX_CARD_SECONDS: u32 = 30;
const MAX_TEXT_CHARS: usize = 20_000;
const MAX_LINK_CHARS: usize = 2_048;
#[cfg(target_os = "macos")]
const BLOCKED_CARD_SECONDS: u32 = 8;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
enum Origin {
    History,
    Capture,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CopiedNotice {
    item: ClipboardHistoryItem,
    seconds: u32,
    origin: Origin,
    #[serde(skip_serializing_if = "Option::is_none")]
    paste_blocked: Option<&'static str>,
}

pub(super) fn normalized_seconds(seconds: u32) -> u32 {
    seconds.min(MAX_CARD_SECONDS)
}

fn notice_item(item: &ClipboardHistoryItem) -> ClipboardHistoryItem {
    let mut item = super::store::item_with_protocol_thumbnail(item);
    item.html = None;
    item.ocr_text = None;
    if item.masked {
        item.text = None;
    } else if let Some(text) = item.text.as_mut() {
        if text.chars().count() > MAX_TEXT_CHARS {
            *text = text.chars().take(MAX_TEXT_CHARS).collect();
        }
    }
    item
}

pub(super) fn notify_copied(id: &str, pasted: bool) {
    let Ok(service) = service() else { return };
    let found = service.state.lock().ok().and_then(|state| {
        let seconds = normalized_seconds(state.settings.copy_card_seconds);
        if seconds == 0 || (pasted && state.settings.auto_paste) {
            return None;
        }
        state.items.iter().find(|item| item.id == id).map(|item| (notice_item(item), seconds))
    });
    let Some((item, seconds)) = found else { return };
    let _ = service.app.emit_to(crate::island::WINDOW_LABEL, COPIED_EVENT, CopiedNotice { item, seconds, origin: Origin::History, paste_blocked: None });
}

#[cfg(target_os = "macos")]
pub(super) fn notify_not_pasted(id: &str, needs_access: bool) {
    let Ok(service) = service() else { return };
    let found = service.state.lock().ok().and_then(|state| {
        let seconds = normalized_seconds(state.settings.copy_card_seconds);
        let seconds = if needs_access { seconds.max(BLOCKED_CARD_SECONDS) } else { seconds };
        if seconds == 0 {
            return None;
        }
        state.items.iter().find(|item| item.id == id).map(|item| (notice_item(item), seconds))
    });
    let Some((item, seconds)) = found else { return };
    let paste_blocked = needs_access.then_some("accessibility");
    let notice = CopiedNotice { item, seconds, origin: Origin::History, paste_blocked };
    let _ = service.app.emit_to(crate::island::WINDOW_LABEL, COPIED_EVENT, notice);
}

pub(super) fn looks_like_link(text: &str) -> bool {
    let text = text.trim();
    !text.is_empty() && text.chars().count() <= MAX_LINK_CHARS && !text.chars().any(char::is_whitespace) && text.contains('.')
}

pub(super) fn notify_captured(id: &str) {
    let Ok(service) = service() else { return };
    let found = service.state.lock().ok().and_then(|state| {
        let item = state.items.iter().find(|item| item.id == id)?;
        let link = !item.masked && item.text.as_deref().is_some_and(looks_like_link);
        link.then(|| (notice_item(item), normalized_seconds(state.settings.copy_card_seconds)))
    });
    let Some((item, seconds)) = found else { return };
    if !super::links::notice_enabled(&service.app) {
        return;
    }
    let _ = service.app.emit_to(crate::island::WINDOW_LABEL, COPIED_EVENT, CopiedNotice { item, seconds, origin: Origin::Capture, paste_blocked: None });
}
