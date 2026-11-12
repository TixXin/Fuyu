use base64::{engine::general_purpose::STANDARD, Engine};
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const DOMAIN: &str = "focusd-plugin-package/1";
const KEY_DOMAIN: &str = "focusd-plugin-key/1";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorKey {
    pub(super) key_id: String,
    pub(super) public_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) endorsed_by: Option<AuthorSignature>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorSignature {
    pub(super) key_id: String,
    pub(super) signature: String,
}

pub(super) fn signed_text(id: &str, version: &str, sha256: &str) -> String {
    format!("{DOMAIN}\n{id}\n{version}\n{}", sha256.to_ascii_lowercase())
}

pub(super) fn endorsement_text(id: &str, key: &AuthorKey) -> String {
    format!("{KEY_DOMAIN}\n{id}\n{}\n{}", key.key_id, key.public_key)
}

fn key_id_of(raw: &[u8]) -> String {
    Sha256::digest(raw).iter().take(8).map(|byte| format!("{byte:02x}")).collect()
}

fn verifies(keys: &[AuthorKey], signature: &AuthorSignature, text: &str) -> bool {
    let Some(key) = keys.iter().find(|key| key.key_id == signature.key_id) else { return false };
    let Some(raw) = STANDARD.decode(&key.public_key).ok().and_then(|bytes| <[u8; 32]>::try_from(bytes).ok()) else {
        return false;
    };
    if key_id_of(&raw) != key.key_id {
        return false;
    }
    let Ok(verifying_key) = VerifyingKey::from_bytes(&raw) else { return false };
    let Some(bytes) = STANDARD.decode(&signature.signature).ok().and_then(|bytes| <[u8; 64]>::try_from(bytes).ok()) else {
        return false;
    };
    verifying_key.verify_strict(text.as_bytes(), &Signature::from_bytes(&bytes)).is_ok()
}

pub(super) fn signer(
    id: &str,
    version: &str,
    sha256: &str,
    signature: Option<&AuthorSignature>,
    keys: &[AuthorKey],
) -> Result<Option<String>, String> {
    let Some(signature) = signature else { return Ok(None) };
    if verifies(keys, signature, &signed_text(id, version, sha256)) {
        Ok(Some(signature.key_id.clone()))
    } else {
        Err(format!("The author signature of {id} {version} does not match, so it was not installed."))
    }
}

pub(super) fn endorsed_keys(id: &str, remembered: &[String], keys: &[AuthorKey]) -> Vec<String> {
    let mut trusted = remembered.to_vec();
    loop {
        let next = keys.iter().find(|key| {
            !trusted.contains(&key.key_id)
                && key.endorsed_by.as_ref().is_some_and(|endorsement| {
                    trusted.contains(&endorsement.key_id) && verifies(keys, endorsement, &endorsement_text(id, key))
                })
        });
        match next {
            Some(key) => trusted.push(key.key_id.clone()),
            None => return trusted,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum KeyCheck {
    Unsigned,
    FirstKey,
    SameKey,
    Changed,
}

impl KeyCheck {
    pub(super) fn may_install_by_itself(self) -> bool {
        matches!(self, Self::FirstKey | Self::SameKey)
    }
}

pub(super) fn check_key(trusted: &[String], signer: Option<&str>) -> KeyCheck {
    match signer {
        Some(key) if trusted.iter().any(|known| known == key) => KeyCheck::SameKey,
        _ if !trusted.is_empty() => KeyCheck::Changed,
        Some(_) => KeyCheck::FirstKey,
        None => KeyCheck::Unsigned,
    }
}

#[cfg(test)]
mod tests;
