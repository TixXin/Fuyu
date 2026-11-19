use base64::{engine::general_purpose::STANDARD, Engine};

const SAFE_STORAGE_PREFIX: &str = "cursor-safe-storage:v1:";

#[derive(Debug, PartialEq)]
pub(super) enum Stored {
    Plain(String),
    Encrypted(Vec<u8>),
}

pub(super) fn classify(raw: &str) -> Option<Stored> {
    let raw = raw.trim();
    let unquoted = serde_json::from_str::<String>(raw).unwrap_or_else(|_| raw.to_string());
    let value = unquoted.trim();
    if value.is_empty() {
        return None;
    }
    if let Some(encoded) = value.strip_prefix(SAFE_STORAGE_PREFIX) {
        let blob = STANDARD.decode(encoded.trim()).ok()?;
        return (blob.len() > 3 && blob.starts_with(b"v10")).then_some(Stored::Encrypted(blob));
    }
    let mut token = value;
    if let Some((_, rest)) = token.strip_prefix("scoped:v1:").and_then(|scoped| scoped.split_once(':')) {
        token = rest.trim();
    }
    usable(token).then(|| Stored::Plain(token.to_string()))
}

fn usable(token: &str) -> bool {
    !token.is_empty() && token.bytes().all(|byte| (0x21..=0x7e).contains(&byte))
}

pub(super) fn reveal(stored: Stored) -> Option<String> {
    match stored {
        Stored::Plain(token) => Some(token),
        Stored::Encrypted(blob) => decrypt_with_keychain(&blob),
    }
}

#[cfg(target_os = "macos")]
fn decrypt_with_keychain(blob: &[u8]) -> Option<String> {
    ["Cursor Key", "Cursor"].into_iter().find_map(|account| {
        let password = keyring::Entry::new("Cursor Safe Storage", account).ok()?.get_password().ok()?;
        decrypt(blob, &password)
    })
}

#[cfg(not(target_os = "macos"))]
fn decrypt_with_keychain(_blob: &[u8]) -> Option<String> {
    None
}

#[cfg(target_os = "macos")]
pub(super) fn decrypt(blob: &[u8], password: &str) -> Option<String> {
    use cbc::cipher::{block_padding::Pkcs7, BlockModeDecrypt, KeyIvInit};
    let mut payload = blob.strip_prefix(b"v10")?.to_vec();
    if payload.is_empty() || payload.len() % 16 != 0 {
        return None;
    }
    let mut key = [0u8; 16];
    pbkdf2::pbkdf2_hmac::<sha1::Sha1>(password.as_bytes(), b"saltysalt", 1003, &mut key);
    let iv = [b' '; 16];
    let plain = cbc::Decryptor::<aes::Aes128>::new(&key.into(), &iv.into())
        .decrypt_padded::<Pkcs7>(&mut payload)
        .ok()?;
    let token = std::str::from_utf8(plain).ok()?.trim();
    usable(token).then(|| token.to_string())
}
