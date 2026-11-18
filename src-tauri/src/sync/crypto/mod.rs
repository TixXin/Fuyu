pub(crate) mod commands;
pub(crate) mod keychain;
pub(crate) mod migrate;
#[cfg(test)]
mod tests;

use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    XChaCha20Poly1305, XNonce,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::user_error::UserError;

pub(crate) const ENCRYPTION_VERSION: u32 = 1;
pub(crate) const ARGON2_MEMORY_KIB: u32 = 65_536;
pub(crate) const ARGON2_ITERATIONS: u32 = 3;
pub(crate) const ARGON2_PARALLELISM: u32 = 1;
pub(crate) const MIN_PASSPHRASE_CHARS: usize = 6;

const MIN_ACCEPTED_MEMORY_KIB: u32 = 8_192;
const MAX_ACCEPTED_MEMORY_KIB: u32 = 524_288;
const MIN_ACCEPTED_ITERATIONS: u32 = 1;
const MAX_ACCEPTED_ITERATIONS: u32 = 16;
const MIN_ACCEPTED_PARALLELISM: u32 = 1;
const MAX_ACCEPTED_PARALLELISM: u32 = 8;

const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 24;
const KEY_LEN: usize = 32;
const WRAP_AAD: &[u8] = b"fuyu-sync/meta.json:wrap:v1";
const KEY_CHECK_DOMAIN: &[u8] = b"fuyu-sync-key-check-v1:";
const RECOVERY_CHECK_DOMAIN: &[u8] = b"fuyu-sync-rk-v1:";
const RECOVERY_PREFIX: &str = "FUYU";
const BASE32_ALPHABET: &[u8; 32] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

#[derive(Clone, PartialEq, Eq)]
pub(crate) struct DataKey([u8; KEY_LEN]);

impl std::fmt::Debug for DataKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("DataKey([REDACTED])")
    }
}

impl DataKey {
    pub(crate) fn generate() -> Result<Self, UserError> {
        let mut bytes = [0u8; KEY_LEN];
        getrandom::fill(&mut bytes).map_err(|error| {
            UserError::new("sync.cryptoRandom", "Could not generate random encryption key.")
                .detail(error.to_string())
        })?;
        Ok(Self(bytes))
    }

    pub(crate) fn to_hex(&self) -> String {
        self.0.iter().map(|byte| format!("{byte:02x}")).collect()
    }

    pub(crate) fn from_hex(hex: &str) -> Option<Self> {
        let trimmed = hex.trim();
        if trimmed.len() != KEY_LEN * 2 {
            return None;
        }
        let mut bytes = [0u8; KEY_LEN];
        for (index, slot) in bytes.iter_mut().enumerate() {
            *slot = u8::from_str_radix(&trimmed[index * 2..index * 2 + 2], 16).ok()?;
        }
        Some(Self(bytes))
    }

    pub(crate) fn key_check(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(KEY_CHECK_DOMAIN);
        hasher.update(self.0);
        hasher
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }

    pub(crate) fn key_id(&self) -> String {
        self.key_check().chars().take(12).collect()
    }

    pub(crate) fn to_recovery_key(&self) -> String {
        let mut check_hasher = Sha256::new();
        check_hasher.update(RECOVERY_CHECK_DOMAIN);
        check_hasher.update(self.0);
        let check = check_hasher.finalize();

        let mut raw = [0u8; 35];
        raw[..32].copy_from_slice(&self.0);
        raw[32..35].copy_from_slice(&check[..3]);

        let encoded = encode_base32_35(&raw);
        let mut out = String::with_capacity(68);
        out.push_str(RECOVERY_PREFIX);
        for chunk in encoded.as_bytes().chunks(7) {
            out.push('-');
            for &ch in chunk {
                out.push(char::from(ch));
            }
        }
        out
    }

