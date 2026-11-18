use serde_json::{Map, Value};
use std::collections::HashSet;

use super::{
    edit::text_hash,
    normalized_tags,
    pins::checked_key,
    privacy::{cap_text, other_device_source},
    secrets::looks_like_secret,
    split_note_tags,
    store::{create_item_id, preview_text},
    ClipboardHistoryItem, ClipboardHistoryItemKind,
};
use crate::sync::{clock, layout::Doc, record, Clock, Hlc, Tombstone};

pub(super) type PinBefore = (String, bool, Option<String>, Option<u32>);

impl ClipboardHistoryItem {
    pub(crate) fn id(&self) -> &str {
        &self.id
    }

    pub(crate) fn is_favorite(&self) -> bool {
        self.favorite
    }

    pub(crate) fn sync_updated_at(&self) -> Option<&Hlc> {
        self.updated_at.as_ref()
    }
}

pub(crate) fn is_syncable_text(item: &ClipboardHistoryItem) -> bool {
    item.kind == ClipboardHistoryItemKind::Text
        && !item.private
        && !item.masked
        && !item.truncated
        && !item.hash.trim().is_empty()
        && item
            .text
            .as_deref()
            .is_some_and(|text| !text.trim().is_empty() && !looks_like_secret(text))
}

pub(super) fn stamp(item: &mut ClipboardHistoryItem, hlc: Hlc) {
    item.device_id = Some(hlc.device.clone());
    item.updated_at = Some(hlc);
}

pub(super) fn clear_stamp(item: &mut ClipboardHistoryItem) {
    item.updated_at = None;
    item.device_id = None;
}

pub(super) fn fill_missing(items: &mut [ClipboardHistoryItem], device: &str) {
    for item in items {
        if !item.favorite || !is_syncable_text(item) {
            continue;
        }
        let ms = u64::try_from(item.copied_at.max(0)).unwrap_or(0);
        let hlc = item.updated_at.get_or_insert_with(|| Hlc::from_millis(ms, device));
        if item.device_id.is_none() {
            item.device_id = Some(hlc.device.clone());
        }
    }
}

pub(super) fn all_stamps<'a>(
    items: &'a [ClipboardHistoryItem],
    tombstones: &'a [Tombstone],
) -> impl Iterator<Item = &'a Hlc> {
    items
        .iter()
        .filter(|item| item.favorite && is_syncable_text(item))
        .filter_map(|item| item.updated_at.as_ref())
        .chain(tombstones.iter().map(|tombstone| &tombstone.deleted_at))
}

pub(super) fn snapshot_pins(items: &[ClipboardHistoryItem]) -> Vec<PinBefore> {
    items
        .iter()
        .map(|item| (item.id.clone(), item.favorite, item.pin_key.clone(), item.pin_order))
        .collect()
}

pub(super) fn on_favorite_toggled(
    item: &mut ClipboardHistoryItem,
    tombstones: &mut Vec<Tombstone>,
    clock: &mut Clock,
    wall: u64,
) -> bool {
    if item.favorite {
        if !is_syncable_text(item) {
            return false;
        }
        record::unbury(tombstones, &item.hash);
        stamp(item, clock.tick(wall));
        true
    } else {
        let syncable = is_syncable_text(item);
        item.pin_key = None;
        item.pin_order = None;
        clear_stamp(item);
        if !syncable {
            return false;
        }
        record::bury(tombstones, &item.hash, clock.tick(wall));
        record::prune(tombstones, wall);
        true
    }
}

pub(super) fn on_note_changed(
    item: &mut ClipboardHistoryItem,
    old_note: &str,
    old_tags: &[String],
    clock: &mut Clock,
    wall: u64,
) -> bool {
    if item.favorite && is_syncable_text(item) && (item.note != old_note || item.tags != old_tags) {
        stamp(item, clock.tick(wall));
        return true;
    }
    false
}

