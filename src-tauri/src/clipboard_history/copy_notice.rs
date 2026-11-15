use serde::Serialize;
use tauri::Emitter;

use super::{service, ClipboardHistoryItem};

const COPIED_EVENT: &str = "clipboard-item-copied";
pub(super) const DEFAULT_CARD_SECONDS: u32 = 3;
const MAX_CARD_SECONDS: u32 = 30;
const MAX_TEXT_CHARS: usize = 20_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CopiedNotice {
    item: ClipboardHistoryItem,
    seconds: u32,
}

pub(super) fn normalized_seconds(seconds: u32) -> u32 {
    seconds.min(MAX_CARD_SECONDS)
}

fn notice_item(item: &ClipboardHistoryItem) -> ClipboardHistoryItem {
    let mut item = item.clone();
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
    let _ = service.app.emit_to(crate::island::WINDOW_LABEL, COPIED_EVENT, CopiedNotice { item, seconds });
}
