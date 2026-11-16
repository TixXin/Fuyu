use serde_json::{json, Map, Value};
use std::collections::BTreeMap;

use super::{bare, doc_tombstones, ordered_ids, stamped, tombstone_list, zero, Category};
use crate::sync::{
    config::SyncCategory,
    layout::{Doc, Note},
    Hlc, Tombstone,
};

const ARCHIVE_PREFIX: &str = "archive:";
const TODAY: &str = "today";
const SCHEDULED: &str = "scheduled";
const ARCHIVE: &str = "archive";

fn stamp_of(value: &Value, field: &str) -> Option<Hlc> {
    value.get(field).and_then(Value::as_str).and_then(|text| text.parse().ok())
}

fn array<'a>(value: &'a Value, field: &str) -> &'a [Value] {
    value.get(field).and_then(Value::as_array).map(Vec::as_slice).unwrap_or_default()
}

fn text<'a>(value: &'a Value, field: &str) -> &'a str {
    value.get(field).and_then(Value::as_str).unwrap_or_default()
}

fn put_items(doc: &mut Doc, items: &[Value], place: Value, device: &str) {
    for item in items {
        let id = text(item, "id");
        if id.is_empty() || id.starts_with(ARCHIVE_PREFIX) {
            continue;
        }
        let updated_at = stamp_of(item, "updatedAt").unwrap_or_else(|| zero(device));
        doc.put(id, json!({ "place": place, "item": bare(item) }), updated_at);
    }
}

fn put_note(doc: &mut Doc, date: &str, text: &str, updated_at: Option<Hlc>, device: &str) {
    if date.is_empty() || (text.is_empty() && updated_at.is_none()) || doc.notes.contains_key(date) {
        return;
    }
    doc.notes.insert(date.into(), Note { text: text.into(), updated_at: updated_at.unwrap_or_else(|| zero(device)) });
}

pub(crate) fn to_doc(data: &Value, device: &str) -> Doc {
    let mut doc = Doc { tombstones: doc_tombstones(&serde_json::from_value::<Vec<Tombstone>>(data.get("tombstones").cloned().unwrap_or(Value::Null)).unwrap_or_default()), ..Doc::default() };
    put_items(&mut doc, array(data, "todos"), json!(TODAY), device);
    put_items(&mut doc, array(data, "scheduled"), json!(SCHEDULED), device);
    put_note(&mut doc, text(data, "date"), text(data, "dailyNote"), stamp_of(data, "dailyNoteUpdatedAt"), device);
    for archive in array(data, "archives") {
        let date = text(archive, "date");
        if date.is_empty() {
            continue;
        }
        put_items(&mut doc, array(archive, "todos"), json!({ ARCHIVE: date }), device);
        let updated_at = stamp_of(archive, "updatedAt");
        put_note(&mut doc, date, text(archive, "dailyNote"), updated_at.clone(), device);
        let meta = json!({ "date": date, "savedAt": archive.get("savedAt").cloned().unwrap_or(json!(0)) });
        doc.put(format!("{ARCHIVE_PREFIX}{date}"), meta, updated_at.unwrap_or_else(|| zero(device)));
    }
    doc.tombstones.retain(|id, deleted_at| doc.entries.get(id).is_none_or(|entry| *deleted_at > entry.updated_at));
    doc.entries.retain(|id, entry| doc.tombstones.get(id).is_none_or(|deleted_at| *deleted_at <= entry.updated_at));
    doc
}

fn is_valid_item(item: &Value) -> bool {
    let title = text(item, "title");
    !text(item, "id").is_empty() && !title.trim().is_empty() && title.trim() == title
}

#[derive(Default)]
struct Placed {
    today: Vec<Value>,
    scheduled: Vec<Value>,
    archived: BTreeMap<String, Vec<Value>>,
}

fn place_items(merged: &Doc) -> Placed {
    let mut placed = Placed::default();
    for (id, entry) in &merged.entries {
        if id.starts_with(ARCHIVE_PREFIX) {
            continue;
        }
        let item = stamped(entry.value.get("item").unwrap_or(&Value::Null), &entry.updated_at);
        if !is_valid_item(&item) {
            continue;
        }
        match entry.value.get("place") {
            Some(Value::String(place)) if place == SCHEDULED => placed.scheduled.push(item),
            Some(Value::Object(place)) => match place.get(ARCHIVE).and_then(Value::as_str) {
                Some(date) => placed.archived.entry(date.into()).or_default().push(item),
                None => placed.today.push(item),
            },
            _ => placed.today.push(item),
        }
    }
    placed
}

fn in_order(local: &[Value], items: Vec<Value>) -> Vec<Value> {
    let ids: Vec<String> = items.iter().map(|item| text(item, "id").to_string()).collect();
    let present: Vec<&str> = ids.iter().map(String::as_str).collect();
    let mut by_id: BTreeMap<&str, Value> = present.iter().copied().zip(items).collect();
    let local_ids = local.iter().map(|item| text(item, "id"));
    let mut rest: Vec<Value> = Vec::new();
    let mut ordered: Vec<Value> = Vec::new();
    for id in ordered_ids(local_ids, &present) {
        if let Some(item) = by_id.remove(id) {
            if local.iter().any(|kept| text(kept, "id") == id) {
                ordered.push(item);
            } else {
                rest.push(item);
            }
        }
    }
    rest.sort_by(|left, right| {
        let created = |item: &Value| item.get("createdAt").and_then(Value::as_f64).unwrap_or(0.0);
        created(left).total_cmp(&created(right)).then_with(|| text(left, "id").cmp(text(right, "id")))
    });
    ordered.extend(rest);
    ordered
}

