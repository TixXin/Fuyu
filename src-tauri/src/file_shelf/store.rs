use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, path::Path};

use super::{availability::Presence, FileShelfItem};

pub(super) const FILE_SHELF_FILE_NAME: &str = "file-shelf.json";

pub(super) const MAX_ITEMS: usize = 100;
pub(super) const MIN_MAX_ITEMS: usize = 20;
pub(super) const MAX_MAX_ITEMS: usize = 200;

const DAY_MILLIS: i64 = 24 * 60 * 60 * 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileShelfOptions {
    pub(super) max_items: usize,
    pub(super) max_age_days: u32,
    pub(super) remove_missing: bool,
}

impl Default for FileShelfOptions {
    fn default() -> Self {
        Self {
            max_items: MAX_ITEMS,
            max_age_days: 0,
            remove_missing: false,
        }
    }
}

impl FileShelfOptions {
    pub(super) fn normalized(mut self) -> Self {
        self.max_items = self.max_items.clamp(MIN_MAX_ITEMS, MAX_MAX_ITEMS);
        self
    }
}

#[derive(Deserialize)]
struct StoredFileShelf {
    #[serde(default)]
    items: Vec<serde_json::Value>,
}

#[derive(Serialize)]
struct StoredFileShelfRef<'a> {
    items: &'a [FileShelfItem],
}

pub(super) fn load_items(path: &Path) -> Vec<FileShelfItem> {
    fs::read_to_string(path)
        .map(|content| parse_items(&content))
        .unwrap_or_default()
}

pub(super) fn parse_items(content: &str) -> Vec<FileShelfItem> {
    let Ok(stored) = serde_json::from_str::<StoredFileShelf>(content) else {
        return Vec::new();
    };
    let items = stored
        .items
        .into_iter()
        .filter_map(|value| serde_json::from_value::<FileShelfItem>(value).ok())
        .filter(|item| !item.id.is_empty() && !item.path.is_empty())
        .collect();
    normalize(items, MAX_MAX_ITEMS)
}

pub(super) fn insert_items(
    existing: Vec<FileShelfItem>,
    added: Vec<FileShelfItem>,
    max_items: usize,
) -> Vec<FileShelfItem> {
    let pinned: HashSet<String> = existing
        .iter()
        .filter(|item| item.pinned)
        .map(|item| path_key(&item.path))
        .collect();
    let added = added.into_iter().map(|mut item| {
        item.pinned = pinned.contains(&path_key(&item.path));
        item
    });
    normalize(added.chain(existing).collect(), max_items)
}

pub(super) fn prune(
    items: Vec<FileShelfItem>,
    options: FileShelfOptions,
    now: i64,
    presence: impl Fn(&str) -> Presence,
) -> Vec<FileShelfItem> {
    let max_age = i64::from(options.max_age_days) * DAY_MILLIS;
    let kept = items
        .into_iter()
        .filter(|item| item.pinned || max_age == 0 || now - item.added_at <= max_age)
        .filter(|item| !options.remove_missing || presence(&item.path) != Presence::Missing)
        .collect();
    normalize(kept, options.max_items)
}

fn normalize(items: Vec<FileShelfItem>, max_items: usize) -> Vec<FileShelfItem> {
    let mut seen = HashSet::new();
    let (pinned, rest): (Vec<_>, Vec<_>) = items
        .into_iter()
        .filter(|item| seen.insert(path_key(&item.path)))
        .partition(|item| item.pinned);
    pinned.into_iter().chain(rest.into_iter().take(max_items)).collect()
}

pub(super) fn path_key(path: &str) -> String {
    path.replace('/', "\\").to_lowercase()
}

pub(super) fn save_items(path: &Path, items: &[FileShelfItem]) -> Result<(), String> {
    let content = serde_json::to_string_pretty(&StoredFileShelfRef { items })
        .map_err(|error| format!("Failed to encode the file shelf: {error}"))?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {error}", parent.display()))?;
    }

    let temporary_path = path.with_extension("tmp");
    fs::write(&temporary_path, content)
        .map_err(|error| format!("Failed to write {}: {error}", temporary_path.display()))?;
    fs::rename(&temporary_path, path)
        .or_else(|_| {
            fs::remove_file(path).ok();
            fs::rename(&temporary_path, path)
        })
        .map_err(|error| format!("Failed to replace {}: {error}", path.display()))
}
