use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{ipc::Response, AppHandle, Manager};

use crate::user_error::UserError;

const PACKS_DIR: &str = "sound-packs";
const MANIFEST: &str = "pack.json";
pub(crate) const SOUND_EVENTS: [&str; 10] = [
    "start", "complete", "error", "approval", "question", "ack", "compact", "idle", "quotaLow", "quotaReset",
];
const EXTENSIONS: [&str; 5] = ["wav", "mp3", "ogg", "m4a", "flac"];
const MAX_FILE_BYTES: usize = 4 * 1024 * 1024;
const MAX_TEXT_CHARS: usize = 120;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SoundPack {
    pub id: String,
    pub name: String,
    pub author: String,
    pub license: String,
    pub sounds: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name_en: Option<String>,
    #[serde(default)]
    pub from_plugin: bool,
}

const PLUGIN_PACK_PREFIX: &str = "plugin:";

#[derive(Deserialize)]
pub struct SoundPackImport {
    name: String,
    author: String,
    license: String,
    files: Vec<SoundPackFile>,
}

#[derive(Deserialize)]
pub struct SoundPackFile {
    event: String,
    name: String,
    bytes: Vec<u8>,
}

fn packs_dir(app: &AppHandle) -> Result<PathBuf, UserError> {
    crate::home_dir::fuyu_home(app.path())
        .map(|dir| dir.join(PACKS_DIR))
        .map_err(|error| UserError::new("soundPack.noDataDir", "Could not find the app data folder.").detail(error))
}

fn clean_text(value: &str) -> String {
    value.trim().chars().filter(|c| !c.is_control()).take(MAX_TEXT_CHARS).collect()
}

pub(crate) fn is_valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

pub(crate) fn pack_id(name: &str, now_ms: u128) -> String {
    let mut slug = String::new();
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c.to_ascii_lowercase());
        } else if !slug.ends_with('-') && !slug.is_empty() {
            slug.push('-');
        }
        if slug.len() >= 32 {
            break;
        }
    }
    let slug = slug.trim_matches('-');
    let slug = if slug.is_empty() { "pack" } else { slug };
    format!("{slug}-{now_ms:x}")
}

pub(crate) fn sound_extension(name: &str) -> Option<String> {
    let extension = Path::new(name).extension()?.to_str()?.to_ascii_lowercase();
    EXTENSIONS.contains(&extension.as_str()).then_some(extension)
}

type PackFile = (String, Vec<u8>);

pub(crate) fn plan_import(pack: SoundPackImport, id: String) -> Result<(SoundPack, Vec<PackFile>), UserError> {
    let mut sounds = BTreeMap::new();
    let mut files = Vec::new();
    for file in pack.files {
        if !SOUND_EVENTS.contains(&file.event.as_str()) || sounds.contains_key(&file.event) {
            continue;
        }
        let extension = sound_extension(&file.name).ok_or_else(|| {
            UserError::new("soundPack.format", format!("Unsupported sound format: {}", file.name)).arg("name", file.name.as_str())
        })?;
        if file.bytes.is_empty() || file.bytes.len() > MAX_FILE_BYTES {
            return Err(UserError::new(
                "soundPack.sizeOrEmpty",
                format!("The sound file is empty or too large: {} (at most 4 MB).", file.name),
            )
            .arg("name", file.name.as_str()));
        }
        let stored = format!("{}.{extension}", file.event);
        sounds.insert(file.event, stored.clone());
        files.push((stored, file.bytes));
    }
    if sounds.is_empty() {
        return Err(UserError::new("soundPack.empty", "There are no usable sounds in this folder."));
    }
    let name = clean_text(&pack.name);
    let pack = SoundPack {
        id,
        name: if name.is_empty() { "音效包".into() } else { name },
        author: clean_text(&pack.author),
        license: clean_text(&pack.license),
        sounds,
        name_en: None,
        from_plugin: false,
    };
    Ok((pack, files))
}

fn read_pack(dir: &Path) -> Option<SoundPack> {
    let pack: SoundPack = serde_json::from_slice(&fs::read(dir.join(MANIFEST)).ok()?).ok()?;
    let folder_id = dir.file_name()?.to_str()?;
    (pack.id == folder_id && is_valid_id(&pack.id)).then_some(pack)
}

fn resolve_pack(app: &AppHandle, id: &str) -> Result<(SoundPack, PathBuf), UserError> {
    if id.starts_with(PLUGIN_PACK_PREFIX) {
        Err(UserError::new("soundPack.pluginGone", "This sound pack was not found; the plugin may be disabled or uninstalled."))
    } else if is_valid_id(id) {
        let dir = packs_dir(app)?.join(id);
        let pack = read_pack(&dir).ok_or_else(|| UserError::new("soundPack.notFound", "This sound pack was not found."))?;
        Ok((pack, dir))
    } else {
        Err(UserError::new("soundPack.badId", "The sound pack id is not valid."))
    }
}

#[tauri::command]
pub async fn list_sound_packs(app: AppHandle) -> Result<Vec<SoundPack>, UserError> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = packs_dir(&app)?;
        let mut packs: Vec<SoundPack> = fs::read_dir(&dir)
            .map(|entries| entries.flatten().filter_map(|entry| read_pack(&entry.path())).collect())
            .unwrap_or_default();
        packs.sort_by_key(|pack| pack.name.to_lowercase());
        Ok(packs)
    })
    .await
    .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

