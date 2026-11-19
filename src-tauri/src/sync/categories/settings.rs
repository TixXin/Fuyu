use serde_json::{Map, Value};
use std::collections::BTreeMap;

use super::{zero, Category};
use crate::sync::{
    config::SyncCategory,
    layout::Doc,
    settings_meta::{self, record_name, Mode, RecordStamps, Rule, SettingsMeta, Whitelist, PRESETS_KEY},
    Hlc, Tombstone,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Part {
    Settings,
    Presets,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Local {
    pub keys: Map<String, Value>,
    pub meta: SettingsMeta,
}

const SCRUBBED_KEYS: [&str; 1] = ["fuyu-qq-mail-settings"];
const SECRET_WORDS: [&str; 7] = ["password", "passwd", "token", "secret", "authcode", "apikey", "credential"];

pub(super) fn scrub(value: &mut Value) {
    match value {
        Value::Object(object) => {
            object.retain(|field, _| {
                let field = field.to_lowercase().replace(['-', '_'], "");
                !SECRET_WORDS.iter().any(|word| field.contains(word))
            });
            object.values_mut().for_each(scrub);
        }
        Value::Array(items) => items.iter_mut().for_each(scrub),
        _ => {}
    }
}

pub(crate) fn scrubbed(key: &str, raw: &Value) -> Value {
    let parsed = raw.as_str().and_then(|text| serde_json::from_str::<Value>(text).ok()).filter(Value::is_object);
    let (true, Some(mut value)) = (SCRUBBED_KEYS.contains(&key), parsed) else {
        return raw.clone();
    };
    scrub(&mut value);
    Value::String(value.to_string())
}

fn member(id: &str) -> Option<&str> {
    id.strip_prefix("key:").or_else(|| id.strip_prefix("field:"))
}

fn mode_of(whitelist: &Whitelist, member: &str) -> Mode {
    match member.split_once('/') {
        Some((key, field)) => whitelist.field_mode(key, field),
        None => match whitelist.keys.get(member) {
            Some(Rule::Whole(mode)) => *mode,
            _ => Mode::Local,
        },
    }
}

fn shared(whitelist: &Whitelist, member: &str, groups: &[String]) -> bool {
    match mode_of(whitelist, member) {
        Mode::Sync | Mode::FirstMergeOnly => true,
        Mode::Optional => whitelist.group_of(member).is_some_and(|group| groups.iter().any(|open| open == group)),
        Mode::Local | Mode::ById => false,
    }
}

pub(crate) fn drop_closed(whitelist: &Whitelist, doc: &mut Doc, groups: &[String]) {
    doc.entries.retain(|id, _| member(id).is_none_or(|member| shared(whitelist, member, groups)));
}

fn key_id(key: &str) -> String {
    format!("key:{key}")
}

fn field_id(key: &str, field: &str) -> String {
    format!("field:{key}/{field}")
}

fn item_prefix(record: &str) -> String {
    format!("item:{record}:")
}

fn order_id(record: &str) -> String {
    format!("order:{record}")
}

struct RecordSpot<'a> {
    key: &'a str,
    field: Option<&'a str>,
}

impl RecordSpot<'_> {
    fn name(&self) -> String {
        record_name(self.key, self.field)
    }
}

fn records<'a>(whitelist: &'a Whitelist, part: Part) -> Vec<RecordSpot<'a>> {
    let mut spots = Vec::new();
    for (key, rule) in &whitelist.keys {
        match rule {
            Rule::Whole(Mode::ById) => spots.push(RecordSpot { key, field: None }),
            Rule::Fields { fields } => {
                spots.extend(fields.iter().filter(|(_, mode)| **mode == Mode::ById).map(|(field, _)| RecordSpot { key, field: Some(field) }));
            }
            Rule::Whole(_) => {}
        }
    }
    spots.retain(|spot| (spot.key == PRESETS_KEY && spot.field.is_none()) == (part == Part::Presets));
    spots
}

fn parsed(keys: &Map<String, Value>, key: &str) -> Option<Value> {
    keys.get(key).and_then(Value::as_str).map(settings_meta::parse_value)
}

fn record_value(keys: &Map<String, Value>, spot: &RecordSpot) -> Option<Value> {
    let value = parsed(keys, spot.key)?;
    match spot.field {
        Some(field) => value.get(field).cloned(),
        None => Some(value),
    }
}

