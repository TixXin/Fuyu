use serde_json::Value;
use std::collections::BTreeMap;

use super::Category;
use crate::{
    clipboard_history::{
        checked_pin_key, favorites_for_sync, is_secret_clipboard_text, replace_favorites_from_sync,
        sync_favorites_apply, sync_favorites_to_doc, text_clipboard_hash, ClipboardHistoryItem,
    },
    sync::{config::SyncCategory, layout::Doc, Hlc, Tombstone},
};

pub(crate) fn to_doc(items: &[ClipboardHistoryItem], tombstones: &[Tombstone], device: &str) -> Doc {
    sync_favorites_to_doc(items, tombstones, device)
}

pub(crate) fn apply(
    local: &[ClipboardHistoryItem],
    merged: &Doc,
    text_limit: usize,
) -> (Vec<ClipboardHistoryItem>, Vec<Tombstone>) {
    sync_favorites_apply(local, merged, text_limit)
}

pub(crate) fn tidy(doc: &mut Doc, tick: &mut dyn FnMut() -> Hlc) {
    doc.entries.retain(|hash, entry| {
        entry
            .value
            .get("text")
            .and_then(Value::as_str)
            .is_some_and(|text| !text.trim().is_empty() && !is_secret_clipboard_text(text) && text_clipboard_hash(text) == *hash)
    });

    let mut winners: BTreeMap<String, (Hlc, String)> = BTreeMap::new();
    let mut losers: Vec<String> = Vec::new();
    let mut invalid_keys: Vec<String> = Vec::new();

    for (hash, entry) in &doc.entries {
        let Some(raw_key) = entry.value.get("pinKey").and_then(Value::as_str) else {
            continue;
        };
        let Ok(key) = checked_pin_key(raw_key) else {
            invalid_keys.push(hash.clone());
            continue;
        };
        match winners.get(&key) {
            Some((kept_at, kept_hash)) if (kept_at, kept_hash.as_str()) >= (&entry.updated_at, hash.as_str()) => {
                losers.push(hash.clone());
            }
            _ => {
                if let Some((_, previous_hash)) = winners.insert(key, (entry.updated_at.clone(), hash.clone())) {
                    losers.push(previous_hash);
                }
            }
        }
    }

    for hash in invalid_keys {
        if let Some(entry) = doc.entries.get_mut(&hash) {
            if let Some(object) = entry.value.as_object_mut() {
                object.remove("pinKey");
            }
        }
    }

    for hash in losers {
        if let Some(entry) = doc.entries.get_mut(&hash) {
            if let Some(object) = entry.value.as_object_mut() {
                object.remove("pinKey");
            }
            entry.updated_at = tick();
        }
    }
}

type LoadedFavorites = (Vec<(String, bool, Option<Hlc>)>, Vec<Tombstone>);

pub(crate) struct ClipFavorites {
    device: String,
    loaded: Option<LoadedFavorites>,
}

impl ClipFavorites {
    pub(crate) fn new(device: &str) -> Self {
        Self { device: device.into(), loaded: None }
    }
}

impl Category for ClipFavorites {
    fn kind(&self) -> SyncCategory {
        SyncCategory::ClipFavorites
    }

    fn load(&mut self) -> Result<Option<Doc>, String> {
        let Some((items, tombstones, _)) = favorites_for_sync()? else {
            return Ok(None);
        };
        let doc = to_doc(&items, &tombstones, &self.device);
        let hashes = items
            .iter()
            .map(|item| (item.id().to_string(), item.is_favorite(), item.sync_updated_at().cloned()))
            .collect();
        self.loaded = Some((hashes, tombstones));
        Ok(Some(doc))
    }

    fn store(&mut self, merged: &Doc) -> Result<(), String> {
        let (expected_hashes, expected_tombstones) = self.loaded.as_ref().ok_or("The clipboard favorites were not loaded.")?;
        replace_favorites_from_sync(expected_hashes, expected_tombstones, merged)
    }

    fn tidy(&self, doc: &mut Doc, tick: &mut dyn FnMut() -> Hlc) {
        tidy(doc, tick);
    }
}
