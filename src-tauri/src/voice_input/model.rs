use std::{
    fs::{self, File},
    io::{self, Read},
    path::{Component, Path, PathBuf},
};

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, Runtime};

use super::packs::{file_name, Pack, MODEL, RUNTIME};
use crate::home_dir::fuyu_home;
use crate::user_error::UserError;

const ROOT_DIR: [&str; 2] = ["models", "voice-input"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceModelStatus {
    pub installed: bool,
    pub supported: bool,
    pub downloading: bool,
    pub size_bytes: u64,
    pub download_bytes: u64,
}

pub(crate) fn root_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, UserError> {
    fuyu_home(app.path())
        .map(|home| ROOT_DIR.iter().fold(home, |dir, part| dir.join(part)))
        .map_err(|error| UserError::new("voiceInput.noDataDir", "Could not find the island's data folder.").detail(error))
}

pub(crate) fn packs() -> Vec<&'static Pack> {
    RUNTIME.as_ref().into_iter().chain(std::iter::once(&MODEL)).collect()
}

pub(crate) fn pack_dir(root: &Path, pack: &Pack) -> PathBuf {
    root.join(pack.dir)
}

pub(crate) fn archive_path(root: &Path, pack: &Pack) -> PathBuf {
    root.join(format!("{}.tar.bz2.part", pack.dir))
}

pub(crate) fn has_files(pack: &Pack, dir: &Path) -> bool {
    pack.files.iter().all(|file| dir.join(file_name(file.entry)).is_file())
}

fn pack_bytes(pack: &Pack, dir: &Path) -> u64 {
    pack.files.iter().filter_map(|file| fs::metadata(dir.join(file_name(file.entry))).ok()).map(|meta| meta.len()).sum()
}

pub(crate) fn is_installed(root: &Path) -> bool {
    RUNTIME.is_some() && packs().iter().all(|pack| has_files(pack, &pack_dir(root, pack)))
}

pub(crate) fn missing(root: &Path) -> Vec<&'static Pack> {
    packs().into_iter().filter(|pack| !has_files(pack, &pack_dir(root, pack))).collect()
}

pub(crate) fn status(root: &Path, downloading: bool) -> VoiceModelStatus {
    let size_bytes: u64 = packs().iter().map(|pack| pack_bytes(pack, &pack_dir(root, pack))).sum();
    let download_bytes: u64 = missing(root).iter().map(|pack| pack.bytes).sum();
    VoiceModelStatus { installed: is_installed(root), supported: RUNTIME.is_some(), downloading, size_bytes, download_bytes }
}

pub(crate) fn remove(root: &Path) -> Result<(), UserError> {
    match fs::remove_dir_all(root) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(UserError::new("voiceInput.deleteFailed", "Could not delete the speech model.").detail(error)),
    }
}

fn wanted_name(pack: &Pack, path: &Path) -> Option<&'static str> {
    let mut parts = path.components();
    if !matches!(parts.next(), Some(Component::Normal(_))) {
        return None;
    }
    let mut inner = Vec::new();
    for part in parts {
        let Component::Normal(name) = part else { return None };
        inner.push(name.to_str()?);
    }
    let inner = inner.join("/");
    pack.files.iter().find(|file| file.entry == inner).map(|file| file_name(file.entry))
}

pub(crate) fn unpack(pack: &Pack, archive: impl Read, target: &Path) -> Result<(), String> {
    let staging = target.with_extension("partial");
    let _ = fs::remove_dir_all(&staging);
    fs::create_dir_all(&staging).map_err(|error| error.to_string())?;
    let mut entries = tar::Archive::new(bzip2::read::BzDecoder::new(archive));
    for entry in entries.entries().map_err(|error| error.to_string())? {
        let mut entry = entry.map_err(|error| error.to_string())?;
        if !entry.header().entry_type().is_file() {
            continue;
        }
        let name = match entry.path() {
            Ok(path) => wanted_name(pack, &path),
            Err(_) => None,
        };
        if let Some(name) = name {
            let mut file = File::create(staging.join(name)).map_err(|error| error.to_string())?;
            io::copy(&mut entry, &mut file).map_err(|error| error.to_string())?;
        }
    }
    if !has_files(pack, &staging) {
        let _ = fs::remove_dir_all(&staging);
        return Err("The archive does not contain the expected files.".to_string());
    }
    let _ = fs::remove_dir_all(target);
    fs::rename(&staging, target).map_err(|error| error.to_string())
}

pub(crate) fn file_sha256(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1 << 16];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(sha256_hex(&hasher.finalize()))
}

pub(crate) fn verify(pack: &Pack, dir: &Path) -> Result<(), String> {
    for file in pack.files {
        let Some(expected) = file.sha256 else { continue };
        let path = dir.join(file_name(file.entry));
        let found = file_sha256(&path).map_err(|error| format!("{}: {error}", path.display()))?;
        if found != expected {
            return Err(format!("{} does not match the expected checksum", path.display()));
        }
    }
    Ok(())
}

pub(crate) fn sha256_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}
