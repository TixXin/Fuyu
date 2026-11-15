use serde::{Deserialize, Serialize};

use super::clock::Hlc;

pub(crate) const TOMBSTONE_KEEP_MS: u64 = 90 * 24 * 60 * 60 * 1000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tombstone {
    pub id: String,
    pub deleted_at: Hlc,
    pub device_id: String,
}

impl Tombstone {
    pub(crate) fn new(id: &str, deleted_at: Hlc) -> Self {
        Self { id: id.to_string(), device_id: deleted_at.device.clone(), deleted_at }
    }
}

pub(crate) fn bury(tombstones: &mut Vec<Tombstone>, id: &str, deleted_at: Hlc) {
    tombstones.retain(|tombstone| tombstone.id != id);
    tombstones.push(Tombstone::new(id, deleted_at));
}

pub(crate) fn unbury(tombstones: &mut Vec<Tombstone>, id: &str) -> bool {
    let before = tombstones.len();
    tombstones.retain(|tombstone| tombstone.id != id);
    tombstones.len() != before
}

pub(crate) fn is_expired(tombstone: &Tombstone, now_ms: u64) -> bool {
    tombstone.deleted_at.ms.saturating_add(TOMBSTONE_KEEP_MS) < now_ms
}

pub(crate) fn prune(tombstones: &mut Vec<Tombstone>, now_ms: u64) -> bool {
    let before = tombstones.len();
    tombstones.retain(|tombstone| !is_expired(tombstone, now_ms));
    tombstones.len() != before
}
