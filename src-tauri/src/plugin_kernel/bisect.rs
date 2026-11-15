use std::{
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use plugin_base::RpcError;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub(super) const FILE: &str = "bisect.json";
pub(super) const METHOD: &str = "bisect";
const VERSION: u32 = 1;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Bisect {
    pub(crate) suspects: Vec<String>,
    pub(crate) off: Vec<String>,
    pub(crate) step: u32,
    pub(crate) started_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Saved {
    version: u32,
    updated_at: u64,
    #[serde(flatten)]
    bisect: Bisect,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Applied {
    pub(crate) now: bool,
    pub(crate) unknown: Vec<String>,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|since| since.as_millis() as u64).unwrap_or(0)
}

fn usable(bisect: &Bisect) -> bool {
    bisect.off.iter().chain(&bisect.suspects).all(|id| !id.is_empty())
}

pub(crate) fn read(dir: &Path) -> Option<Bisect> {
    let saved: Saved = serde_json::from_slice(&std::fs::read(dir.join(FILE)).ok()?).ok()?;
    (saved.version == VERSION && usable(&saved.bisect)).then_some(saved.bisect)
}

pub(super) fn off(dir: &Path) -> Vec<String> {
    read(dir).map(|bisect| bisect.off).unwrap_or_default()
}

pub(crate) fn write(dir: &Path, bisect: &Bisect) -> Result<(), String> {
    let path = dir.join(FILE);
    let saved = Saved { version: VERSION, updated_at: now_ms(), bisect: bisect.clone() };
    let text = serde_json::to_vec_pretty(&saved).map_err(|error| format!("could not write {}: {error}", path.display()))?;
    crate::fs_write::replace_file(&path, &text).map_err(|error| format!("could not save {}: {error}", path.display()))
}

pub(crate) fn clear(dir: &Path) -> Result<(), String> {
    let path = dir.join(FILE);
    match std::fs::remove_file(&path) {
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(format!("could not remove {}: {error}", path.display())),
        _ => Ok(()),
    }
}

pub(super) fn params(off: &[String]) -> Value {
    serde_json::json!({ "off": off })
}

pub(super) fn apply(dir: &Path, next: Option<&Bisect>, mut send: impl FnMut(Value) -> Result<Option<Value>, RpcError>) -> Result<Applied, String> {
    if next.is_some_and(|bisect| !usable(bisect)) {
        return Err("a plugin id in the bisect is empty".into());
    }
    let off = next.map(|bisect| bisect.off.as_slice()).unwrap_or_default();
    let answer = match send(params(off)) {
        Ok(answer) => answer,
        Err(RpcError::Remote { message, .. }) => return Err(message),
        Err(RpcError::PeerGone(_)) => None,
        Err(error) => return Err(error.to_string()),
    };
    match next {
        Some(bisect) => write(dir, bisect)?,
        None => clear(dir)?,
    }
    let answer = answer.or_else(|| send(params(off)).ok().flatten());
    let unknown = answer.as_ref().and_then(|answer| serde_json::from_value(answer["unknown"].clone()).ok()).unwrap_or_default();
    Ok(Applied { now: answer.is_some(), unknown })
}

#[cfg(test)]
#[path = "bisect_tests.rs"]
mod tests;
