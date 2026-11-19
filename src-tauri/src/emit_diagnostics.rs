use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    hash::{DefaultHasher, Hash, Hasher},
    time::Duration,
};
#[cfg(debug_assertions)]
use std::{
    fs,
    path::PathBuf,
    sync::{Arc, Mutex, PoisonError},
    thread,
    time::{Instant, SystemTime, UNIX_EPOCH},
};
#[cfg(debug_assertions)]
use tauri::{AppHandle, Listener};

const MAX_DISTINCT_HASHES: usize = 65_536;

const KNOWN_EVENTS: &[&str] = &[
    "agent-approval-closed",
    "agent-approval-hotkey",
    "agent-approval-requested",
    "agent-editor-extension-missing",
    "agent-focus-window-only",
    "builtin-diagnostics-report",
    "builtin-diagnostics-request",
    "builtin-plugins-changed",
    "clipboard-history-changed",
    "clipboard-history-shortcut",
    "clipboard-history-shortcut-status",
    "clipboard-item-copied",
    "clipboard-links-changed",
    "clipboard-popup-first-frame",
    "clipboard-popup-opened",
    "clipboard-preview-closing",
    "clipboard-preview-layout",
    "clipboard-preview-opened",
    "dev-priority-changed",
    "device-alert",
    "drag-grid-state",
    "file-shelf-changed",
    "foreground-fullscreen-changed",
    "island-auto-form-changed",
    "island-banner-hover-changed",
    "island-cursor-moved",
    "island-drag-edge-hint",
    "island-edge-changed",
    "island-hide-hints",
    "island-hold-changed",
    "island-hover-changed",
    "island-move-armed-changed",
    "island-notch-changed",
    "island-outside-click",
    "island-position-changed",
    "island-position-cleared",
    "island-resize",
    "island-reveal-requested",
    "island-top-attachment-changed",
    "local-api-request",
    "media-session-changed",
    "onboarding-island",
    "plugin-host-event",
    "plugin-keybinding",
    "plugin-market-install-requested",
    "plugin-open-view",
    "plugin-permission-request",
    "plugin-view-changed",
    "qq-mail-changed",
    "qq-notifications-changed",
    "recording-finished",
    "recording-state",
    "screenshot-history-changed",
    "screenshot-long",
    "screenshot-long-progress",
    "screenshot-pin-assigned",
    "screenshot-session",
    "screenshot-shortcut-status",
    "screenshot-taken",
    "screenshot-targets",
    "screenshot-text",
    "screenshot-translate",
    "settings-sync-applied",
    "settings-window-reopened",
    "shortcut-captured",
    "sync-status-changed",
    "system-level-changed",
    "timer-shortcut",
    "timer-shortcut-status",
    "todos-changed",
    "translation-island-shortcut",
    "translation-selection",
    "translation-window-opened",
    "tray-menu-open",
    "tray-menu-open-page",
    "tray-menu-state",
    "updater-open-settings",
    "updater-state-changed",
    "voice-input-model-progress",
    "voice-input-shortcut-status",
    "voice-input-state",
    "wallpaper-changed",
    "wechat-reminder-changed",
];

#[derive(Default)]
struct Entry {
    total: u64,
    duplicates: u64,
    last_hash: Option<u64>,
    distinct: HashSet<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EventRow {
    pub event: &'static str,
    pub total: u64,
    pub duplicates: u64,
    pub distinct_payloads: usize,
    pub per_minute: f64,
}

#[derive(Default)]
pub(crate) struct Recorder {
    entries: HashMap<&'static str, Entry>,
}

fn payload_hash(payload: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    payload.hash(&mut hasher);
    hasher.finish()
}

impl Recorder {
    pub(crate) fn record(&mut self, event: &'static str, payload: &str) {
        let hash = payload_hash(payload);
        let entry = self.entries.entry(event).or_default();
        entry.total = entry.total.saturating_add(1);
        if entry.last_hash == Some(hash) {
            entry.duplicates = entry.duplicates.saturating_add(1);
        }
        entry.last_hash = Some(hash);
        if entry.distinct.len() < MAX_DISTINCT_HASHES {
            entry.distinct.insert(hash);
        }
    }

