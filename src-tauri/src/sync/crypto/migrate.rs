use serde_json::Value;

use super::{wrap_data_key_with_params, DataKey, EncryptionMeta, ARGON2_ITERATIONS, ARGON2_MEMORY_KIB, ARGON2_PARALLELISM};
use crate::{
    sync::{
        backend::{is_ignored_name, Backend, BackendError},
        codec::{self, Cipher},
        device,
        layout::{self, Meta, DEVICES_DIR, META_FILE, SCHEMA_VERSION},
    },
    user_error::UserError,
};

#[derive(Debug, Clone, Copy)]
pub(crate) struct KdfStrength {
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
}

impl Default for KdfStrength {
    fn default() -> Self {
        Self {
            memory_kib: ARGON2_MEMORY_KIB,
            iterations: ARGON2_ITERATIONS,
            parallelism: ARGON2_PARALLELISM,
        }
    }
}

fn backend_err(error: BackendError) -> UserError {
    UserError::new("sync.migrationIo", error.message().to_string())
}

pub(crate) fn read_remote_meta(backend: &dyn Backend) -> Result<Option<Meta>, UserError> {
    backend.check().map_err(backend_err)?;
    let Some(bytes) = backend.read(META_FILE).map_err(backend_err)? else {
        return Ok(None);
    };
    let value = codec::decode_plain(META_FILE, &bytes).map_err(UserError::from)?;
    if layout::schema_version(&value) > u64::from(SCHEMA_VERSION) {
        return Err(UserError::new(
            "sync.newerVersion",
            "Remote data was written by a newer version of Fuyu.",
        ));
    }
    serde_json::from_value::<Meta>(value)
        .map(Some)
        .map_err(|error| UserError::new("sync.cryptoInvalidMeta", "Could not parse fuyu-sync/meta.json.").detail(error.to_string()))
}

fn write_remote_meta(backend: &dyn Backend, meta: &Meta) -> Result<(), UserError> {
    let bytes = codec::encode_plain(META_FILE, meta).map_err(UserError::from)?;
    backend.write(META_FILE, &bytes).map_err(backend_err)
}

pub(crate) fn list_all_device_files(backend: &dyn Backend) -> Result<Vec<String>, BackendError> {
    let mut paths = Vec::new();
    for dir_entry in backend.list(DEVICES_DIR)? {
        if !dir_entry.is_dir || !device::is_valid_id(&dir_entry.name) {
            continue;
        }
        let device_dir = format!("{DEVICES_DIR}/{}", dir_entry.name);
        for file_entry in backend.list(&device_dir)? {
            if file_entry.is_dir || is_ignored_name(&file_entry.name) || !file_entry.name.ends_with(".json") {
                continue;
            }
            paths.push(format!("{device_dir}/{}", file_entry.name));
        }
    }
    paths.sort();
    Ok(paths)
}

fn schema_or_default(value: &Value) -> u32 {
    value
        .get("schemaVersion")
        .and_then(Value::as_u64)
        .and_then(|version| u32::try_from(version).ok())
        .unwrap_or(SCHEMA_VERSION)
}

pub(crate) fn migrate_remote_to_encrypted_with(
    backend: &dyn Backend,
    now_ms: u64,
    passphrase: &str,
    strength: KdfStrength,
) -> Result<(EncryptionMeta, DataKey), UserError> {
    let mut meta = read_remote_meta(backend)?.unwrap_or_else(|| Meta::new(now_ms));
    if meta.encryption.is_some() {
        return Err(UserError::new(
            "sync.alreadyEncrypted",
            "End-to-end encryption is already enabled on the remote store.",
        ));
    }

    let key = DataKey::generate()?;
    let enc_meta = wrap_data_key_with_params(
        &key,
        passphrase,
        strength.memory_kib,
        strength.iterations,
        strength.parallelism,
    )?;

    let files = list_all_device_files(backend).map_err(backend_err)?;
    let mut decoded_files: Vec<(String, u32, Value)> = Vec::with_capacity(files.len());
    for path in files {
        let Some(bytes) = backend.read(&path).map_err(backend_err)? else {
            continue;
        };
        let value = codec::decode(&path, &bytes, &Cipher::Plain).map_err(UserError::from)?;
        let version = schema_or_default(&value);
        decoded_files.push((path, version, value));
    }

    let cipher = Cipher::Encrypted(key.clone());
    for (path, version, value) in &decoded_files {
        let encrypted = codec::encode(path, *version, value, &cipher).map_err(UserError::from)?;
        backend.write(path, &encrypted).map_err(backend_err)?;
    }

    meta.encryption = Some(enc_meta.clone());
    write_remote_meta(backend, &meta)?;
    Ok((enc_meta, key))
}

