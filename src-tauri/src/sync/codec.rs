use serde::Serialize;
use serde_json::Value;

pub(crate) fn encode(_path: &str, value: &impl Serialize) -> Result<Vec<u8>, String> {
    let mut bytes = serde_json::to_vec_pretty(value).map_err(|error| format!("Could not encode sync data: {error}"))?;
    bytes.push(b'\n');
    Ok(bytes)
}

pub(crate) fn decode(path: &str, bytes: &[u8]) -> Result<Value, String> {
    let bytes = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    serde_json::from_slice(bytes).map_err(|error| format!("{path} is not readable: {error}"))
}
