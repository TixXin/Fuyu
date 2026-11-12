use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, path::Path};

use super::{revocations::Revocation, sensitive::SensitiveChoice};

pub(super) const STATE_FILE_NAME: &str = "plugins.json";

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct PluginsState {
    #[serde(default)]
    pub allow_third_party: bool,
    #[serde(default)]
    pub plugins: BTreeMap<String, PluginGrant>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub revoked: Vec<Revocation>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub trusted_publishers: Vec<String>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub auto_update: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct PluginGrant {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub granted_permissions: Vec<String>,
    #[serde(default, skip_serializing_if = "serde_json::Map::is_empty")]
    pub settings: serde_json::Map<String, serde_json::Value>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub notifications_muted: bool,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub sensitive: BTreeMap<String, SensitiveChoice>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub pre_release: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memory_limit_mb: Option<u32>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub keybindings: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub author_keys: Vec<String>,
}

pub(super) fn load_state(path: &Path) -> PluginsState {
    fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

pub(super) fn save_state(path: &Path, state: &PluginsState) -> Result<(), String> {
    let text = serde_json::to_string_pretty(state).map_err(|error| error.to_string())?;
    let fail = |error: std::io::Error| format!("Could not write {}: {error}", path.display());
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, text).map_err(fail)?;
    fs::rename(&temp, path).map_err(fail)
}