pub(super) fn on_pins_updated(
    before: &[PinBefore],
    items: &mut [ClipboardHistoryItem],
    tombstones: &mut Vec<Tombstone>,
    clock: &mut Clock,
    wall: u64,
) -> bool {
    let mut changed = false;
    for item in items {
        let Some((_, was_fav, old_key, old_order)) = before.iter().find(|entry| entry.0 == item.id) else {
            continue;
        };
        if !item.favorite || !is_syncable_text(item) {
            continue;
        }
        if (*was_fav, old_key.as_ref(), *old_order) != (item.favorite, item.pin_key.as_ref(), item.pin_order) {
            if !was_fav {
                record::unbury(tombstones, &item.hash);
            }
            stamp(item, clock.tick(wall));
            changed = true;
        }
    }
    changed
}

pub(super) fn on_item_edited(
    before: &ClipboardHistoryItem,
    after: &mut ClipboardHistoryItem,
    tombstones: &mut Vec<Tombstone>,
    clock: &mut Clock,
    wall: u64,
) -> bool {
    if !before.favorite && !after.favorite {
        return false;
    }
    let mut changed = false;
    if before.favorite
        && is_syncable_text(before)
        && (before.hash != after.hash || !after.favorite || !is_syncable_text(after))
    {
        record::bury(tombstones, &before.hash, clock.tick(wall));
        record::prune(tombstones, wall);
        changed = true;
    }
    if after.favorite && is_syncable_text(after) {
        record::unbury(tombstones, &after.hash);
        stamp(after, clock.tick(wall));
        changed = true;
    } else {
        clear_stamp(after);
    }
    changed
}

pub(super) fn on_items_removed(
    removed: &[(ClipboardHistoryItem, usize)],
    remaining: &[ClipboardHistoryItem],
    tombstones: &mut Vec<Tombstone>,
    clock: &mut Clock,
    wall: u64,
) -> bool {
    let mut changed = false;
    for (item, _) in removed {
        if item.favorite
            && is_syncable_text(item)
            && !remaining.iter().any(|kept| kept.favorite && kept.hash == item.hash)
        {
            record::bury(tombstones, &item.hash, clock.tick(wall));
            changed = true;
        }
    }
    if changed {
        record::prune(tombstones, wall);
    }
    changed
}

pub(super) fn on_items_restored(
    items: &mut [ClipboardHistoryItem],
    restored_ids: &[String],
    tombstones: &mut Vec<Tombstone>,
    clock: &mut Clock,
    wall: u64,
) -> bool {
    let wanted: HashSet<&str> = restored_ids.iter().map(String::as_str).collect();
    let mut changed = false;
    for item in items {
        if wanted.contains(item.id.as_str()) && item.favorite && is_syncable_text(item) {
            record::unbury(tombstones, &item.hash);
            stamp(item, clock.tick(wall));
            changed = true;
        }
    }
    changed
}

pub(super) fn on_imported(
    added: &mut [ClipboardHistoryItem],
    tombstones: &mut Vec<Tombstone>,
    clock: &mut Clock,
    wall: u64,
) -> bool {
    let mut changed = false;
    for item in added {
        item.from_sync = false;
        if item.favorite && is_syncable_text(item) {
            record::unbury(tombstones, &item.hash);
            stamp(item, clock.tick(wall));
            changed = true;
        } else {
            clear_stamp(item);
        }
    }
    changed
}

fn entry_value(item: &ClipboardHistoryItem) -> Value {
    let mut object = Map::new();
    object.insert("text".into(), Value::String(item.text.clone().unwrap_or_default()));
    if let Some(html) = item.html.as_ref().filter(|html| !html.trim().is_empty()) {
        object.insert("html".into(), Value::String(html.clone()));
    }
    if !item.note.is_empty() {
        object.insert("note".into(), Value::String(item.note.clone()));
    }
    if !item.tags.is_empty() {
        object.insert("tags".into(), serde_json::to_value(&item.tags).unwrap_or(Value::Null));
    }
    if let Some(key) = item.pin_key.as_deref().and_then(|key| checked_key(key).ok()) {
        object.insert("pinKey".into(), Value::String(key));
    }
    if let Some(order) = item.pin_order {
        object.insert("pinOrder".into(), Value::from(order));
    }
    object.insert("createdAt".into(), Value::from(item.created_at));
    Value::Object(object)
}