    pub(crate) fn from_recovery_key(input: &str) -> Option<Self> {
        let mut cleaned: String = input
            .chars()
            .filter(|ch| !ch.is_whitespace() && *ch != '-')
            .map(|ch| ch.to_ascii_uppercase())
            .collect();
        if let Some(rest) = cleaned.strip_prefix(RECOVERY_PREFIX) {
            cleaned = rest.to_string();
        }
        let raw = decode_base32_35(&cleaned)?;
        let mut key_bytes = [0u8; KEY_LEN];
        key_bytes.copy_from_slice(&raw[..32]);

        let mut check_hasher = Sha256::new();
        check_hasher.update(RECOVERY_CHECK_DOMAIN);
        check_hasher.update(key_bytes);
        let expected = check_hasher.finalize();
        if raw[32..35] != expected[..3] {
            return None;
        }
        Some(Self(key_bytes))
    }
}

fn encode_base32_35(bytes: &[u8; 35]) -> String {
    let mut out = String::with_capacity(56);
    for group in bytes.as_chunks::<5>().0 {
        let value = (u64::from(group[0]) << 32)
            | (u64::from(group[1]) << 24)
            | (u64::from(group[2]) << 16)
            | (u64::from(group[3]) << 8)
            | u64::from(group[4]);
        for shift in (0..8).rev() {
            let index = ((value >> (shift * 5)) & 0x1F) as usize;
            out.push(char::from(BASE32_ALPHABET[index]));
        }
    }
    out
}