fn put_record(doc: &mut Doc, whitelist: &Whitelist, local: &Local, spot: &RecordSpot, device: &str) {
    let name = spot.name();
    let stamps = local.meta.records.get(&name).cloned().unwrap_or_default();
    for tombstone in &stamps.tombstones {
        doc.tombstones.insert(format!("{}{}", item_prefix(&name), tombstone.id), tombstone.deleted_at.clone());
    }
    let Some(Value::Array(items)) = record_value(&local.keys, spot) else { return };
    let mut order = Vec::new();
    for item in &items {
        let Some(id) = item.get("id").and_then(Value::as_str).filter(|id| !id.is_empty()) else { continue };
        let value = match name.as_str() {
            PRESETS_KEY => settings_meta::syncable_preset(whitelist, item),
            super::plugin_roster::KEY => super::plugin_roster::syncable(item),
            _ => item.clone(),
        };
        let updated_at = stamps.items.get(id).cloned().unwrap_or_else(|| zero(device));
        doc.tombstones.remove(&format!("{}{id}", item_prefix(&name)));
        doc.put(format!("{}{id}", item_prefix(&name)), value, updated_at);
        order.push(Value::String(id.into()));
    }
    doc.put(order_id(&name), Value::Array(order), stamps.order.unwrap_or_else(|| zero(device)));
}

pub(crate) fn to_doc(whitelist: &Whitelist, local: &Local, part: Part, device: &str, groups: &[String]) -> Doc {
    let mut doc = Doc::default();
    for spot in records(whitelist, part) {
        put_record(&mut doc, whitelist, local, &spot, device);
    }
    if part == Part::Presets {
        return doc;
    }
    for (key, rule) in &whitelist.keys {
        match rule {
            Rule::Whole(Mode::Sync | Mode::FirstMergeOnly | Mode::Optional) => {
                if let Some(raw) = local.keys.get(key).filter(|raw| raw.is_string()) {
                    doc.put(key_id(key), scrubbed(key, raw), local.meta.keys.get(key).cloned().unwrap_or_else(|| zero(device)));
                }
            }
            Rule::Fields { fields } => {
                let Some(Value::Object(object)) = parsed(&local.keys, key) else { continue };
                let stamps = local.meta.fields.get(key);
                for field in fields.iter().filter(|(_, mode)| matches!(mode, Mode::Sync | Mode::FirstMergeOnly | Mode::Optional)).map(|(field, _)| field) {
                    let Some(value) = object.get(field) else { continue };
                    let updated_at = stamps.and_then(|stamps| stamps.get(field)).cloned().unwrap_or_else(|| zero(device));
                    doc.put(field_id(key, field), value.clone(), updated_at);
                }
            }
            Rule::Whole(_) => {}
        }
    }
    drop_closed(whitelist, &mut doc, groups);
    doc
}

pub(crate) fn pinned(whitelist: &Whitelist, id: &str) -> bool {
    if let Some(key) = id.strip_prefix("key:") {
        return matches!(whitelist.keys.get(key), Some(Rule::Whole(Mode::FirstMergeOnly)));
    }
    id.strip_prefix("field:").and_then(|rest| rest.split_once('/')).is_some_and(|(key, field)| whitelist.field_mode(key, field) == Mode::FirstMergeOnly)
}

fn overlay_preset(local: Option<&Value>, merged: &Value) -> Value {
    let (Some(local_settings), Some(merged_settings)) = (local.and_then(|local| local.get("settings")).and_then(Value::as_object), merged.get("settings").and_then(Value::as_object)) else {
        return merged.clone();
    };
    let mut settings = local_settings.clone();
    settings.extend(merged_settings.iter().map(|(field, value)| (field.clone(), value.clone())));
    let mut preset = merged.clone();
    if let Some(object) = preset.as_object_mut() {
        object.insert("settings".into(), Value::Object(settings));
    }
    preset
}