pub(crate) fn to_sync_doc(items: &[ClipboardHistoryItem], tombstones: &[Tombstone], device: &str) -> Doc {
    let protected: HashSet<&str> = items
        .iter()
        .filter(|item| !is_syncable_text(item))
        .map(|item| item.hash.as_str())
        .collect();
    let mut doc = Doc::default();
    for tombstone in tombstones {
        if protected.contains(tombstone.id.as_str()) {
            continue;
        }
        let kept = doc
            .tombstones
            .entry(tombstone.id.clone())
            .or_insert_with(|| tombstone.deleted_at.clone());
        if tombstone.deleted_at > *kept {
            *kept = tombstone.deleted_at.clone();
        }
    }
    for item in items {
        if !item.favorite || !is_syncable_text(item) {
            continue;
        }
        let updated_at = item
            .updated_at
            .clone()
            .unwrap_or_else(|| Hlc::from_millis(u64::try_from(item.copied_at.max(0)).unwrap_or(0), device));
        if doc.entries.get(&item.hash).is_some_and(|existing| existing.updated_at >= updated_at) {
            continue;
        }
        doc.put(item.hash.clone(), entry_value(item), updated_at);
    }
    doc.tombstones
        .retain(|hash, deleted_at| doc.entries.get(hash).is_none_or(|entry| *deleted_at > entry.updated_at));
    doc.entries
        .retain(|hash, entry| doc.tombstones.get(hash).is_none_or(|deleted_at| *deleted_at <= entry.updated_at));
    doc
}

fn parsed_tags(value: &Value, note: &str) -> (String, Vec<String>) {
    let (clean_note, from_note) = split_note_tags(note);
    let mut raw: Vec<String> = value
        .get("tags")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .map(str::to_string)
        .collect();
    raw.extend(from_note);
    (clean_note, normalized_tags(&raw))
}

fn unique_item_id(existing: &HashSet<String>, created_at: i64, hash: &str) -> String {
    let base = create_item_id(created_at, hash);
    if !existing.contains(&base) {
        return base;
    }
    for suffix in 1..10_000 {
        let candidate = format!("{base}-{suffix}");
        if !existing.contains(&candidate) {
            return candidate;
        }
    }
    format!("{base}-sync")
}