fn later(left: Option<Hlc>, right: Option<&Hlc>) -> Option<Hlc> {
    match (left, right) {
        (Some(left), Some(right)) => Some(left.max(right.clone())),
        (left, right) => left.or_else(|| right.cloned()),
    }
}

fn build_archives(local: &Value, merged: &Doc, mut archived: BTreeMap<String, Vec<Value>>) -> Vec<Value> {
    let mut archives: Vec<Value> = Vec::new();
    let local_archives = array(local, "archives");
    let mut dates: Vec<String> = local_archives.iter().map(|archive| text(archive, "date").to_string()).collect();
    let mut fresh: Vec<String> = merged.entries.keys().filter_map(|id| id.strip_prefix(ARCHIVE_PREFIX)).filter(|date| !dates.iter().any(|kept| kept == date)).map(str::to_string).collect();
    fresh.sort_by(|left, right| right.cmp(left));
    dates.extend(fresh);
    for date in dates {
        let kept = local_archives.iter().find(|archive| text(archive, "date") == date);
        let meta = merged.entries.get(&format!("{ARCHIVE_PREFIX}{date}"));
        let mut archive: Map<String, Value> = kept.and_then(Value::as_object).cloned().unwrap_or_else(|| {
            let mut fresh = Map::new();
            fresh.insert("date".into(), json!(date));
            fresh.insert("savedToDisk".into(), json!(false));
            fresh
        });
        let note = merged.notes.get(&date);
        archive.insert("dailyNote".into(), json!(note.map(|note| note.text.as_str()).unwrap_or_else(|| kept.map_or("", |kept| text(kept, "dailyNote")))));
        if let Some(meta) = meta {
            archive.insert("savedAt".into(), meta.value.get("savedAt").cloned().unwrap_or(json!(0)));
        } else if !archive.contains_key("savedAt") {
            archive.insert("savedAt".into(), json!(0));
        }
        let local_todos = kept.map_or(&[][..], |kept| array(kept, "todos"));
        let todos = in_order(local_todos, archived.remove(&date).unwrap_or_default());
        let updated_at = later(meta.map(|meta| meta.updated_at.clone()), note.map(|note| &note.updated_at));
        if let Some(updated_at) = updated_at.or_else(|| kept.and_then(|kept| stamp_of(kept, "updatedAt"))) {
            archive.insert("updatedAt".into(), json!(updated_at.to_string()));
        }
        archive.insert("todos".into(), Value::Array(todos));
        archives.push(Value::Object(archive));
    }
    archives
}

pub(crate) fn apply(local: &Value, merged: &Doc) -> Value {
    let mut next = local.as_object().cloned().unwrap_or_default();
    let placed = place_items(merged);
    let today = in_order(array(local, "todos"), placed.today);
    let active = text(local, "activeTodoId");
    if !active.is_empty() && !today.iter().any(|item| text(item, "id") == active) {
        next.insert("activeTodoId".into(), Value::Null);
    }
    next.insert("todos".into(), Value::Array(today));
    next.insert("scheduled".into(), Value::Array(in_order(array(local, "scheduled"), placed.scheduled)));
    next.insert("archives".into(), Value::Array(build_archives(local, merged, placed.archived)));
    if let Some(note) = merged.notes.get(text(local, "date")) {
        next.insert("dailyNote".into(), json!(note.text));
        next.insert("dailyNoteUpdatedAt".into(), json!(note.updated_at.to_string()));
    }
    let tombstones = tombstone_list(merged.tombstones.iter().filter(|(id, _)| !id.starts_with(ARCHIVE_PREFIX)));
    next.insert("tombstones".into(), serde_json::to_value(tombstones).unwrap_or(Value::Array(Vec::new())));
    Value::Object(next)
}

pub(crate) struct Todos {
    device: String,
    loaded: Option<(u64, Value)>,
}

impl Todos {
    pub(crate) fn new(device: &str) -> Self {
        Self { device: device.into(), loaded: None }
    }
}

impl Category for Todos {
    fn kind(&self) -> SyncCategory {
        SyncCategory::Todos
    }

    fn load(&mut self) -> Result<Option<Doc>, String> {
        let Some((revision, data)) = crate::todos::for_sync() else { return Ok(None) };
        let data = serde_json::to_value(data).map_err(|error| error.to_string())?;
        let doc = to_doc(&data, &self.device);
        self.loaded = Some((revision, data));
        Ok(Some(doc))
    }

    fn store(&mut self, merged: &Doc) -> Result<(), String> {
        let (revision, data) = self.loaded.as_ref().ok_or("The todos were not loaded.")?;
        let next = serde_json::from_value(apply(data, merged)).map_err(|error| format!("The merged todos are not valid: {error}"))?;
        crate::todos::replace_from_sync(*revision, next)
    }
}
