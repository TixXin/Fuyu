use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

use crate::user_error::UserError;

pub(crate) const BACKUP_DIR: &str = "backups";
pub(crate) const PREFIX: &str = "pre-update-";
const TEMP_PREFIX: &str = ".tmp-";
pub(crate) const KEEP: usize = 3;
const MANIFEST: &str = "manifest.json";
const LOCAL_STORAGE: &str = "local-storage.json";
const FILES_DIR: &str = "files";
pub(crate) const PENDING: &str = "restore-pending.json";
const MAX_FILE_BYTES: u64 = 32 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 256 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES: usize = 64 * 1024 * 1024;

pub(crate) const FILES: &[&str] = &[
    "settings.json",
    "todos.json",
    "plugins.json",
    "dev-plugins.json",
    "file-shelf.json",
    "clipboard-history.json",
    "clipboard-links.json",
    "settings-window.json",
    "tray-icon.json",
    "ssh-tunnels.json",
    "agent-remote-hosts.json",
    "plugins-v3/plugins.yml",
];

pub(crate) const DIRS: &[&str] = &["plugins-data", "plugins", "sound-packs", "pets"];

pub(crate) const EXCLUDED_KEYS: &[&str] = &[
    "fuyu-settings-focus",
    "fuyu-translation-handoff",
    "fuyu-position-reset",
    "fuyu-panel-preview",
    "fuyu-onboarding-demo",
    "fuyu-todo-project-edit",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Entry {
    pub path: String,
    pub size: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Manifest {
    pub version: u32,
    pub from_version: String,
    pub to_version: String,
    pub created_at: i64,
    pub local_storage: Entry,
    pub files: Vec<Entry>,
    pub skipped: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSummary {
    id: String,
    from_version: String,
    to_version: String,
    created_at: i64,
    size: u64,
    files: usize,
    skipped: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupList {
    backups: Vec<BackupSummary>,
    broken_files: Vec<String>,
    pending_restore: Option<String>,
}

pub(crate) struct Request<'a> {
    pub from_version: &'a str,
    pub to_version: &'a str,
    pub snapshot: &'a str,
    pub now_millis: i64,
    pub stamp: &'a str,
}

fn failed(error: impl std::fmt::Display) -> UserError {
    UserError::new("updateBackup.failed", "Could not back up the island's data before updating.").detail(error)
}

fn corrupt(path: &str) -> UserError {
    UserError::new("updateBackup.corrupt", "This backup is damaged and can't be restored.").arg("path", path.to_string())
}

fn sha256(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect()
}

fn clean_version(version: &str) -> String {
    let cleaned: String = version.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '.' || *c == '-').take(40).collect();
    if cleaned.is_empty() { "unknown".into() } else { cleaned }
}

pub(crate) fn is_backup_id(id: &str) -> bool {
    id.starts_with(PREFIX) && id.len() <= 120 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
}

pub(crate) fn normalize_snapshot(snapshot: &str) -> Result<BTreeMap<String, String>, UserError> {
    let bad = || UserError::new("updateBackup.badSnapshot", "The settings snapshot from the page is not valid.");
    if snapshot.len() > MAX_SNAPSHOT_BYTES {
        return Err(bad());
    }
    let keys: BTreeMap<String, serde_json::Value> = serde_json::from_str(snapshot).map_err(|_| bad())?;
    let mut kept = BTreeMap::new();
    for (key, value) in keys {
        let serde_json::Value::String(value) = value else { return Err(bad()) };
        if key.starts_with("fuyu-") && !EXCLUDED_KEYS.contains(&key.as_str()) {
            kept.insert(key, value);
        }
    }
    Ok(kept)
}

fn collect_dir(home: &Path, relative: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(home.join(relative)) else { return };
    let mut entries: Vec<_> = entries.flatten().collect();
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let Ok(kind) = entry.file_type() else { continue };
        let child = relative.join(entry.file_name());
        if kind.is_dir() {
            if entry.file_name() != "node_modules" {
                collect_dir(home, &child, out);
            }
        } else if kind.is_file() {
            out.push(child);
        }
    }
}

pub(crate) fn sources(home: &Path) -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = FILES
        .iter()
        .map(PathBuf::from)
        .filter(|path| fs::symlink_metadata(home.join(path)).is_ok_and(|meta| meta.is_file()))
        .collect();
    for dir in DIRS {
        collect_dir(home, Path::new(dir), &mut out);
    }
    out
}

