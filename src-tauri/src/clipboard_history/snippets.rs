use chrono::{DateTime, Datelike, Local};
use serde::{Deserialize, Serialize};

use super::{
    current_unix_millis, store::create_item_id, ClipboardHistoryService, ClipboardHistorySnapshot,
};
use crate::sync::{clock, record, Clock, Hlc, Tombstone};

const MAX_SNIPPETS: usize = 100;
const MAX_TITLE_CHARACTERS: usize = 40;
const MAX_TEXT_CHARACTERS: usize = 20_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardSnippet {
    id: String,
    title: String,
    text: String,
    #[serde(default, deserialize_with = "clock::lenient", skip_serializing_if = "Option::is_none")]
    updated_at: Option<Hlc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    device_id: Option<String>,
}

pub(super) fn expand_snippet(text: &str, now: DateTime<Local>, clipboard: Option<&str>) -> String {
    const WEEKDAYS: [&str; 7] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    text.replace("{{", "\u{0}")
        .replace("}}", "\u{1}")
        .replace("{datetime}", &now.format("%Y-%m-%d %H:%M").to_string())
        .replace("{date}", &now.format("%Y-%m-%d").to_string())
        .replace("{time}", &now.format("%H:%M").to_string())
        .replace("{weekday}", WEEKDAYS[now.weekday().num_days_from_monday() as usize])
        .replace("{clipboard}", clipboard.unwrap_or_default())
        .replace('\u{0}', "{")
        .replace('\u{1}', "}")
}

impl ClipboardSnippet {
    pub(super) fn text(&self) -> &str {
        &self.text
    }

    fn stamp(&mut self, stamp: Hlc) {
        self.device_id = Some(stamp.device.clone());
        self.updated_at = Some(stamp);
    }

    fn edit(&mut self, title: String, text: String, stamp: impl FnOnce() -> Hlc) {
        if self.title != title || self.text != text {
            self.title = title;
            self.text = text;
            self.stamp(stamp());
        }
    }
}

fn created_ms(id: &str) -> u64 {
    id.split('-').next().and_then(|prefix| prefix.parse().ok()).unwrap_or(0)
}

pub(super) fn fill_missing(snippets: &mut [ClipboardSnippet], device: &str) {
    for snippet in snippets {
        let stamp = snippet.updated_at.get_or_insert_with(|| Hlc::from_millis(created_ms(&snippet.id), device));
        if snippet.device_id.is_none() {
            snippet.device_id = Some(stamp.device.clone());
        }
    }
}

pub(super) fn all_stamps<'a>(snippets: &'a [ClipboardSnippet], tombstones: &'a [Tombstone]) -> impl Iterator<Item = &'a Hlc> {
    snippets.iter().filter_map(|snippet| snippet.updated_at.as_ref()).chain(tombstones.iter().map(|tombstone| &tombstone.deleted_at))
}

fn remove(snippets: &mut Vec<ClipboardSnippet>, tombstones: &mut Vec<Tombstone>, id: &str, clock: &mut Clock, wall: u64) -> bool {
    let before = snippets.len();
    snippets.retain(|snippet| snippet.id != id);
    if snippets.len() == before {
        return false;
    }
    record::bury(tombstones, id, clock.tick(wall));
    record::prune(tombstones, wall);
    true
}

pub(super) fn adopt(snippets: &mut Vec<ClipboardSnippet>, tombstones: &mut Vec<Tombstone>, mut snippet: ClipboardSnippet, clock: &mut Clock, wall: u64) {
    if snippet.id.trim().is_empty() || snippets.iter().any(|kept| kept.id == snippet.id) {
        snippet.id = create_item_id(current_unix_millis(), &format!("snippet{}", snippets.len()));
    }
    record::unbury(tombstones, &snippet.id);
    snippet.stamp(clock.tick(wall));
    snippets.push(snippet);
}

impl ClipboardHistoryService {
    pub(super) fn save_snippet(&self, id: Option<&str>, title: &str, text: &str) -> Result<ClipboardHistorySnapshot, String> {
        let text: String = text.chars().take(MAX_TEXT_CHARACTERS).collect();
        if text.trim().is_empty() {
            return Err("A snippet needs some text.".to_string());
        }
        let title = match title.trim() {
            "" => text.lines().find(|line| !line.trim().is_empty()).unwrap_or_default().trim(),
            title => title,
        };
        let title: String = title.chars().take(MAX_TITLE_CHARACTERS).collect();
        let mut state = self.state.lock().map_err(|error| error.to_string())?;
        match id.and_then(|id| state.snippets.iter_mut().find(|snippet| snippet.id == id)) {
            Some(snippet) => snippet.edit(title, text, || clock::with(|clock, wall| clock.tick(wall))),
            None => {
                if state.snippets.len() >= MAX_SNIPPETS {
                    return Err(format!("At most {MAX_SNIPPETS} snippets."));
                }
                let now = current_unix_millis();
                let id = create_item_id(now, &format!("snippet{}", state.snippets.len()));
                let mut snippet = ClipboardSnippet { id, title, text, updated_at: None, device_id: None };
                snippet.stamp(clock::with(|clock, wall| clock.tick(wall)));
                record::unbury(&mut state.snippet_tombstones, &snippet.id);
                state.snippets.push(snippet);
            }
        }
        self.persist_locked(&state)?;
        let snapshot = Self::snapshot_locked(&state);
        drop(state);
        self.emit_changed();
        Ok(snapshot)
    }

