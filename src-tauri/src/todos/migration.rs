use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use super::{
    model::{Migration, TodosData, TodosFile, FILE_VERSION},
    store::{self, LoadError},
};

pub(crate) const FILE_NAME: &str = "todos.json";
const BACKUP_FILE_NAME: &str = "todos-migration-backup.json";
const MIGRATION_VERSION: u32 = 1;
const REIMPORT_COPY_PREFIX: &str = "todos.before-reimport-";
const REIMPORT_COPIES_KEPT: usize = 3;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct LocalTodoKeys {
    #[serde(rename = "focusd-island-todos", default)]
    pub todos: Option<String>,
    #[serde(rename = "focusd-island-archives", default)]
    pub archives: Option<String>,
    #[serde(rename = "focusd-island-scheduled-todos", default)]
    pub scheduled_todos: Option<String>,
    #[serde(rename = "focusd-island-daily-note", default)]
    pub daily_note: Option<String>,
    #[serde(rename = "focusd-island-active-todo", default)]
    pub active_todo: Option<String>,
    #[serde(rename = "focusd-island-current-date", default)]
    pub current_date: Option<String>,
}

impl LocalTodoKeys {
    fn is_empty(&self) -> bool {
        *self == Self::default()
    }
}

pub(crate) fn source_hash(keys: &LocalTodoKeys) -> String {
    let canonical = json!([
        keys.todos,
        keys.archives,
        keys.scheduled_todos,
        keys.daily_note,
        keys.active_todo,
        keys.current_date
    ])
    .to_string();
    Sha256::digest(canonical.as_bytes()).iter().map(|byte| format!("{byte:02x}")).collect()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Plan {
    UseFile,
    Import { keep_old: bool, reimport: bool },
}

pub(crate) fn plan(
    existing: &Result<Option<TodosFile>, LoadError>,
    hash: &str,
    local_empty: bool,
    already_imported: bool,
) -> Result<Plan, String> {
    match existing {
        Ok(None) => Ok(Plan::Import { keep_old: false, reimport: false }),
        Ok(Some(file)) if file.migration.as_ref().is_some_and(|migration| migration.source_hash == hash) => Ok(Plan::UseFile),
        Ok(Some(_)) if local_empty => Ok(Plan::UseFile),
        Ok(Some(_)) if already_imported => Ok(Plan::UseFile),
        Ok(Some(_)) => Ok(Plan::Import { keep_old: true, reimport: true }),
        Err(LoadError::Damaged(_)) => Ok(Plan::Import { keep_old: true, reimport: false }),
        Err(error) => Err(error.message().to_string()),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodosSnapshot {
    pub revision: u64,
    pub data: TodosData,
    pub notice: Option<&'static str>,
}

pub(crate) fn migrate(
    dir: &Path,
    keys: &LocalTodoKeys,
    normalized: TodosData,
    app_version: &str,
) -> Result<(TodosFile, Option<&'static str>), String> {
    prune_reimport_copies(dir);
    let path = dir.join(FILE_NAME);
    let hash = source_hash(keys);
    let existing = store::load(&path);
    let already_imported = imported_hashes(dir).contains(&hash);
    let (keep_old, reimport) = match plan(&existing, &hash, keys.is_empty(), already_imported)? {
        Plan::UseFile => {
            return match existing {
                Ok(Some(file)) => Ok((file, None)),
                _ => Err("todos.json disappeared while reading it.".into()),
            };
        }
        Plan::Import { keep_old, reimport } => (keep_old, reimport),
    };
    let now = now_ms();
    backup_local(dir, keys, &hash, app_version, now)?;
    if keep_old {
        let old = fs::read(&path).map_err(|error| format!("Could not read {}: {error}", path.display()))?;
        store::write_new(&dir.join(format!("{REIMPORT_COPY_PREFIX}{now}.json")), &old)?;
        prune_reimport_copies(dir);
    }
    let revision = match &existing {
        Ok(Some(file)) => file.revision + 1,
        _ => 0,
    };
    let file = TodosFile {
        version: FILE_VERSION,
        revision,
        migration: Some(Migration {
            version: MIGRATION_VERSION,
            from_app_version: app_version.to_string(),
            at: now,
            source_hash: hash,
        }),
        data: normalized,
    };
    store::save(&path, &file)?;
    Ok((file, reimport.then_some("reimported")))
}

pub(crate) fn prune_reimport_copies(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut copies: Vec<(u64, std::path::PathBuf)> = entries
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name();
            let stamp = name.to_str()?.strip_prefix(REIMPORT_COPY_PREFIX)?.strip_suffix(".json")?.parse().ok()?;
            Some((stamp, entry.path()))
        })
        .collect();
    copies.sort_unstable_by_key(|copy| std::cmp::Reverse(copy.0));
    for (_, path) in copies.into_iter().skip(REIMPORT_COPIES_KEPT) {
        let _ = fs::remove_file(path);
    }
}

fn imported_hashes(dir: &Path) -> HashSet<String> {
    let Ok(entries) = fs::read_dir(dir) else {
        return HashSet::new();
    };
    entries
        .flatten()
        .filter(|entry| {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            name.starts_with("todos-migration-backup") && name.ends_with(".json")
        })
        .filter_map(|entry| fs::read_to_string(entry.path()).ok())
        .filter_map(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .filter_map(|backup| backup.get("sourceHash").and_then(serde_json::Value::as_str).map(str::to_string))
        .collect()
}

fn backup_local(dir: &Path, keys: &LocalTodoKeys, hash: &str, app_version: &str, now: u64) -> Result<(), String> {
    let content = json!({ "at": now, "fromAppVersion": app_version, "sourceHash": hash, "keys": keys });
    let first = dir.join(BACKUP_FILE_NAME);
    let same_as_first = fs::read_to_string(&first)
        .ok()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .is_some_and(|existing| existing.get("sourceHash").and_then(serde_json::Value::as_str) == Some(hash));
    if same_as_first {
        return Ok(());
    }
    fs::create_dir_all(dir).map_err(|error| format!("Could not create {}: {error}", dir.display()))?;
    let target = if first.exists() { dir.join(format!("todos-migration-backup-{now}.json")) } else { first };
    let text = serde_json::to_string_pretty(&content).map_err(|error| format!("Could not encode the backup: {error}"))?;
    store::write_new(&target, text.as_bytes())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}