pub(crate) fn apply_sync_doc(
    local: &[ClipboardHistoryItem],
    merged: &Doc,
    text_limit: usize,
) -> (Vec<ClipboardHistoryItem>, Vec<Tombstone>) {
    let protected_hashes: HashSet<String> = local
        .iter()
        .filter(|item| !is_syncable_text(item))
        .map(|item| item.hash.clone())
        .collect();
    let mut used_pin_keys: HashSet<String> = local
        .iter()
        .filter(|item| !is_syncable_text(item) && item.favorite)
        .filter_map(|item| item.pin_key.as_deref())
        .filter_map(|key| checked_key(key).ok())
        .collect();

    let mut next_items: Vec<ClipboardHistoryItem> = Vec::with_capacity(local.len() + merged.entries.len());
    let mut matched_hashes: HashSet<String> = HashSet::new();
    let mut used_ids: HashSet<String> = local.iter().map(|item| item.id.clone()).collect();

    for item in local {
        if !is_syncable_text(item) {
            next_items.push(item.clone());
            continue;
        }
        if let Some(entry) = merged.entries.get(&item.hash).filter(|_| !matched_hashes.contains(&item.hash)) {
            let Some(raw_text) = entry.value.get("text").and_then(Value::as_str).filter(|text| !text.trim().is_empty()) else {
                next_items.push(item.clone());
                continue;
            };
            if looks_like_secret(raw_text) || text_hash(raw_text) != item.hash {
                next_items.push(item.clone());
                continue;
            }
            matched_hashes.insert(item.hash.clone());
            let raw_html = entry.value.get("html").and_then(Value::as_str).map(str::to_string);
            let (capped, html, truncated) = cap_text(raw_text.to_string(), raw_html, text_limit);
            if truncated {
                next_items.push(item.clone());
                continue;
            }
            let raw_note = entry.value.get("note").and_then(Value::as_str).unwrap_or_default();
            let (note, tags) = parsed_tags(&entry.value, raw_note);
            let pin_key = entry
                .value
                .get("pinKey")
                .and_then(Value::as_str)
                .and_then(|key| checked_key(key).ok())
                .filter(|key| used_pin_keys.insert(key.clone()));
            let pin_order = entry
                .value
                .get("pinOrder")
                .and_then(Value::as_u64)
                .and_then(|order| u32::try_from(order).ok());
            let mut updated = item.clone();
            updated.favorite = true;
            updated.preview = preview_text(&capped);
            updated.text = Some(capped);
            updated.html = html;
            updated.note = note;
            updated.tags = tags;
            updated.pin_key = pin_key;
            updated.pin_order = pin_order;
            stamp(&mut updated, entry.updated_at.clone());
            next_items.push(updated);
        } else if item.favorite {
            if item.from_sync {
                used_ids.remove(&item.id);
                continue;
            }
            let mut demoted = item.clone();
            demoted.favorite = false;
            demoted.pin_key = None;
            demoted.pin_order = None;
            clear_stamp(&mut demoted);
            next_items.push(demoted);
        } else {
            next_items.push(item.clone());
        }
    }

    let mut incoming: Vec<(&String, &crate::sync::layout::Entry)> = merged
        .entries
        .iter()
        .filter(|(hash, _)| !matched_hashes.contains(*hash) && !protected_hashes.contains(*hash))
        .collect();
    incoming.sort_by(|left, right| right.1.updated_at.cmp(&left.1.updated_at));

    for (hash, entry) in incoming {
        let Some(raw_text) = entry.value.get("text").and_then(Value::as_str).filter(|text| !text.trim().is_empty()) else {
            continue;
        };
        if looks_like_secret(raw_text) || text_hash(raw_text) != *hash {
            continue;
        }
        let raw_html = entry.value.get("html").and_then(Value::as_str).map(str::to_string);
        let (capped, html, truncated) = cap_text(raw_text.to_string(), raw_html, text_limit);
        if truncated {
            continue;
        }
        let created_at = entry
            .value
            .get("createdAt")
            .and_then(Value::as_i64)
            .unwrap_or_else(|| i64::try_from(entry.updated_at.ms).unwrap_or(0));
        let id = unique_item_id(&used_ids, created_at, hash);
        used_ids.insert(id.clone());
        let raw_note = entry.value.get("note").and_then(Value::as_str).unwrap_or_default();
        let (note, tags) = parsed_tags(&entry.value, raw_note);
        let pin_key = entry
            .value
            .get("pinKey")
            .and_then(Value::as_str)
            .and_then(|key| checked_key(key).ok())
            .filter(|key| used_pin_keys.insert(key.clone()));
        let pin_order = entry
            .value
            .get("pinOrder")
            .and_then(Value::as_u64)
            .and_then(|order| u32::try_from(order).ok());
        let mut added = ClipboardHistoryItem {
            id,
            kind: ClipboardHistoryItemKind::Text,
            hash: hash.clone(),
            created_at,
            copied_at: created_at,
            favorite: true,
            note,
            preview: preview_text(&capped),
            text: Some(capped),
            image: None,
            html,
            files: None,
            file_image: None,
            source: Some(other_device_source()),
            tags,
            ocr_text: None,
            masked: false,
            pin_key,
            pin_order,
            truncated: false,
            edited_at: None,
            private: false,
            from_sync: true,
            updated_at: None,
            device_id: None,
        };
        stamp(&mut added, entry.updated_at.clone());
        next_items.push(added);
    }

    let tombstones: Vec<Tombstone> = merged
        .tombstones
        .iter()
        .filter(|(hash, _)| !protected_hashes.contains(*hash))
        .map(|(hash, deleted_at)| Tombstone::new(hash, deleted_at.clone()))
        .collect();
    (next_items, tombstones)
}

