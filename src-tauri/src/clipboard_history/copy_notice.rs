use serde::Serialize;
use tauri::Emitter;

use super::popup_place::PasteOutcome;
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
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pasted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    paste_blocked: Option<&'static str>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct NoticePlan {
    seconds: u32,
    pasted: bool,
    paste_blocked: Option<&'static str>,
}

pub(super) fn normalized_seconds(seconds: u32) -> u32 {
    seconds.min(MAX_CARD_SECONDS)
}

fn plan_paste_notice(outcome: PasteOutcome, configured_seconds: u32) -> Option<NoticePlan> {
    let seconds = normalized_seconds(configured_seconds);
    match outcome {
        PasteOutcome::Sent => (seconds > 0).then_some(NoticePlan { seconds, pasted: true, paste_blocked: None }),
        PasteOutcome::Off | PasteOutcome::NoTarget => (seconds > 0).then_some(NoticePlan { seconds, pasted: false, paste_blocked: None }),
        #[cfg(target_os = "macos")]
        PasteOutcome::NoAccess => Some(NoticePlan {
            seconds: seconds.max(BLOCKED_CARD_SECONDS),
            pasted: false,
            paste_blocked: Some("accessibility"),
        }),
    }
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

fn emit_history(id: &str, plan: impl FnOnce(u32) -> Option<NoticePlan>) {
    let Ok(service) = service() else { return };
    let found = service.state.lock().ok().and_then(|state| {
        let plan = plan(state.settings.copy_card_seconds)?;
        let item = state.items.iter().find(|item| item.id == id)?;
        Some((notice_item(item), plan))
    });
    let Some((item, plan)) = found else { return };
    let notice = CopiedNotice {
        item,
        seconds: plan.seconds,
        origin: Origin::History,
        pasted: plan.pasted,
        paste_blocked: plan.paste_blocked,
    };
    let _ = service.app.emit_to(crate::island::WINDOW_LABEL, COPIED_EVENT, notice);
}

pub(super) fn notify_copied(id: &str) {
    emit_history(id, |configured| {
        let seconds = normalized_seconds(configured);
        (seconds > 0).then_some(NoticePlan { seconds, pasted: false, paste_blocked: None })
    });
}

pub(super) fn notify_paste(id: &str, outcome: PasteOutcome) {
    emit_history(id, |configured| plan_paste_notice(outcome, configured));
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
    let notice = CopiedNotice { item, seconds, origin: Origin::Capture, pasted: false, paste_blocked: None };
    let _ = service.app.emit_to(crate::island::WINDOW_LABEL, COPIED_EVENT, notice);
}

#[cfg(test)]
mod tests {
    use super::{plan_paste_notice, NoticePlan, PasteOutcome};

    #[test]
    fn paste_outcomes_choose_pasted_copied_or_blocked_cards() {
        assert_eq!(plan_paste_notice(PasteOutcome::Sent, 3), Some(NoticePlan { seconds: 3, pasted: true, paste_blocked: None }));
        assert_eq!(plan_paste_notice(PasteOutcome::Sent, 0), None);
        assert_eq!(plan_paste_notice(PasteOutcome::Off, 3), Some(NoticePlan { seconds: 3, pasted: false, paste_blocked: None }));
        assert_eq!(plan_paste_notice(PasteOutcome::NoTarget, 3), Some(NoticePlan { seconds: 3, pasted: false, paste_blocked: None }));
        assert_eq!(plan_paste_notice(PasteOutcome::NoTarget, 0), None);
        #[cfg(target_os = "macos")]
        {
            assert_eq!(plan_paste_notice(PasteOutcome::NoAccess, 0), Some(NoticePlan { seconds: 8, pasted: false, paste_blocked: Some("accessibility") }));
            assert_eq!(plan_paste_notice(PasteOutcome::NoAccess, 12), Some(NoticePlan { seconds: 12, pasted: false, paste_blocked: Some("accessibility") }));
        }
    }
}
