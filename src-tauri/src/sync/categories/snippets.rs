use serde_json::Value;

use super::{records_doc, records_from, tombstone_list, Category};
use crate::sync::{config::SyncCategory, layout::Doc, Tombstone};

pub(crate) fn to_doc(snippets: &[Value], tombstones: &[Tombstone], device: &str) -> Doc {
    records_doc(snippets, tombstones, device)
}

pub(crate) fn apply(local: &[Value], merged: &Doc) -> (Vec<Value>, Vec<Tombstone>) {
    (records_from(merged, local), tombstone_list(&merged.tombstones))
}

pub(crate) struct Snippets {
    device: String,
    loaded: Option<crate::sync::SyncRecords>,
}

impl Snippets {
    pub(crate) fn new(device: &str) -> Self {
        Self { device: device.into(), loaded: None }
    }
}

impl Category for Snippets {
    fn kind(&self) -> SyncCategory {
        SyncCategory::Snippets
    }

    fn load(&mut self) -> Result<Option<Doc>, String> {
        let Some((snippets, tombstones)) = crate::clipboard_history::snippets_for_sync()? else {
            return Ok(None);
        };
        let doc = to_doc(&snippets, &tombstones, &self.device);
        self.loaded = Some((snippets, tombstones));
        Ok(Some(doc))
    }

    fn store(&mut self, merged: &Doc) -> Result<(), String> {
        let (snippets, tombstones) = self.loaded.as_ref().ok_or("The snippets were not loaded.")?;
        let (next, next_tombstones) = apply(snippets, merged);
        crate::clipboard_history::replace_snippets_from_sync((snippets, tombstones), next, next_tombstones)
    }
}