pub(crate) fn favorites_for_sync() -> Result<Option<(Vec<ClipboardHistoryItem>, Vec<Tombstone>, usize)>, String> {
    let Ok(service) = super::service() else { return Ok(None) };
    let state = service.state.lock().map_err(|error| error.to_string())?;
    Ok(Some((
        state.items.clone(),
        state.favorite_tombstones.clone(),
        state.settings.privacy.max_text_bytes(),
    )))
}

pub(crate) fn replace_favorites_from_sync(
    expected_hashes: &[(String, bool, Option<Hlc>)],
    expected_tombstones: &[Tombstone],
    merged: &Doc,
) -> Result<(), String> {
    let service = super::service()?;
    let mut state = service.state.lock().map_err(|error| error.to_string())?;
    let current_hashes: Vec<(String, bool, Option<Hlc>)> = state
        .items
        .iter()
        .map(|item| (item.id.clone(), item.favorite, item.updated_at.clone()))
        .collect();
    if current_hashes != expected_hashes || state.favorite_tombstones != expected_tombstones {
        return Err("The clipboard favorites changed while syncing; trying again later.".into());
    }
    let limit = state.settings.privacy.max_text_bytes();
    let (next_items, next_tombstones) = apply_sync_doc(&state.items, merged, limit);
    clock::observe(all_stamps(&next_items, &next_tombstones));
    state.items = next_items;
    state.favorite_tombstones = next_tombstones;
    service.enforce_limit_locked(&mut state);
    service.persist_locked(&state)?;
    drop(state);
    service.emit_changed();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn text_item(id: &str, text: &str, favorite: bool) -> ClipboardHistoryItem {
        serde_json::from_value(json!({
            "id": id,
            "kind": "text",
            "hash": text_hash(text),
            "createdAt": 500,
            "copiedAt": 500,
            "favorite": favorite,
            "note": "",
            "preview": text,
            "text": text,
        }))
        .expect("text item")
    }

    #[test]
    fn favoriting_unfavoriting_editing_and_deleting_track_stamps_and_tombstones() {
        let mut clock = Clock::new("dev1");
        let mut tombstones = Vec::new();
        let mut item = text_item("1", "hello", true);
        assert!(on_favorite_toggled(&mut item, &mut tombstones, &mut clock, 1_000));
        let hello_hash = item.hash.clone();
        assert_eq!(item.updated_at, Some(Hlc::from_millis(1_000, "dev1")));
        assert!(tombstones.is_empty());

        item.favorite = false;
        item.pin_key = Some("K".into());
        assert!(on_favorite_toggled(&mut item, &mut tombstones, &mut clock, 2_000));
        assert!(item.pin_key.is_none() && item.updated_at.is_none());
        assert_eq!(tombstones, vec![Tombstone::new(&hello_hash, Hlc::from_millis(2_000, "dev1"))]);

        let before_pins = snapshot_pins(std::slice::from_ref(&item));
        item.favorite = true;
        item.pin_key = Some("M".into());
        let mut items = vec![item];
        assert!(on_pins_updated(&before_pins, &mut items, &mut tombstones, &mut clock, 3_000));
        assert!(tombstones.is_empty());
        assert_eq!(items[0].updated_at, Some(Hlc::from_millis(3_000, "dev1")));

        let before_edit = items[0].clone();
        items[0] = text_item("1", "sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789", true);
        assert!(on_item_edited(&before_edit, &mut items[0], &mut tombstones, &mut clock, 4_000));
        assert!(items[0].updated_at.is_none());
        assert_eq!(tombstones, vec![Tombstone::new(&hello_hash, Hlc::from_millis(4_000, "dev1"))]);
    }
}