fn relative_text(path: &Path) -> String {
    path.components().map(|part| part.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/")
}

fn safe_relative(text: &str) -> Option<PathBuf> {
    let path = PathBuf::from(text);
    let ok = !text.is_empty()
        && path.components().all(|part| matches!(part, std::path::Component::Normal(_)))
        && (FILES.contains(&text) || DIRS.iter().any(|dir| text.starts_with(&format!("{dir}/"))));
    ok.then_some(path)
}

fn write_checked(path: &Path, bytes: &[u8]) -> Result<Entry, UserError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(failed)?;
    }
    fs::write(path, bytes).map_err(failed)?;
    let expected = sha256(bytes);
    let written = fs::read(path).map_err(failed)?;
    if sha256(&written) != expected {
        return Err(failed(format!("{} changed while it was written", path.display())));
    }
    Ok(Entry { path: String::new(), size: bytes.len() as u64, sha256: expected })
}

pub(crate) fn create(home: &Path, request: &Request) -> Result<BackupSummary, UserError> {
    let keys = normalize_snapshot(request.snapshot)?;
    let root = home.join(BACKUP_DIR);
    fs::create_dir_all(&root).map_err(failed)?;
    remove_leftovers(&root);
    let base = format!("{PREFIX}{}-{}", clean_version(request.from_version), request.stamp);
    let id = (1..100)
        .map(|n| if n == 1 { base.clone() } else { format!("{base}-{n}") })
        .find(|id| !root.join(id).exists())
        .ok_or_else(|| failed("too many backups with the same name"))?;
    let temp = root.join(format!("{TEMP_PREFIX}{id}"));
    let result = fill(home, &temp, &keys, request);
    let manifest = match result {
        Ok(manifest) => manifest,
        Err(error) => {
            let _ = fs::remove_dir_all(&temp);
            return Err(error);
        }
    };
    verify(&temp, &manifest).map_err(|_| {
        let _ = fs::remove_dir_all(&temp);
        failed("the copy did not match after writing")
    })?;
    fs::rename(&temp, root.join(&id)).map_err(|error| {
        let _ = fs::remove_dir_all(&temp);
        failed(error)
    })?;
    prune(&root, KEEP);
    Ok(summary(&id, &manifest))
}

fn fill(home: &Path, dir: &Path, keys: &BTreeMap<String, String>, request: &Request) -> Result<Manifest, UserError> {
    fs::create_dir(dir).map_err(failed)?;
    let snapshot = serde_json::to_vec_pretty(keys).map_err(failed)?;
    let mut local_storage = write_checked(&dir.join(LOCAL_STORAGE), &snapshot)?;
    local_storage.path = LOCAL_STORAGE.into();
    let mut files = Vec::new();
    let mut skipped = Vec::new();
    let mut total = 0u64;
    for relative in sources(home) {
        let text = relative_text(&relative);
        let Ok(meta) = fs::metadata(home.join(&relative)) else { continue };
        if meta.len() > MAX_FILE_BYTES || total + meta.len() > MAX_TOTAL_BYTES {
            skipped.push(text);
            continue;
        }
        let Ok(bytes) = fs::read(home.join(&relative)) else {
            skipped.push(text);
            continue;
        };
        total += bytes.len() as u64;
        let mut entry = write_checked(&dir.join(FILES_DIR).join(&relative), &bytes)?;
        entry.path = text;
        files.push(entry);
    }
    let manifest = Manifest {
        version: 1,
        from_version: request.from_version.into(),
        to_version: request.to_version.into(),
        created_at: request.now_millis,
        local_storage,
        files,
        skipped,
    };
    let text = serde_json::to_vec_pretty(&manifest).map_err(failed)?;
    write_checked(&dir.join(MANIFEST), &text)?;
    Ok(manifest)
}

fn check(path: &Path, entry: &Entry) -> Result<Vec<u8>, UserError> {
    let bytes = fs::read(path).map_err(|_| corrupt(&entry.path))?;
    if bytes.len() as u64 != entry.size || sha256(&bytes) != entry.sha256 {
        return Err(corrupt(&entry.path));
    }
    Ok(bytes)
}

pub(crate) fn verify(dir: &Path, manifest: &Manifest) -> Result<Vec<u8>, UserError> {
    let snapshot = check(&dir.join(LOCAL_STORAGE), &manifest.local_storage)?;
    for entry in &manifest.files {
        let relative = safe_relative(&entry.path).ok_or_else(|| corrupt(&entry.path))?;
        check(&dir.join(FILES_DIR).join(relative), entry)?;
    }
    Ok(snapshot)
}

pub(crate) fn read_manifest(dir: &Path) -> Option<Manifest> {
    let text = fs::read_to_string(dir.join(MANIFEST)).ok()?;
    serde_json::from_str::<Manifest>(&text).ok().filter(|manifest| manifest.version == 1)
}

fn summary(id: &str, manifest: &Manifest) -> BackupSummary {
    BackupSummary {
        id: id.into(),
        from_version: manifest.from_version.clone(),
        to_version: manifest.to_version.clone(),
        created_at: manifest.created_at,
        size: manifest.local_storage.size + manifest.files.iter().map(|entry| entry.size).sum::<u64>(),
        files: manifest.files.len(),
        skipped: manifest.skipped.clone(),
    }
}

