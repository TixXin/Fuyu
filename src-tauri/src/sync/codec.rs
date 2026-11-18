use serde::Serialize;
use serde_json::Value;

use super::crypto::{open_bytes, seal_bytes, DataKey};

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) enum Cipher {
    #[default]
    Plain,
    Encrypted(DataKey),
}

pub(crate) fn encode_plain(_path: &str, value: &impl Serialize) -> Result<Vec<u8>, String> {
    let mut bytes = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("Could not encode sync data: {error}"))?;
    bytes.push(b'\n');
    Ok(bytes)
}

pub(crate) fn decode_plain(path: &str, bytes: &[u8]) -> Result<Value, String> {
    let bytes = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    serde_json::from_slice(bytes).map_err(|error| format!("{path} is not readable: {error}"))
}

pub(crate) fn encode(
    path: &str,
    schema_version: u32,
    value: &impl Serialize,
    cipher: &Cipher,
) -> Result<Vec<u8>, String> {
    let plain = encode_plain(path, value)?;
    match cipher {
        Cipher::Plain => Ok(plain),
        Cipher::Encrypted(key) => seal_bytes(key, path, schema_version, &plain),
    }
}

pub(crate) fn decode(path: &str, bytes: &[u8], cipher: &Cipher) -> Result<Value, String> {
    match cipher {
        Cipher::Plain => {
            let value = decode_plain(path, bytes)?;
            if value.get("fuyuEncrypted").is_some() {
                return Err(format!(
                    "{path} is encrypted, while sync is reading in cleartext mode."
                ));
            }
            Ok(value)
        }
        Cipher::Encrypted(key) => {
            let plain = open_bytes(key, path, bytes)?;
            decode_plain(path, &plain)
        }
    }
}

pub(crate) fn peek_schema_version(bytes: &[u8]) -> Option<u64> {
    let stripped = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    serde_json::from_slice::<Value>(stripped)
        .ok()
        .and_then(|value| value.get("schemaVersion").and_then(Value::as_u64))
}
