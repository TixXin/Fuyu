use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

use super::layout::Doc;

pub(crate) const DIR_NAME: &str = "sync-state";
const STATE_FILE: &str = "state.json";

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct State {
    #[serde(default)]
    pub synced_once: bool,
    #[serde(default)]
    pub backed_up: bool,
    #[serde(default)]
    pub last_sync_at: u64,
    #[serde(default)]
    pub device_info_at: u64,
}

fn write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|error| format!("Could not create {}: {error}", dir.display()))?;
    }
    crate::fs_write::replace_file(path, bytes).map_err(|error| format!("Could not write {}: {error}", path.display()))
}

pub(crate) fn load_state(dir: &Path) -> State {
    fs::read(dir.join(STATE_FILE)).ok().and_then(|bytes| serde_json::from_slice(&bytes).ok()).unwrap_or_default()
}

pub(crate) fn save_state(dir: &Path, state: &State) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(state).map_err(|error| error.to_string())?;
    write(&dir.join(STATE_FILE), &bytes)
}

fn doc_path(dir: &Path, category: &str) -> std::path::PathBuf {
    dir.join(format!("{category}.json"))
}

pub(crate) fn load(dir: &Path, category: &str) -> Option<Doc> {
    let bytes = fs::read(doc_path(dir, category)).ok()?;
    serde_json::from_slice(&bytes).ok()
}

pub(crate) fn save(dir: &Path, category: &str, doc: &Doc) -> Result<(), String> {
    let bytes = serde_json::to_vec(doc).map_err(|error| error.to_string())?;
    write(&doc_path(dir, category), &bytes)
}

pub(crate) fn forget(dir: &Path) {
    let _ = fs::remove_dir_all(dir);
}
