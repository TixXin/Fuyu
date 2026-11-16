use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    path::Path,
    sync::OnceLock,
};

use super::{record, Clock, Hlc, Tombstone};

pub(crate) const FILE_NAME: &str = "settings-sync-meta.json";
pub(crate) const FILE_VERSION: u32 = 1;
pub(crate) const SETTINGS_KEY: &str = "fuyu-settings";
pub(crate) const PRESETS_KEY: &str = "fuyu-setting-presets";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum Mode {
    Sync,
    Local,
    FirstMergeOnly,
    ById,
}

impl Mode {
    fn stamped(self) -> bool {
        matches!(self, Self::Sync | Self::FirstMergeOnly)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub(crate) enum Rule {
    Whole(Mode),
    Fields { fields: BTreeMap<String, Mode> },
}

#[derive(Debug, Default, Deserialize)]
pub(crate) struct Whitelist {
    pub(crate) keys: BTreeMap<String, Rule>,
}

impl Whitelist {
    pub(crate) fn parse(text: &str) -> Result<Self, String> {
        serde_json::from_str(text).map_err(|error| format!("Bad settings sync whitelist: {error}"))
    }

    pub(crate) fn field_mode(&self, key: &str, field: &str) -> Mode {
        match self.keys.get(key) {
            Some(Rule::Fields { fields }) => fields.get(field).copied().unwrap_or(Mode::Local),
            _ => Mode::Local,
        }
    }
}

pub(crate) fn whitelist() -> &'static Whitelist {
    static WHITELIST: OnceLock<Whitelist> = OnceLock::new();
    WHITELIST.get_or_init(|| {
        Whitelist::parse(include_str!("settings_whitelist.json")).unwrap_or_else(|error| {
            eprintln!("{error}");
            Whitelist::default()
        })
    })
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordStamps {
    #[serde(default)]
    pub items: BTreeMap<String, Hlc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order: Option<Hlc>,
    #[serde(default)]
    pub tombstones: Vec<Tombstone>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsMeta {
    pub version: u32,
    #[serde(default)]
    pub keys: BTreeMap<String, Hlc>,
    #[serde(default)]
    pub fields: BTreeMap<String, BTreeMap<String, Hlc>>,
    #[serde(default)]
    pub records: BTreeMap<String, RecordStamps>,
}

impl Default for SettingsMeta {
    fn default() -> Self {
        Self { version: FILE_VERSION, keys: BTreeMap::new(), fields: BTreeMap::new(), records: BTreeMap::new() }
    }
}

pub(crate) fn record_name(key: &str, field: Option<&str>) -> String {
    match field {
        Some(field) => format!("{key}/{field}"),
        None => key.to_string(),
    }
}

pub(crate) fn load(path: &Path) -> SettingsMeta {
    let Ok(text) = std::fs::read_to_string(path) else {
        return SettingsMeta::default();
    };
    match serde_json::from_str::<SettingsMeta>(&text) {
        Ok(meta) if meta.version <= FILE_VERSION => meta,
        Ok(_) => SettingsMeta::default(),
        Err(error) => {
            eprintln!("could not read {}: {error}", path.display());
            SettingsMeta::default()
        }
    }
}

pub(crate) fn save(path: &Path, meta: &SettingsMeta) -> Result<(), String> {
    let text = serde_json::to_vec_pretty(meta).map_err(|error| error.to_string())?;
    crate::fs_write::replace_file(path, &text).map_err(|error| error.to_string())
}

pub(crate) fn all(meta: &SettingsMeta) -> impl Iterator<Item = &Hlc> {
    let fields = meta.fields.values().flat_map(BTreeMap::values);
    let records = meta.records.values().flat_map(|record| {
        record.items.values().chain(record.order.iter()).chain(record.tombstones.iter().map(|tombstone| &tombstone.deleted_at))
    });
    meta.keys.values().chain(fields).chain(records)
}

pub(crate) fn parse_value(text: &str) -> Value {
    serde_json::from_str(text).unwrap_or_else(|_| Value::String(text.to_string()))
}

pub(crate) fn syncable_preset(whitelist: &Whitelist, preset: &Value) -> Value {
    let mut preset = preset.clone();
    if let Some(Value::Object(settings)) = preset.get_mut("settings") {
        settings.retain(|field, _| whitelist.field_mode(SETTINGS_KEY, field) == Mode::Sync);
    }
    preset
}

struct Stamper<'a> {
    clock: &'a mut Clock,
    wall: u64,
    known: bool,
}

impl Stamper<'_> {
    fn stamp(&mut self, previous: Option<&Hlc>, before: Option<&Value>, after: Option<&Value>) -> Option<Hlc> {
        if before.is_none() && after.is_none() && previous.is_none() {
            return None;
        }
        if self.known && before != after {
            return Some(self.clock.tick(self.wall));
        }
        Some(previous.cloned().unwrap_or_else(|| Hlc::from_millis(0, self.clock.device())))
    }
}

fn items_by_id(value: Option<&Value>) -> Vec<(String, &Value)> {
    let Some(Value::Array(items)) = value else {
        return Vec::new();
    };
    items.iter().filter_map(|item| item.get("id").and_then(Value::as_str).filter(|id| !id.is_empty()).map(|id| (id.to_string(), item))).collect()
}

fn restamp_records(stamper: &mut Stamper, previous: &RecordStamps, before: Option<&Value>, after: Option<&Value>, content: &dyn Fn(&Value) -> Value) -> RecordStamps {
    let old_items = items_by_id(before);
    let new_items = items_by_id(after);
    let old_by_id: HashMap<&str, Value> = old_items.iter().map(|(id, item)| (id.as_str(), content(item))).collect();
    let mut next = RecordStamps { items: BTreeMap::new(), order: None, tombstones: previous.tombstones.clone() };
    for (id, item) in &new_items {
        let stamp = stamper.stamp(previous.items.get(id), old_by_id.get(id.as_str()), Some(&content(item)));
        if let Some(stamp) = stamp {
            next.items.insert(id.clone(), stamp);
        }
        record::unbury(&mut next.tombstones, id);
    }
    if stamper.known {
        let present: HashSet<&str> = new_items.iter().map(|(id, _)| id.as_str()).collect();
        let mut gone: Vec<&str> = old_items.iter().map(|(id, _)| id.as_str()).filter(|id| !present.contains(id)).collect();
        gone.sort_unstable();
        gone.dedup();
        for id in gone {
            record::bury(&mut next.tombstones, id, stamper.clock.tick(stamper.wall));
        }
    }
    let order = |items: &[(String, &Value)]| Value::Array(items.iter().map(|(id, _)| Value::String(id.clone())).collect());
    let (old_order, new_order) = (before.map(|_| order(&old_items)), after.map(|_| order(&new_items)));
    next.order = stamper.stamp(previous.order.as_ref(), old_order.as_ref(), new_order.as_ref());
    next
}

fn as_object(value: Option<&Value>) -> Option<&Map<String, Value>> {
    value.and_then(Value::as_object)
}

pub(crate) fn restamp(
    whitelist: &Whitelist,
    old: Option<&Map<String, Value>>,
    new: &Map<String, Value>,
    previous: &SettingsMeta,
    clock: &mut Clock,
    wall: u64,
) -> SettingsMeta {
    let parse = |keys: Option<&Map<String, Value>>, key: &str| keys.and_then(|keys| keys.get(key)).and_then(Value::as_str).map(parse_value);
    let mut stamper = Stamper { clock, wall, known: old.is_some() };
    let mut next = SettingsMeta::default();
    let empty = RecordStamps::default();
    for (key, rule) in &whitelist.keys {
        let (before, after) = (parse(old, key), parse(Some(new), key));
        match rule {
            Rule::Whole(Mode::ById) => {
                let name = record_name(key, None);
                let content = |item: &Value| if key == PRESETS_KEY { syncable_preset(whitelist, item) } else { item.clone() };
                let stamps = restamp_records(&mut stamper, previous.records.get(&name).unwrap_or(&empty), before.as_ref(), after.as_ref(), &content);
                next.records.insert(name, stamps);
            }
            Rule::Whole(mode) if mode.stamped() => {
                if let Some(stamp) = stamper.stamp(previous.keys.get(key), before.as_ref(), after.as_ref()) {
                    next.keys.insert(key.clone(), stamp);
                }
            }
            Rule::Whole(_) => {}
            Rule::Fields { fields } => {
                let (before, after) = (as_object(before.as_ref()), as_object(after.as_ref()));
                let old_stamps = previous.fields.get(key);
                let mut stamps = BTreeMap::new();
                for (field, mode) in fields {
                    let (field_before, field_after) = (before.and_then(|object| object.get(field)), after.and_then(|object| object.get(field)));
                    if *mode == Mode::ById {
                        let name = record_name(key, Some(field));
                        let records = restamp_records(&mut stamper, previous.records.get(&name).unwrap_or(&empty), field_before, field_after, &Value::clone);
                        next.records.insert(name, records);
                    } else if mode.stamped() {
                        if let Some(stamp) = stamper.stamp(old_stamps.and_then(|stamps| stamps.get(field)), field_before, field_after) {
                            stamps.insert(field.clone(), stamp);
                        }
                    }
                }
                if !stamps.is_empty() {
                    next.fields.insert(key.clone(), stamps);
                }
            }
        }
    }
    next.records.retain(|_, record| !record.items.is_empty() || record.order.is_some() || !record.tombstones.is_empty());
    if next != *previous {
        for record in next.records.values_mut() {
            record::prune(&mut record.tombstones, wall);
        }
    }
    next
}

#[cfg(test)]
#[path = "settings_meta_tests.rs"]
mod tests;