    pub(super) fn delete_snippet(&self, id: &str) -> Result<ClipboardHistorySnapshot, String> {
        let mut state = self.state.lock().map_err(|error| error.to_string())?;
        let state_ref = &mut *state;
        if clock::with(|clock, wall| remove(&mut state_ref.snippets, &mut state_ref.snippet_tombstones, id, clock, wall)) {
            self.persist_locked(&state)?;
        }
        let snapshot = Self::snapshot_locked(&state);
        drop(state);
        self.emit_changed();
        Ok(snapshot)
    }

    pub(super) fn snippet_text(&self, id: &str) -> Result<String, String> {
        let text = {
            let state = self.state.lock().map_err(|error| error.to_string())?;
            state
                .snippets
                .iter()
                .find(|snippet| snippet.id == id)
                .map(|snippet| snippet.text.clone())
                .ok_or_else(|| "The snippet was not found.".to_string())?
        };
        let clipboard = if text.contains("{clipboard}") { arboard::Clipboard::new().ok().and_then(|mut board| board.get_text().ok()) } else { None };
        Ok(expand_snippet(&text, Local::now(), clipboard.as_deref()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn snippet(id: &str, text: &str) -> ClipboardSnippet {
        ClipboardSnippet { id: id.into(), title: text.into(), text: text.into(), updated_at: None, device_id: None }
    }

    #[test]
    fn old_snippets_get_their_creation_time_and_keep_reading() {
        let mut snippets: Vec<ClipboardSnippet> = serde_json::from_str(r#"[{"id":"1762300000000-snippet0","title":"a","text":"A"},{"id":"odd","title":"b","text":"B","updatedAt":"broken"}]"#).expect("old snippets");
        fill_missing(&mut snippets, "dev1");
        assert_eq!(snippets[0].updated_at, Some(Hlc::from_millis(1_762_300_000_000, "dev1")));
        assert_eq!(snippets[0].device_id.as_deref(), Some("dev1"));
        assert_eq!(snippets[1].updated_at, Some(Hlc::from_millis(0, "dev1")));
        let written = serde_json::to_string(&snippets[0]).expect("encode");
        assert!(written.contains(r#""updatedAt":"001762300000000-000000-dev1""#), "{written}");
        assert_eq!(serde_json::from_str::<ClipboardSnippet>(&written).expect("decode"), snippets[0]);
    }

    #[test]
    fn editing_stamps_only_a_real_change() {
        let mut clock = Clock::new("dev1");
        let mut snippets = vec![snippet("a", "A"), snippet("b", "B")];
        fill_missing(&mut snippets, "dev1");
        let untouched = snippets[1].clone();
        let before = snippets[0].updated_at.clone();
        snippets[0].edit("A".into(), "A".into(), || clock.tick(5_000));
        assert_eq!(snippets[0].updated_at, before);
        snippets[0].edit("A".into(), "changed".into(), || clock.tick(5_000));
        assert_eq!(snippets[0].updated_at, Some(Hlc::from_millis(5_000, "dev1")));
        assert_eq!(snippets[1], untouched);
    }

    #[test]
    fn deleting_leaves_a_tombstone_and_an_import_counts_as_a_local_change() {
        let mut clock = Clock::new("dev1");
        let (mut snippets, mut tombstones) = (vec![snippet("a", "A"), snippet("b", "B")], Vec::new());
        assert!(remove(&mut snippets, &mut tombstones, "a", &mut clock, 7_000));
        assert!(!remove(&mut snippets, &mut tombstones, "zzz", &mut clock, 7_000));
        assert_eq!(tombstones, vec![Tombstone::new("a", Hlc::from_millis(7_000, "dev1"))]);
        let mut imported = snippet("a", "again");
        imported.stamp(Hlc::from_millis(1, "other"));
        adopt(&mut snippets, &mut tombstones, imported, &mut clock, 8_000);
        adopt(&mut snippets, &mut tombstones, snippet("b", "clash"), &mut clock, 8_000);
        assert!(tombstones.is_empty());
        assert_eq!(snippets[1].updated_at, Some(Hlc::from_millis(8_000, "dev1")));
        assert_eq!(snippets[1].device_id.as_deref(), Some("dev1"));
        assert_ne!(snippets[2].id, "b");
    }

    #[test]
    fn variables_are_filled_in() {
        let now = Local.with_ymd_and_hms(2026, 11, 9, 14, 5, 0).single().expect("valid time");
        assert_eq!(
            expand_snippet("{date} {time} {weekday} [{clipboard}] {{date}}", now, Some("x")),
            "2026-11-09 14:05 周一 [x] {date}"
        );
        assert_eq!(expand_snippet("{datetime}", now, None), "2026-11-09 14:05");
        assert_eq!(expand_snippet("no vars", now, None), "no vars");
    }
}
