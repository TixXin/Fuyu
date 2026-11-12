mod sheet;
#[cfg(test)]
mod tests;

use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;
#[cfg(windows)]
use std::os::windows::fs::OpenOptionsExt;

use crate::system::windows_home_dir;
use sheet::{image_header, sheet_rows, HEADER_BYTES};

const MANIFEST_FILE_NAME: &str = "pet.json";
const DEFAULT_SHEETS: [&str; 2] = ["spritesheet.webp", "spritesheet.png"];
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
const MAX_SHEET_BYTES: u64 = 4 * 1024 * 1024;
#[cfg(windows)]
const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x0020_0000;
#[cfg(target_os = "macos")]
const O_NOFOLLOW: i32 = 0x0100;
const MAX_DISPLAY_NAME_CHARS: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PetSource {
    App,
    Codex,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PetInfo {
    pub id: String,
    pub display_name: String,
    pub source: PetSource,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetManifest {
    display_name: Option<String>,
    spritesheet_path: Option<String>,
}

struct Pet {
    info: PetInfo,
    sheet: PathBuf,
    mime: &'static str,
}

#[tauri::command]
pub async fn list_pets(app: AppHandle) -> Result<Vec<PetInfo>, String> {
    Ok(list_pets_in(&pet_roots(&app)))
}

#[tauri::command]
pub async fn get_pet_spritesheet(app: AppHandle, id: String) -> Result<String, String> {
    read_spritesheet_in(&pet_roots(&app), &id)
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::pets::list_pets,
            crate::pets::get_pet_spritesheet,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

fn pet_roots(app: &AppHandle) -> Vec<(PetSource, PathBuf)> {
    let mut roots = Vec::new();
    if let Ok(dir) = crate::home_dir::fuyu_home(app.path()) {
        roots.push((PetSource::App, dir.join("pets")));
    }
    if let Ok(home) = windows_home_dir() {
        roots.push((PetSource::Codex, home.join(".codex").join("pets")));
    }
    roots
}

pub(crate) fn list_pets_in(roots: &[(PetSource, PathBuf)]) -> Vec<PetInfo> {
    let mut pets: Vec<PetInfo> = Vec::new();
    for (source, root) in roots {
        let Ok(entries) = fs::read_dir(root) else {
            continue;
        };
        let mut found: Vec<PetInfo> = entries
            .filter_map(Result::ok)
            .filter_map(|entry| entry.file_name().into_string().ok())
            .filter_map(|id| load_pet(*source, root, &id).map(|pet| pet.info))
            .filter(|pet| {
                pets.iter()
                    .all(|known| !known.id.eq_ignore_ascii_case(&pet.id))
            })
            .collect();
        found.sort_by_key(|pet| pet.display_name.to_lowercase());
        pets.extend(found);
    }
    pets
}

pub(crate) fn read_spritesheet_in(
    roots: &[(PetSource, PathBuf)],
    id: &str,
) -> Result<String, String> {
    if !is_valid_id(id) {
        return Err(format!("Invalid pet id: {id}"));
    }
    let pet = roots
        .iter()
        .find_map(|(source, root)| load_pet(*source, root, id))
        .ok_or_else(|| format!("Pet not found or invalid: {id}"))?;
    let bytes = read_capped(&pet.sheet, MAX_SHEET_BYTES)
        .map_err(|error| format!("Failed to read the spritesheet of {id}: {error}"))?;
    let header = image_header(&bytes).filter(|h| sheet_rows(h.width, h.height).is_some());
    if header.map(|header| header.mime) != Some(pet.mime) {
        return Err(format!(
            "The spritesheet of {id} changed while it was read."
        ));
    }
    Ok(format!(
        "data:{};base64,{}",
        pet.mime,
        general_purpose::STANDARD.encode(bytes)
    ))
}

pub(crate) fn is_valid_id(id: &str) -> bool {
    (1..=64).contains(&id.len())
        && !id.starts_with('.')
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

fn is_valid_sheet_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    Path::new(name).file_name().and_then(|n| n.to_str()) == Some(name)
        && !name.contains(['/', '\\', ':'])
        && (lower.ends_with(".webp") || lower.ends_with(".png"))
}

fn load_pet(source: PetSource, root: &Path, id: &str) -> Option<Pet> {
    if !is_valid_id(id) {
        return None;
    }
    let root = root.canonicalize().ok()?;
    let dir = root.join(id).canonicalize().ok()?;
    if !dir.starts_with(&root) || !dir.is_dir() {
        return None;
    }
    let manifest_path = dir.join(MANIFEST_FILE_NAME).canonicalize().ok()?;
    if !manifest_path.starts_with(&root) {
        return None;
    }
    let manifest_text = read_capped(&manifest_path, MAX_MANIFEST_BYTES).ok()?;
    let manifest: PetManifest = serde_json::from_slice(&manifest_text).ok()?;
    let (sheet, mime) = manifest
        .spritesheet_path
        .as_deref()
        .into_iter()
        .chain(DEFAULT_SHEETS)
        .find_map(|name| check_sheet(&root, &dir, name))?;
    let display_name = manifest
        .display_name
        .map(|name| {
            name.trim()
                .chars()
                .take(MAX_DISPLAY_NAME_CHARS)
                .collect::<String>()
        })
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| id.to_string());
    Some(Pet {
        info: PetInfo {
            id: id.to_string(),
            display_name,
            source,
        },
        sheet,
        mime,
    })
}

fn check_sheet(root: &Path, dir: &Path, name: &str) -> Option<(PathBuf, &'static str)> {
    if !is_valid_sheet_name(name) {
        return None;
    }
    let path = dir.join(name).canonicalize().ok()?;
    if !path.starts_with(root) {
        return None;
    }
    let mut file = open_regular_file(&path).ok()?;
    if file.metadata().ok()?.len() > MAX_SHEET_BYTES {
        return None;
    }
    let mut header = [0u8; HEADER_BYTES];
    file.read_exact(&mut header).ok()?;
    let header = image_header(&header)?;
    sheet_rows(header.width, header.height)?;
    Some((path, header.mime))
}

fn open_regular_file(path: &Path) -> Result<fs::File, String> {
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
    #[cfg(target_os = "macos")]
    options.custom_flags(O_NOFOLLOW);
    let file = options
        .open(path)
        .map_err(|error| error.to_string())?;
    if !file
        .metadata()
        .map_err(|error| error.to_string())?
        .is_file()
    {
        return Err("not a regular file".to_string());
    }
    Ok(file)
}

fn read_capped(path: &Path, max: u64) -> Result<Vec<u8>, String> {
    let file = open_regular_file(path)?;
    let mut bytes = Vec::new();
    file.take(max + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    if bytes.len() as u64 > max {
        return Err(format!("larger than {max} bytes"));
    }
    Ok(bytes)
}
