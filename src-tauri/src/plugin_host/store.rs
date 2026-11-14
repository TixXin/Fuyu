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
    #[serde(default, skip_serializing_if = "WindowRules::is_default")]
    pub window_rules: WindowRules,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowRules {
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub no_topmost: bool,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub no_click_through: bool,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub hidden: bool,
}

impl WindowRules {
    fn is_default(&self) -> bool {
        *self == Self::default()
    }
}

pub(super) struct LoadedState {
    pub(super) state: PluginsState,
    pub(super) backup: Option<std::path::PathBuf>,
}

pub(super) fn broken_backup_path(path: &Path, now: chrono::DateTime<chrono::Local>) -> std::path::PathBuf {
    let stem = path.file_stem().and_then(|stem| stem.to_str()).unwrap_or("plugins");
    let base = format!("{stem}.broken-{}", now.format("%Y%m%d-%H%M%S"));
    let mut candidate = path.with_file_name(format!("{base}.json"));
    let mut next = 2;
    while candidate.exists() {
        candidate = path.with_file_name(format!("{base}-{next}.json"));
        next += 1;
    }
    candidate
}

pub(super) fn load_state(path: &Path) -> LoadedState {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return LoadedState { state: PluginsState::default(), backup: None },
        Err(error) => {
            eprintln!("could not read {}: {error}", path.display());
            return LoadedState { state: PluginsState::default(), backup: None };
        }
    };
    match serde_json::from_slice(&bytes) {
        Ok(state) => LoadedState { state, backup: None },
        Err(error) => {
            let backup = broken_backup_path(path, chrono::Local::now());
            eprintln!("{} could not be read ({error}); keeping it as {}", path.display(), backup.display());
            let kept = fs::write(&backup, &bytes).inspect_err(|error| eprintln!("could not back up {}: {error}", path.display()));
            LoadedState { state: PluginsState::default(), backup: kept.ok().map(|()| backup) }
        }
    }
}

pub(super) fn save_state(path: &Path, state: &PluginsState) -> Result<(), String> {
    let text = serde_json::to_string_pretty(state).map_err(|error| error.to_string())?;
    crate::fs_write::replace_file(path, text.as_bytes()).map_err(|error| format!("Could not write {}: {error}", path.display()))
}