    pub(crate) fn rows(&self, elapsed: Duration) -> Vec<EventRow> {
        let minutes = (elapsed.as_secs_f64() / 60.0).max(1.0 / 60.0);
        let mut rows: Vec<EventRow> = self
            .entries
            .iter()
            .map(|(&event, entry)| EventRow {
                event,
                total: entry.total,
                duplicates: entry.duplicates,
                distinct_payloads: entry.distinct.len(),
                per_minute: ((entry.total as f64 / minutes) * 100.0).round() / 100.0,
            })
            .collect();
        rows.sort_by(|left, right| right.total.cmp(&left.total).then_with(|| left.event.cmp(right.event)));
        rows
    }
}

#[cfg(debug_assertions)]
pub(crate) fn start(app: &AppHandle) {
    if std::env::var("FUYU_EMIT_DIAGNOSTICS").as_deref() != Ok("1") {
        return;
    }
    let interval_secs = std::env::var("FUYU_EMIT_DIAGNOSTICS_INTERVAL_SECS")
        .ok()
        .and_then(|raw| raw.parse::<u64>().ok())
        .unwrap_or(15)
        .clamp(2, 300);
    let path = std::env::var("FUYU_EMIT_DIAGNOSTICS_PATH")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            std::env::temp_dir()
                .join("Fuyu-emit-diagnostics")
                .join(format!("emit-{}.json", std::process::id()))
        });
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let recorder = Arc::new(Mutex::new(Recorder::default()));
    for &event_name in KNOWN_EVENTS {
        let shared = Arc::clone(&recorder);
        app.listen(event_name, move |event| {
            let mut guard = shared.lock().unwrap_or_else(PoisonError::into_inner);
            guard.record(event_name, event.payload());
        });
    }
    let started_unix_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis());
    let _ = thread::Builder::new()
        .name("emit-diagnostics".into())
        .spawn(move || {
            let started = Instant::now();
            loop {
                thread::sleep(Duration::from_secs(interval_secs));
                let elapsed = started.elapsed();
                let rows = recorder
                    .lock()
                    .unwrap_or_else(PoisonError::into_inner)
                    .rows(elapsed);
                let total_emits: u64 = rows.iter().map(|row| row.total).sum();
                let total_distinct: usize = rows.iter().map(|row| row.distinct_payloads).sum();
                let report = serde_json::json!({
                    "pid": std::process::id(),
                    "startedAtUnixMs": started_unix_ms,
                    "elapsedSeconds": elapsed.as_secs_f64(),
                    "totalEmits": total_emits,
                    "totalDistinctPayloads": total_distinct,
                    "events": rows,
                });
                if let Ok(bytes) = serde_json::to_vec_pretty(&report) {
                    let _ = crate::fs_write::replace_file(&path, &bytes);
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_events_are_sorted_and_unique() {
        for pair in KNOWN_EVENTS.windows(2) {
            assert!(pair[0] < pair[1], "{} >= {}", pair[0], pair[1]);
        }
    }

    #[test]
    fn recorder_sorts_by_frequency_and_counts_distinct_and_duplicate_payloads() {
        let mut recorder = Recorder::default();
        recorder.record("sync-status-changed", r#"{"phase":"off"}"#);
        recorder.record("sync-status-changed", r#"{"phase":"off"}"#);
        recorder.record("island-cursor-moved", r#"{"x":12,"y":8}"#);
        recorder.record("island-cursor-moved", r#"{"x":36,"y":8}"#);
        recorder.record("island-cursor-moved", r#"{"x":36,"y":8}"#);

        let rows = recorder.rows(Duration::from_secs(30));
        assert_eq!(rows.len(), 2);
        assert_eq!(
            rows[0],
            EventRow {
                event: "island-cursor-moved",
                total: 3,
                duplicates: 1,
                distinct_payloads: 2,
                per_minute: 6.0,
            }
        );
        assert_eq!(
            rows[1],
            EventRow {
                event: "sync-status-changed",
                total: 2,
                duplicates: 1,
                distinct_payloads: 1,
                per_minute: 4.0,
            }
        );
    }
}
