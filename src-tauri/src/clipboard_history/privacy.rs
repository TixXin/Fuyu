use serde::{Deserialize, Serialize};
use std::{thread, time::Duration};

use super::{current_unix_millis, ClipboardHistoryItem, ClipboardHistoryService, ClipboardSource};

pub(super) const FORGET_WINDOW_MS: i64 = 2 * 60 * 1000;
const CLEARED_CONFIRM_DELAY: Duration = Duration::from_millis(500);
const SWEEP_INTERVAL: Duration = Duration::from_secs(60);
const MINUTE_MS: i64 = 60 * 1000;
pub(super) const SECRET_EXPIRY_CHOICES: [u32; 5] = [0, 10, 60, 24 * 60, 7 * 24 * 60];
pub(super) const TEXT_LIMIT_CHOICES: [u32; 4] = [0, 256, 1024, 4096];
const DEFAULT_TEXT_LIMIT_KB: u32 = 1024;
pub(super) const OTHER_DEVICE_PATH: &str = "fuyu:other-device";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PrivacySettings {
    forget_cleared: bool,
    secret_expiry_minutes: u32,
    max_text_kb: u32,
    record_remote: bool,
}

impl Default for PrivacySettings {
    fn default() -> Self {
        Self {
            forget_cleared: true,
            secret_expiry_minutes: 0,
            max_text_kb: DEFAULT_TEXT_LIMIT_KB,
            record_remote: true,
        }
    }
}

impl PrivacySettings {
    pub(super) fn normalized(mut self) -> Self {
        if !SECRET_EXPIRY_CHOICES.contains(&self.secret_expiry_minutes) {
            self.secret_expiry_minutes = nearest(&SECRET_EXPIRY_CHOICES, self.secret_expiry_minutes);
        }
        if !TEXT_LIMIT_CHOICES.contains(&self.max_text_kb) {
            self.max_text_kb = nearest(&TEXT_LIMIT_CHOICES[1..], self.max_text_kb);
        }
        self
    }

    pub(super) fn forget_cleared(&self) -> bool {
        self.forget_cleared
    }

    pub(super) fn record_remote(&self) -> bool {
        self.record_remote
    }

    pub(super) fn max_text_bytes(&self) -> usize {
        self.max_text_kb as usize * 1024
    }
}

fn nearest(choices: &[u32], value: u32) -> u32 {
    choices
        .iter()
        .copied()
        .min_by_key(|choice| choice.abs_diff(value))
        .unwrap_or(value)
}

pub(super) fn other_device_source() -> ClipboardSource {
    ClipboardSource {
        path: OTHER_DEVICE_PATH.to_string(),
        name: "Other device".to_string(),
    }
}

pub(super) fn should_forget(item: &ClipboardHistoryItem, last_capture_hash: Option<&str>, now: i64) -> bool {
    let age = now.saturating_sub(item.created_at);
    !item.favorite
        && last_capture_hash == Some(item.hash.as_str())
        && (0..=FORGET_WINDOW_MS).contains(&age)
}

pub(super) fn secret_expired(item: &ClipboardHistoryItem, expiry_minutes: u32, now: i64) -> bool {
    expiry_minutes > 0
        && item.masked
        && !item.favorite
        && now.saturating_sub(item.copied_at) >= i64::from(expiry_minutes) * MINUTE_MS
}

pub(super) fn cap_text(mut text: String, html: Option<String>, limit: usize) -> (String, Option<String>, bool) {
    if limit == 0 {
        return (text, html, false);
    }
    let html = html.filter(|html| html.len() <= limit);
    if text.len() <= limit {
        return (text, html, false);
    }
    let mut end = limit;
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }
    text.truncate(end);
    (text, None, true)
}

pub(super) fn start_secret_sweeper() {
    thread::spawn(|| loop {
        thread::sleep(SWEEP_INTERVAL);
        if let Ok(service) = super::service() {
            service.expire_secrets(current_unix_millis());
        }
    });
}

impl ClipboardHistoryService {
    pub(super) fn forget_if_cleared(&self) {
        thread::sleep(CLEARED_CONFIRM_DELAY);
        if !super::system::is_empty() {
            return;
        }
        let now = current_unix_millis();
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        let forget = state
            .items
            .first()
            .is_some_and(|item| should_forget(item, state.last_capture_hash.as_deref(), now));
        if !forget {
            return;
        }
        let item = state.items.remove(0);
        state.last_capture_hash = None;
        self.remove_item_files(&item);
        if let Err(error) = self.persist_locked(&state) {
            eprintln!("failed to forget the cleared clipboard entry: {error}");
        }
        drop(state);
        self.emit_changed();
    }

    pub(super) fn expire_secrets(&self, now: i64) {
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        let minutes = state.settings.privacy.secret_expiry_minutes;
        if minutes == 0 || !state.items.iter().any(|item| secret_expired(item, minutes, now)) {
            return;
        }
        let (expired, kept): (Vec<_>, Vec<_>) = std::mem::take(&mut state.items)
            .into_iter()
            .partition(|item| secret_expired(item, minutes, now));
        state.items = kept;
        for item in &expired {
            self.remove_item_files(item);
        }
        if let Err(error) = self.persist_locked(&state) {
            eprintln!("failed to remove expired secret clipboard entries: {error}");
        }
        drop(state);
        self.emit_changed();
    }
}

#[cfg(test)]
#[path = "privacy_tests.rs"]
mod tests;
