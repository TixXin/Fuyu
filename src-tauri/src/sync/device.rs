use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock, PoisonError},
};

pub(crate) const FILE_NAME: &str = "sync-device.json";
const ID_BYTES: usize = 8;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeviceFile {
    device_id: String,
    created_at: u64,
}

static DIR: OnceLock<PathBuf> = OnceLock::new();
static ID: Mutex<Option<String>> = Mutex::new(None);

pub(crate) fn init(dir: PathBuf) {
    let _ = DIR.set(dir);
}

pub(crate) fn id() -> Result<String, String> {
    let mut cached = ID.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(id) = cached.as_ref() {
        return Ok(id.clone());
    }
    let dir = DIR.get().ok_or_else(|| "The sync device id is not initialized.".to_string())?;
    let id = load_or_create(dir)?;
    *cached = Some(id.clone());
    Ok(id)
}

pub(crate) fn is_valid_id(id: &str) -> bool {
    (1..=64).contains(&id.len()) && id.bytes().all(|byte| byte.is_ascii_digit() || byte.is_ascii_lowercase())
}

pub(crate) fn load_or_create(dir: &Path) -> Result<String, String> {
    let path = dir.join(FILE_NAME);
    match fs::read_to_string(&path) {
        Ok(text) => match serde_json::from_str::<DeviceFile>(text.trim_start_matches('\u{feff}')) {
            Ok(file) if is_valid_id(&file.device_id) => return Ok(file.device_id),
            _ => set_aside(&path),
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("Could not read {}: {error}", path.display())),
    }
    let file = DeviceFile { device_id: generate()?, created_at: crate::sync::clock::wall_ms() };
    let text = serde_json::to_string_pretty(&file).map_err(|error| format!("Could not encode the device id: {error}"))?;
    fs::create_dir_all(dir).map_err(|error| format!("Could not create {}: {error}", dir.display()))?;
    crate::fs_write::replace_file(&path, text.as_bytes()).map_err(|error| format!("Could not write {}: {error}", path.display()))?;
    Ok(file.device_id)
}

fn set_aside(path: &Path) {
    let aside = path.with_extension(format!("damaged-{}.json", crate::sync::clock::wall_ms()));
    let _ = fs::rename(path, aside);
}

fn generate() -> Result<String, String> {
    let mut bytes = [0u8; ID_BYTES];
    getrandom::fill(&mut bytes).map_err(|error| format!("Could not make a device id: {error}"))?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}