fn rebuild_record(merged: &Doc, local: &Local, spot: &RecordSpot) -> (Option<Value>, RecordStamps) {
    let name = spot.name();
    let prefix = item_prefix(&name);
    let items: BTreeMap<&str, (&Value, &Hlc)> = merged.entries.iter().filter_map(|(id, entry)| id.strip_prefix(&prefix).map(|id| (id, (&entry.value, &entry.updated_at)))).collect();
    let order_entry = merged.entries.get(&order_id(&name));
    let order: Vec<&str> = order_entry.and_then(|entry| entry.value.as_array()).map(|ids| ids.iter().filter_map(Value::as_str).collect()).unwrap_or_default();
    let present: Vec<&str> = items.keys().copied().collect();
    let local_items = match record_value(&local.keys, spot) {
        Some(Value::Array(items)) => items,
        _ => Vec::new(),
    };
    let ids = super::ordered_ids(order, &present);
    let array: Vec<Value> = ids
        .iter()
        .filter_map(|id| items.get(id))
        .map(|(value, _)| {
            let id = value.get("id").and_then(Value::as_str);
            let kept = local_items.iter().find(|item| item.get("id").and_then(Value::as_str) == id);
            match name.as_str() {
                PRESETS_KEY => overlay_preset(kept, value),
                super::plugin_roster::KEY => super::plugin_roster::syncable(value),
                _ => (*value).clone(),
            }
        })
        .collect();
    let stamps = RecordStamps {
        items: items.iter().map(|(id, (_, updated_at))| ((*id).to_string(), (*updated_at).clone())).collect(),
        order: order_entry.map(|entry| entry.updated_at.clone()),
        tombstones: merged.tombstones.iter().filter_map(|(id, deleted_at)| id.strip_prefix(&prefix).map(|id| Tombstone::new(id, deleted_at.clone()))).collect(),
    };
    let had = record_value(&local.keys, spot).is_some();
    ((had || !array.is_empty()).then_some(Value::Array(array)), stamps)
}

fn set_field(keys: &mut Map<String, Value>, key: &str, field: Option<&str>, value: Value) {
    let next = match field {
        None => value,
        Some(field) => {
            let mut object = match keys.get(key).and_then(Value::as_str).map(settings_meta::parse_value) {
                Some(Value::Object(object)) => object,
                _ => Map::new(),
            };
            object.insert(field.into(), value);
            Value::Object(object)
        }
    };
    let current = keys.get(key).and_then(Value::as_str).map(settings_meta::parse_value);
    if current.as_ref() != Some(&next) {
        keys.insert(key.into(), Value::String(next.to_string()));
    }
}

pub(crate) fn apply(whitelist: &Whitelist, local: &Local, merged: &Doc, part: Part, groups: &[String]) -> Local {
    let mut next = local.clone();
    for spot in records(whitelist, part) {
        let (value, stamps) = rebuild_record(merged, &next, &spot);
        if let Some(value) = value {
            set_field(&mut next.keys, spot.key, spot.field, value);
        }
        next.meta.records.insert(spot.name(), stamps);
    }
    if part == Part::Presets {
        return next;
    }
    for (id, entry) in merged.entries.iter().filter(|(id, _)| member(id).is_none_or(|member| shared(whitelist, member, groups))) {
        if let Some(key) = id.strip_prefix("key:") {
            let value = scrubbed(key, &entry.value);
            if value.is_string() && next.keys.get(key) != Some(&value) {
                next.keys.insert(key.into(), value);
            }
            next.meta.keys.insert(key.into(), entry.updated_at.clone());
        } else if let Some((key, field)) = id.strip_prefix("field:").and_then(|rest| rest.split_once('/')) {
            set_field(&mut next.keys, key, Some(field), entry.value.clone());
            next.meta.fields.entry(key.into()).or_default().insert(field.into(), entry.updated_at.clone());
        }
    }
    next
}

pub(crate) struct Settings {
    app: tauri::AppHandle,
    part: Part,
    device: String,
    groups: Vec<String>,
    loaded: Option<Local>,
}

impl Settings {
    pub(crate) fn new(app: tauri::AppHandle, part: Part, device: &str, groups: &[String]) -> Self {
        Self { app, part, device: device.into(), groups: groups.to_vec(), loaded: None }
    }
}

impl Category for Settings {
    fn kind(&self) -> SyncCategory {
        match self.part {
            Part::Settings => SyncCategory::Settings,
            Part::Presets => SyncCategory::Presets,
        }
    }

    fn load(&mut self) -> Result<Option<Doc>, String> {
        let Some((keys, meta)) = crate::settings_file::load_for_sync(&self.app)? else { return Ok(None) };
        let local = Local { keys, meta };
        let doc = to_doc(settings_meta::whitelist(), &local, self.part, &self.device, &self.groups);
        self.loaded = Some(local);
        Ok(Some(doc))
    }

    fn store(&mut self, merged: &Doc) -> Result<(), String> {
        let local = self.loaded.as_ref().ok_or("The settings were not loaded.")?;
        let next = apply(settings_meta::whitelist(), local, merged, self.part, &self.groups);
        if next == *local {
            return Ok(());
        }
        crate::settings_file::store_from_sync(&self.app, &local.keys, next.keys, &next.meta)
    }

    fn pinned(&self, id: &str) -> bool {
        pinned(settings_meta::whitelist(), id)
    }

    fn tidy(&self, doc: &mut Doc, _tick: &mut dyn FnMut() -> Hlc) {
        drop_closed(settings_meta::whitelist(), doc, &self.groups);
    }
}