pub(crate) fn migrate_remote_to_plain(backend: &dyn Backend, key: &DataKey) -> Result<(), UserError> {
    let Some(mut meta) = read_remote_meta(backend)? else {
        return Ok(());
    };
    let Some(current_enc) = meta.encryption.as_ref() else {
        return Ok(());
    };
    if current_enc.key_check != key.key_check() {
        return Err(UserError::new(
            "sync.badPassphrase",
            "The sync passphrase or recovery key does not match the remote store.",
        ));
    }

    let cipher = Cipher::Encrypted(key.clone());
    let files = list_all_device_files(backend).map_err(backend_err)?;
    let mut decrypted_files: Vec<(String, Value)> = Vec::with_capacity(files.len());
    for path in files {
        let Some(bytes) = backend.read(&path).map_err(backend_err)? else {
            continue;
        };
        let value = codec::decode(&path, &bytes, &cipher).map_err(UserError::from)?;
        decrypted_files.push((path, value));
    }

    for (path, value) in &decrypted_files {
        let plain = codec::encode(path, SCHEMA_VERSION, value, &Cipher::Plain).map_err(UserError::from)?;
        backend.write(path, &plain).map_err(backend_err)?;
    }

    meta.encryption = None;
    write_remote_meta(backend, &meta)
}

pub(crate) fn rewrap_remote_passphrase_with(
    backend: &dyn Backend,
    key: &DataKey,
    new_passphrase: &str,
    strength: KdfStrength,
) -> Result<EncryptionMeta, UserError> {
    let mut meta = read_remote_meta(backend)?.ok_or_else(|| {
        UserError::new("sync.notEncrypted", "End-to-end encryption is not enabled yet.")
    })?;
    let current = meta.encryption.as_ref().ok_or_else(|| {
        UserError::new("sync.notEncrypted", "End-to-end encryption is not enabled yet.")
    })?;
    if current.key_check != key.key_check() {
        return Err(UserError::new(
            "sync.badPassphrase",
            "The unlocked key does not match the remote encryption store.",
        ));
    }
    let next_enc = wrap_data_key_with_params(
        key,
        new_passphrase,
        strength.memory_kib,
        strength.iterations,
        strength.parallelism,
    )?;
    meta.encryption = Some(next_enc.clone());
    write_remote_meta(backend, &meta)?;
    Ok(next_enc)
}

pub(crate) fn reset_remote_store_with(
    backend: &dyn Backend,
    now_ms: u64,
    passphrase: Option<&str>,
    strength: KdfStrength,
) -> Result<Option<(EncryptionMeta, DataKey)>, UserError> {
    backend.check().map_err(backend_err)?;
    let files = list_all_device_files(backend).map_err(backend_err)?;
    for path in files {
        backend.delete(&path).map_err(backend_err)?;
    }
    let mut meta = Meta::new(now_ms);
    let generated = match passphrase.map(str::trim).filter(|text| !text.is_empty()) {
        Some(pass) => {
            let key = DataKey::generate()?;
            let enc = wrap_data_key_with_params(
                &key,
                pass,
                strength.memory_kib,
                strength.iterations,
                strength.parallelism,
            )?;
            meta.encryption = Some(enc.clone());
            Some((enc, key))
        }
        None => None,
    };
    write_remote_meta(backend, &meta)?;
    Ok(generated)
}