#[tauri::command]
pub async fn import_sound_pack(app: AppHandle, pack: SoundPackImport) -> Result<SoundPack, UserError> {
    tauri::async_runtime::spawn_blocking(move || {
        let now_ms = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or_default();
        let id = pack_id(&pack.name, now_ms);
        let (pack, files) = plan_import(pack, id)?;
        let dir = packs_dir(&app)?;
        let staging = dir.join(format!("{}.importing", pack.id));
        let write = || -> Result<(), UserError> {
            fs::create_dir_all(&staging).map_err(|error| {
                UserError::new("file.create", format!("Could not create {}.", staging.display()))
                    .arg("path", staging.display().to_string())
                    .detail(error)
            })?;
            for (name, bytes) in &files {
                fs::write(staging.join(name), bytes).map_err(|error| {
                    UserError::new("soundPack.writeSound", format!("Could not write sound {name}."))
                        .arg("name", name.as_str())
                        .detail(error)
                })?;
            }
            let manifest = serde_json::to_vec_pretty(&pack)
                .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?;
            fs::write(staging.join(MANIFEST), manifest).map_err(|error| {
                UserError::new("file.write", format!("Could not write {MANIFEST}.")).arg("path", MANIFEST).detail(error)
            })?;
            fs::rename(&staging, dir.join(&pack.id))
                .map_err(|error| UserError::new("soundPack.save", "Could not save the sound pack.").detail(error))
        };
        if let Err(error) = write() {
            let _ = fs::remove_dir_all(&staging);
            return Err(error);
        }
        Ok(pack)
    })
    .await
    .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

#[tauri::command]
pub async fn remove_sound_pack(app: AppHandle, id: String) -> Result<(), UserError> {
    tauri::async_runtime::spawn_blocking(move || {
        if id.starts_with(PLUGIN_PACK_PREFIX) {
            return Err(UserError::new(
                "soundPack.fromPlugin",
                "This sound pack comes from a plugin; disable or uninstall it on the Plugins page.",
            ));
        }
        if !is_valid_id(&id) {
            return Err(UserError::new("soundPack.badId", "The sound pack id is not valid."));
        }
        let dir = packs_dir(&app)?.join(&id);
        if read_pack(&dir).is_none() {
            return Err(UserError::new("soundPack.notFound", "This sound pack was not found."));
        }
        fs::remove_dir_all(&dir)
            .map_err(|error| UserError::new("soundPack.delete", "Could not delete the sound pack.").detail(error))
    })
    .await
    .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

#[tauri::command]
pub async fn open_sound_pack_folder(app: AppHandle, id: String) -> Result<(), UserError> {
    tauri::async_runtime::spawn_blocking(move || {
        let (_, dir) = resolve_pack(&app, &id)?;
        tauri_plugin_opener::open_path(&dir, None::<&str>)
            .map_err(|error| UserError::new("soundPack.openFolder", "Could not open the folder.").detail(error))
    })
    .await
    .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

#[tauri::command]
pub async fn read_sound_pack_file(app: AppHandle, id: String, file: String) -> Result<Response, UserError> {
    let bytes = tauri::async_runtime::spawn_blocking(move || -> Result<Vec<u8>, UserError> {
        let (pack, dir) = resolve_pack(&app, &id)?;
        if !pack.sounds.values().any(|listed| listed == &file) {
            return Err(UserError::new("soundPack.fileMissing", "This file is not in the sound pack."));
        }
        let bytes = fs::read(dir.join(&file)).map_err(|error| {
            UserError::new("soundPack.readSound", format!("Could not read sound {file}.")).arg("name", file.as_str()).detail(error)
        })?;
        if bytes.len() > MAX_FILE_BYTES {
            return Err(UserError::new("soundPack.tooLarge", format!("The sound file is too large: {file} (at most 4 MB).")).arg("name", file.as_str()));
        }
        Ok(bytes)
    })
    .await
    .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))??;
    Ok(Response::new(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(event: &str, name: &str, len: usize) -> SoundPackFile {
        SoundPackFile { event: event.into(), name: name.into(), bytes: vec![1; len] }
    }

    #[test]
    fn ids_are_ascii_slugs_with_the_time() {
        assert_eq!(pack_id("Vibe 8-bit 录音", 255), "vibe-8-bit-ff");
        assert_eq!(pack_id("录音", 16), "pack-10");
        assert!(is_valid_id(&pack_id("A B", 1)));
        assert!(!is_valid_id("../x") && !is_valid_id("") && !is_valid_id("A"));
    }

    #[test]
    fn imports_keep_known_events_and_name_files_by_event() {
        let import = SoundPackImport {
            name: "  Pack\n".into(),
            author: "me".into(),
            license: "CC0-1.0".into(),
            files: vec![
                file("complete", "02-Task-Complete.WAV", 10),
                file("complete", "other.wav", 10),
                file("lunch", "07-lunch.wav", 10),
                file("question", "ask.mp3", 10),
            ],
        };
        let (pack, files) = plan_import(import, "pack-1".into()).expect("plan");
        assert_eq!(pack.name, "Pack");
        assert_eq!(pack.sounds.get("complete").map(String::as_str), Some("complete.wav"));
        assert_eq!(pack.sounds.get("question").map(String::as_str), Some("question.mp3"));
        assert_eq!(pack.sounds.len(), 2);
        assert_eq!(files.len(), 2);
    }

    #[test]
    fn imports_refuse_unknown_formats_large_files_and_empty_packs() {
        let pack = |files| SoundPackImport { name: "p".into(), author: String::new(), license: String::new(), files };
        assert_eq!(plan_import(pack(vec![file("start", "a.exe", 10)]), "p-1".into()).unwrap_err().code(), "soundPack.format");
        assert_eq!(plan_import(pack(vec![file("start", "a.wav", MAX_FILE_BYTES + 1)]), "p-1".into()).unwrap_err().code(), "soundPack.sizeOrEmpty");
        assert_eq!(plan_import(pack(vec![file("lunch", "a.wav", 10)]), "p-1".into()).unwrap_err().code(), "soundPack.empty");
    }
}
