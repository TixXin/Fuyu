use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

use super::Hlc;

pub(crate) const SCHEMA_VERSION: u32 = 1;
pub(crate) const APP: &str = "fuyu";
pub(crate) const META_FILE: &str = "fuyu-sync/meta.json";
pub(crate) const DEVICES_DIR: &str = "fuyu-sync/devices";
const DEVICE_FILE: &str = "device.json";

pub(crate) fn category_path(device: &str, category: &str) -> String {
    format!("{DEVICES_DIR}/{device}/{category}.json")
}

pub(crate) fn device_info_path(device: &str) -> String {
    format!("{DEVICES_DIR}/{device}/{DEVICE_FILE}")
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    pub schema_version: u32,
    pub app: String,
    #[serde(default)]
    pub created_at: u64,
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

impl Meta {
    pub(crate) fn new(now_ms: u64) -> Self {
        Self { schema_version: SCHEMA_VERSION, app: APP.into(), created_at: now_ms, extra: BTreeMap::new() }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub value: Value,
    pub updated_at: Hlc,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub text: String,
    pub updated_at: Hlc,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Doc {
    #[serde(default)]
    pub entries: BTreeMap<String, Entry>,
    #[serde(default)]
    pub tombstones: BTreeMap<String, Hlc>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub notes: BTreeMap<String, Note>,
}

impl Doc {
    pub(crate) fn stamps(&self) -> impl Iterator<Item = &Hlc> {
        self.entries.values().map(|entry| &entry.updated_at).chain(self.tombstones.values()).chain(self.notes.values().map(|note| &note.updated_at))
    }

    pub(crate) fn put(&mut self, id: impl Into<String>, value: Value, updated_at: Hlc) {
        let id = id.into();
        if self.entries.get(&id).is_some_and(|kept| kept.updated_at >= updated_at) {
            return;
        }
        self.entries.insert(id, Entry { value, updated_at });
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocFile {
    pub schema_version: u32,
    pub category: String,
    pub device_id: String,
    #[serde(default)]
    pub written_at: u64,
    #[serde(flatten)]
    pub doc: Doc,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub device_id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub platform: String,
    #[serde(default)]
    pub app_version: String,
    #[serde(default)]
    pub last_sync_at: u64,
}

pub(crate) fn schema_version(value: &Value) -> u64 {
    value.get("schemaVersion").and_then(Value::as_u64).unwrap_or(0)
}