fn backups(root: &Path) -> Vec<(String, Manifest)> {
    let Ok(entries) = fs::read_dir(root) else { return Vec::new() };
    let mut found: Vec<(String, Manifest)> = entries
        .flatten()
        .filter_map(|entry| {
            let id = entry.file_name().to_str()?.to_string();
            if !is_backup_id(&id) || !entry.file_type().ok()?.is_dir() {
                return None;
            }
            read_manifest(&entry.path()).map(|manifest| (id, manifest))
        })
        .collect();
    found.sort_by(|a, b| b.1.created_at.cmp(&a.1.created_at).then_with(|| b.0.cmp(&a.0)));
    found
}

fn remove_leftovers(root: &Path) {
    let Ok(entries) = fs::read_dir(root) else { return };
    for entry in entries.flatten() {
        if entry.file_name().to_string_lossy().starts_with(TEMP_PREFIX) {
            let _ = fs::remove_dir_all(entry.path());
        }
    }
}

pub(crate) fn prune(root: &Path, keep: usize) {
    for (id, _) in backups(root).into_iter().skip(keep) {
        let _ = fs::remove_dir_all(root.join(id));
    }
}

fn modified_millis(path: &Path) -> Option<i64> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    i64::try_from(modified.duration_since(UNIX_EPOCH).ok()?.as_millis()).ok()
}

fn broken_files(home: &Path, newest: Option<i64>) -> Vec<String> {
    let Some(newest) = newest else { return Vec::new() };
    let Ok(entries) = fs::read_dir(home) else { return Vec::new() };
    let mut found: Vec<String> = entries
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_str()?.to_string();
            let broken = name.starts_with("plugins.broken-") && name.ends_with(".json");
            (broken && modified_millis(&entry.path()).is_some_and(|at| at > newest)).then_some(name)
        })
        .collect();
    found.sort();
    found
}

pub(crate) fn list(home: &Path) -> BackupList {
    let root = home.join(BACKUP_DIR);
    let found = backups(&root);
    let newest = found.first().map(|(_, manifest)| manifest.created_at);
    BackupList {
        broken_files: broken_files(home, newest),
        pending_restore: pending(&root),
        backups: found.iter().map(|(id, manifest)| summary(id, manifest)).collect(),
    }
}

#[derive(Serialize, Deserialize)]
struct Pending {
    id: String,
}

fn pending(root: &Path) -> Option<String> {
    let text = fs::read_to_string(root.join(PENDING)).ok()?;
    serde_json::from_str::<Pending>(&text).ok().map(|pending| pending.id).filter(|id| is_backup_id(id))
}

fn not_found() -> UserError {
    UserError::new("updateBackup.notFound", "This backup no longer exists.")
}

pub(crate) fn prepare_restore(home: &Path, id: &str) -> Result<BTreeMap<String, String>, UserError> {
    if !is_backup_id(id) {
        return Err(not_found());
    }
    let root = home.join(BACKUP_DIR);
    let dir = root.join(id);
    let manifest = read_manifest(&dir).ok_or_else(not_found)?;
    let snapshot = verify(&dir, &manifest)?;
    let keys: BTreeMap<String, String> = serde_json::from_slice(&snapshot).map_err(|_| corrupt(LOCAL_STORAGE))?;
    let marker = serde_json::to_vec(&Pending { id: id.into() }).map_err(failed)?;
    crate::fs_write::replace_file(&root.join(PENDING), &marker).map_err(failed)?;
    Ok(keys)
}

pub(crate) fn apply_pending(home: &Path) -> Result<Option<String>, String> {
    let root = home.join(BACKUP_DIR);
    let Some(id) = pending(&root) else {
        let _ = fs::remove_file(root.join(PENDING));
        return Ok(None);
    };
    fs::remove_file(root.join(PENDING)).map_err(|error| format!("could not clear the restore marker: {error}"))?;
    let dir = root.join(&id);
    let manifest = read_manifest(&dir).ok_or_else(|| format!("backup {id} is missing"))?;
    verify(&dir, &manifest).map_err(|error| format!("backup {id} is damaged: {error}"))?;
    for entry in &manifest.files {
        let Some(relative) = safe_relative(&entry.path) else { continue };
        let bytes = fs::read(dir.join(FILES_DIR).join(&relative)).map_err(|error| format!("{}: {error}", entry.path))?;
        let target = home.join(&relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("{}: {error}", entry.path))?;
        }
        crate::fs_write::replace_file(&target, &bytes).map_err(|error| format!("{}: {error}", entry.path))?;
    }
    Ok(Some(id))
}