fn decode_base32_35(text: &str) -> Option<[u8; 35]> {
    if text.len() != 56 {
        return None;
    }
    let mut out = [0u8; 35];
    for (group_idx, chars) in text.as_bytes().as_chunks::<8>().0.iter().enumerate() {
        let mut acc = 0u64;
        for &byte in chars {
            let val = BASE32_ALPHABET.iter().position(|&c| c == byte)? as u64;
            acc = (acc << 5) | val;
        }
        let offset = group_idx * 5;
        out[offset] = ((acc >> 32) & 0xFF) as u8;
        out[offset + 1] = ((acc >> 24) & 0xFF) as u8;
        out[offset + 2] = ((acc >> 16) & 0xFF) as u8;
        out[offset + 3] = ((acc >> 8) & 0xFF) as u8;
        out[offset + 4] = (acc & 0xFF) as u8;
    }
    Some(out)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KdfMeta {
    pub algorithm: String,
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
    pub salt: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WrappedKeyMeta {
    pub nonce: String,
    pub ciphertext: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptionMeta {
    pub version: u32,
    pub kdf: KdfMeta,
    pub wrapped_key: WrappedKeyMeta,
    pub key_check: String,
}

impl EncryptionMeta {
    pub(crate) fn key_id(&self) -> String {
        self.key_check.chars().take(12).collect()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EncryptedEnvelope {
    fuyu_encrypted: u32,
    schema_version: u32,
    nonce: String,
    ciphertext: String,
}

pub(crate) fn check_passphrase_strength(passphrase: &str) -> Result<&str, UserError> {
    let trimmed = passphrase.trim();
    if trimmed.chars().count() < MIN_PASSPHRASE_CHARS {
        return Err(UserError::new(
            "sync.passphraseTooShort",
            format!("Use a sync passphrase with at least {MIN_PASSPHRASE_CHARS} characters."),
        )
        .arg("min", MIN_PASSPHRASE_CHARS.to_string()));
    }
    Ok(trimmed)
}

fn derive_kek(
    passphrase: &str,
    salt: &[u8],
    memory_kib: u32,
    iterations: u32,
    parallelism: u32,
) -> Result<[u8; KEY_LEN], UserError> {
    let params = Params::new(memory_kib, iterations, parallelism, Some(KEY_LEN)).map_err(|error| {
        UserError::new("sync.cryptoInvalidMeta", "The remote encryption header is invalid.")
            .detail(error.to_string())
    })?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut kek = [0u8; KEY_LEN];
    argon2
        .hash_password_into(passphrase.as_bytes(), salt, &mut kek)
        .map_err(|error| {
            UserError::new("sync.cryptoDeriveFailed", "Could not derive the sync encryption key.")
                .detail(error.to_string())
        })?;
    Ok(kek)
}

#[cfg(test)]
pub(crate) fn wrap_data_key(data_key: &DataKey, passphrase: &str) -> Result<EncryptionMeta, UserError> {
    wrap_data_key_with_params(
        data_key,
        passphrase,
        ARGON2_MEMORY_KIB,
        ARGON2_ITERATIONS,
        ARGON2_PARALLELISM,
    )
}

pub(crate) fn wrap_data_key_with_params(
    data_key: &DataKey,
    passphrase: &str,
    memory_kib: u32,
    iterations: u32,
    parallelism: u32,
) -> Result<EncryptionMeta, UserError> {
    let trimmed = check_passphrase_strength(passphrase)?;
    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    getrandom::fill(&mut salt).map_err(|error| {
        UserError::new("sync.cryptoRandom", "Could not generate encryption salt.")
            .detail(error.to_string())
    })?;
    getrandom::fill(&mut nonce_bytes).map_err(|error| {
        UserError::new("sync.cryptoRandom", "Could not generate encryption nonce.")
            .detail(error.to_string())
    })?;

    let kek = derive_kek(trimmed, &salt, memory_kib, iterations, parallelism)?;
    let cipher = XChaCha20Poly1305::new((&kek).into());
    let wrapped = cipher
        .encrypt(
            XNonce::from_slice(&nonce_bytes),
            Payload { msg: &data_key.0, aad: WRAP_AAD },
        )
        .map_err(|_| UserError::new("sync.cryptoWrapFailed", "Could not wrap the sync data key."))?;

    Ok(EncryptionMeta {
        version: ENCRYPTION_VERSION,
        kdf: KdfMeta {
            algorithm: "argon2id".into(),
            memory_kib,
            iterations,
            parallelism,
            salt: BASE64.encode(salt),
        },
        wrapped_key: WrappedKeyMeta {
            nonce: BASE64.encode(nonce_bytes),
            ciphertext: BASE64.encode(wrapped),
        },
        key_check: data_key.key_check(),
    })
}

pub(crate) fn unwrap_with_secret(meta: &EncryptionMeta, secret: &str) -> Result<DataKey, UserError> {
    if meta.version > ENCRYPTION_VERSION {
        return Err(UserError::new(
            "sync.cryptoNewerVersion",
            "Remote encryption uses a newer format; update Fuyu first.",
        ));
    }
    let trimmed = secret.trim();
    if trimmed.is_empty() {
        return Err(UserError::new(
            "sync.badPassphrase",
            "The sync passphrase or recovery key is incorrect.",
        ));
    }

    if let Some(recovered) = DataKey::from_recovery_key(trimmed) {
        if recovered.key_check() == meta.key_check {
            return Ok(recovered);
        }
    }

    if meta.kdf.algorithm != "argon2id"
        || !(MIN_ACCEPTED_MEMORY_KIB..=MAX_ACCEPTED_MEMORY_KIB).contains(&meta.kdf.memory_kib)
        || !(MIN_ACCEPTED_ITERATIONS..=MAX_ACCEPTED_ITERATIONS).contains(&meta.kdf.iterations)
        || !(MIN_ACCEPTED_PARALLELISM..=MAX_ACCEPTED_PARALLELISM).contains(&meta.kdf.parallelism)
    {
        return Err(UserError::new(
            "sync.cryptoInvalidMeta",
            "The remote encryption parameters are invalid or unsupported.",
        ));
    }

    let salt = BASE64.decode(&meta.kdf.salt).map_err(|_| {
        UserError::new("sync.cryptoInvalidMeta", "The remote encryption salt is invalid.")
    })?;
    if salt.len() < 8 || salt.len() > 64 {
        return Err(UserError::new(
            "sync.cryptoInvalidMeta",
            "The remote encryption salt length is invalid.",
        ));
    }
    let nonce = BASE64.decode(&meta.wrapped_key.nonce).map_err(|_| {
        UserError::new("sync.cryptoInvalidMeta", "The remote wrapped key nonce is invalid.")
    })?;
    if nonce.len() != NONCE_LEN {
        return Err(UserError::new(
            "sync.cryptoInvalidMeta",
            "The remote wrapped key nonce length is invalid.",
        ));
    }
    let ciphertext = BASE64.decode(&meta.wrapped_key.ciphertext).map_err(|_| {
        UserError::new("sync.cryptoInvalidMeta", "The remote wrapped key ciphertext is invalid.")
    })?;

    let kek = derive_kek(
        trimmed,
        &salt,
        meta.kdf.memory_kib,
        meta.kdf.iterations,
        meta.kdf.parallelism,
    )?;
    let cipher = XChaCha20Poly1305::new((&kek).into());
    let raw_key = cipher
        .decrypt(
            XNonce::from_slice(&nonce),
            Payload { msg: &ciphertext, aad: WRAP_AAD },
        )
        .map_err(|_| {
            UserError::new(
                "sync.badPassphrase",
                "The sync passphrase or recovery key is incorrect.",
            )
        })?;
    let key_bytes: [u8; KEY_LEN] = raw_key.try_into().map_err(|_| {
        UserError::new("sync.cryptoInvalidMeta", "The unwrapped sync key length is invalid.")
    })?;
    let key = DataKey(key_bytes);
    if key.key_check() != meta.key_check {
        return Err(UserError::new(
            "sync.badPassphrase",
            "The sync passphrase or recovery key is incorrect.",
        ));
    }
    Ok(key)
}

fn file_aad(path: &str, schema_version: u32) -> String {
    format!("fuyu-sync:v1:{schema_version}:{path}")
}

pub(crate) fn seal_bytes(
    key: &DataKey,
    path: &str,
    schema_version: u32,
    plaintext: &[u8],
) -> Result<Vec<u8>, String> {
    let mut nonce_bytes = [0u8; NONCE_LEN];
    getrandom::fill(&mut nonce_bytes)
        .map_err(|error| format!("Could not generate sync file nonce: {error}"))?;
    let aad = file_aad(path, schema_version);
    let cipher = XChaCha20Poly1305::new((&key.0).into());
    let ciphertext = cipher
        .encrypt(
            XNonce::from_slice(&nonce_bytes),
            Payload { msg: plaintext, aad: aad.as_bytes() },
        )
        .map_err(|_| format!("Could not encrypt {path}."))?;
    let envelope = EncryptedEnvelope {
        fuyu_encrypted: ENCRYPTION_VERSION,
        schema_version,
        nonce: BASE64.encode(nonce_bytes),
        ciphertext: BASE64.encode(ciphertext),
    };
    let mut out = serde_json::to_vec(&envelope)
        .map_err(|error| format!("Could not serialize encrypted envelope for {path}: {error}"))?;
    out.push(b'\n');
    Ok(out)
}

pub(crate) fn open_bytes(key: &DataKey, path: &str, bytes: &[u8]) -> Result<Vec<u8>, String> {
    let stripped = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    let envelope: EncryptedEnvelope = serde_json::from_slice(stripped)
        .map_err(|error| format!("{path} is not a valid encrypted sync file: {error}"))?;
    if envelope.fuyu_encrypted != ENCRYPTION_VERSION {
        return Err(format!("{path} uses unsupported encryption version {}.", envelope.fuyu_encrypted));
    }
    let nonce = BASE64
        .decode(&envelope.nonce)
        .map_err(|_| format!("{path} has an invalid nonce."))?;
    if nonce.len() != NONCE_LEN {
        return Err(format!("{path} has an unexpected nonce length."));
    }
    let ciphertext = BASE64
        .decode(&envelope.ciphertext)
        .map_err(|_| format!("{path} has invalid ciphertext encoding."))?;
    let aad = file_aad(path, envelope.schema_version);
    let cipher = XChaCha20Poly1305::new((&key.0).into());
    cipher
        .decrypt(
            XNonce::from_slice(&nonce),
            Payload { msg: &ciphertext, aad: aad.as_bytes() },
        )
        .map_err(|_| format!("{path} failed authentication or could not be decrypted."))
}
