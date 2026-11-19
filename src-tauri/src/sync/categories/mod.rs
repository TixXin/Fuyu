pub(crate) mod clip_favorites;
pub(crate) mod links;
pub(crate) mod plugin_roster;
pub(crate) mod settings;
pub(crate) mod snippets;
pub(crate) mod todos;

use serde_json::Value;
use std::collections::BTreeMap;

use super::{config::SyncCategory, layout::Doc, Hlc, Tombstone};

pub(crate) trait Category {
    fn kind(&self) -> SyncCategory;
    fn load(&mut self) -> Result<Option<Doc>, String>;
    fn store(&mut self, merged: &Doc) -> Result<(), String>;

    fn pinned(&self, _id: &str) -> bool {
        false
    }

    fn tidy(&self, _doc: &mut Doc, _tick: &mut dyn FnMut() -> Hlc) {}
}

pub(crate) fn zero(device: &str) -> Hlc {
    Hlc::from_millis(0, device)
}

pub(crate) fn bare(value: &Value) -> Value {
    let mut value = value.clone();
    if let Some(object) = value.as_object_mut() {
        object.remove("updatedAt");
        object.remove("deviceId");
    }
    value
}

pub(crate) fn stamped(value: &Value, updated_at: &Hlc) -> Value {
    let mut value = value.clone();
    if let Some(object) = value.as_object_mut() {
        object.insert("updatedAt".into(), Value::String(updated_at.to_string()));
        object.insert("deviceId".into(), Value::String(updated_at.device.clone()));
    }
    value
}

pub(crate) fn ordered_ids<'a>(local: impl IntoIterator<Item = &'a str>, present: &[&'a str]) -> Vec<&'a str> {
    let mut ids: Vec<&str> = Vec::new();
    for id in local {
        if present.contains(&id) && !ids.contains(&id) {
            ids.push(id);
        }
    }
    let mut rest: Vec<&str> = present.iter().copied().filter(|id| !ids.contains(id)).collect();
    rest.sort_unstable();
    rest.dedup();
    ids.extend(rest);
    ids
}

pub(crate) fn doc_tombstones(tombstones: &[Tombstone]) -> BTreeMap<String, Hlc> {
    let mut map: BTreeMap<String, Hlc> = BTreeMap::new();
    for tombstone in tombstones {
        let kept = map.entry(tombstone.id.clone()).or_insert_with(|| tombstone.deleted_at.clone());
        if tombstone.deleted_at > *kept {
            *kept = tombstone.deleted_at.clone();
        }
    }
    map
}

pub(crate) fn tombstone_list<'a>(tombstones: impl IntoIterator<Item = (&'a String, &'a Hlc)>) -> Vec<Tombstone> {
    tombstones.into_iter().map(|(id, deleted_at)| Tombstone::new(id, deleted_at.clone())).collect()
}

pub(crate) fn records_from(doc: &Doc, local: &[Value]) -> Vec<Value> {
    let local_ids: Vec<&str> = local.iter().filter_map(|item| item.get("id").and_then(Value::as_str)).collect();
    let present: Vec<&str> = doc.entries.keys().map(String::as_str).collect();
    ordered_ids(local_ids, &present)
        .into_iter()
        .filter_map(|id| doc.entries.get(id))
        .map(|entry| stamped(&entry.value, &entry.updated_at))
        .collect()
}

pub(crate) fn records_doc(items: &[Value], tombstones: &[Tombstone], device: &str) -> Doc {
    let mut doc = Doc { tombstones: doc_tombstones(tombstones), ..Doc::default() };
    for item in items {
        let Some(id) = item.get("id").and_then(Value::as_str).filter(|id| !id.is_empty()) else { continue };
        let updated_at = item.get("updatedAt").and_then(Value::as_str).and_then(|text| text.parse().ok()).unwrap_or_else(|| zero(device));
        doc.put(id, bare(item), updated_at);
    }
    doc.tombstones.retain(|id, deleted_at| doc.entries.get(id).is_none_or(|entry| *deleted_at > entry.updated_at));
    doc.entries.retain(|id, entry| doc.tombstones.get(id).is_none_or(|deleted_at| *deleted_at <= entry.updated_at));
    doc
}
