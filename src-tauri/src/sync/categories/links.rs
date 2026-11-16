use serde_json::Value;
use std::collections::BTreeMap;

use super::{records_doc, records_from, tombstone_list, Category};
use crate::sync::{config::SyncCategory, layout::Doc, Hlc, Tombstone};

pub(crate) fn to_doc(links: &[Value], tombstones: &[Tombstone], device: &str) -> Doc {
    records_doc(links, tombstones, device)
}

pub(crate) fn apply(local: &[Value], merged: &Doc) -> (Vec<Value>, Vec<Tombstone>) {
    (records_from(merged, local), tombstone_list(&merged.tombstones))
}

fn text<'a>(value: &'a Value, field: &str) -> &'a str {
    value.get(field).and_then(Value::as_str).unwrap_or_default()
}

fn drop_duplicate_urls(doc: &mut Doc, tick: &mut dyn FnMut() -> Hlc) {
    let mut newest: BTreeMap<String, (Hlc, String)> = BTreeMap::new();
    let mut losers = Vec::new();
    for (id, entry) in &doc.entries {
        let url = text(&entry.value, "url").to_string();
        match newest.get(&url) {
            Some((kept, _)) if *kept >= entry.updated_at => losers.push(id.clone()),
            _ => {
                if let Some((_, previous)) = newest.insert(url, (entry.updated_at.clone(), id.clone())) {
                    losers.push(previous);
                }
            }
        }
    }
    for id in losers {
        doc.entries.remove(&id);
        doc.tombstones.insert(id, tick());
    }
}

fn spread_sort_keys(doc: &mut Doc, tick: &mut dyn FnMut() -> Hlc) {
    let mut order: Vec<(String, String)> = doc.entries.iter().map(|(id, entry)| (text(&entry.value, "sortKey").to_string(), id.clone())).collect();
    order.sort();
    let mut previous: Option<String> = None;
    for index in 0..order.len() {
        let key = order[index].0.clone();
        let fine = !key.is_empty() && previous.as_ref().is_none_or(|previous| key > *previous);
        if fine {
            previous = Some(key);
            continue;
        }
        let upper = order[index + 1..].iter().map(|(key, _)| key.as_str()).find(|next| previous.as_deref().is_none_or(|previous| *next > previous));
        let fresh = crate::clipboard_history::link_key_between(previous.as_deref(), upper);
        if let Some(entry) = doc.entries.get_mut(&order[index].1) {
            if let Some(object) = entry.value.as_object_mut() {
                object.insert("sortKey".into(), Value::String(fresh.clone()));
            }
            entry.updated_at = tick();
        }
        previous = Some(fresh);
    }
}

pub(crate) fn tidy(doc: &mut Doc, tick: &mut dyn FnMut() -> Hlc) {
    drop_duplicate_urls(doc, tick);
    spread_sort_keys(doc, tick);
}

pub(crate) struct Links {
    app: tauri::AppHandle,
    device: String,
    loaded: Option<crate::sync::SyncRecords>,
}

impl Links {
    pub(crate) fn new(app: tauri::AppHandle, device: &str) -> Self {
        Self { app, device: device.into(), loaded: None }
    }
}

impl Category for Links {
    fn kind(&self) -> SyncCategory {
        SyncCategory::Links
    }

    fn load(&mut self) -> Result<Option<Doc>, String> {
        let (links, tombstones) = crate::clipboard_history::links_for_sync(&self.app)?;
        let doc = to_doc(&links, &tombstones, &self.device);
        self.loaded = Some((links, tombstones));
        Ok(Some(doc))
    }

    fn store(&mut self, merged: &Doc) -> Result<(), String> {
        let (links, tombstones) = self.loaded.as_ref().ok_or("The bookmarks were not loaded.")?;
        let (next, next_tombstones) = apply(links, merged);
        crate::clipboard_history::replace_links_from_sync(&self.app, (links, tombstones), next, next_tombstones)
    }

    fn tidy(&self, doc: &mut Doc, tick: &mut dyn FnMut() -> Hlc) {
        tidy(doc, tick);
    }
}
