use std::{collections::BTreeSet, path::Path};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use super::builtins::{write_config, write_switch};

const V2_STATE: &str = "plugins.json";
const MARKER: &str = "v2-migrated.json";
const MARKER_FORMAT: u32 = 1;

#[derive(Debug, Default, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Grant {
    #[serde(default)]
    pub(crate) enabled: bool,
    #[serde(default)]
    pub(crate) settings: Map<String, Value>,
    #[serde(default)]
    pub(crate) keybindings: Map<String, Value>,
}

pub(crate) struct Migration {
    pub(crate) v2: &'static str,
    pub(crate) v3: &'static str,
    pub(crate) config: fn(&Grant) -> Vec<(&'static str, Value)>,
    pub(crate) off_without_grant: bool,
}

fn timer_config(grant: &Grant) -> Vec<(&'static str, Value)> {
    let mut config = Vec::new();
    if let Some(sound) = grant.settings.get("sound").filter(|value| value.is_boolean()) {
        config.push(("sound", sound.clone()));
    }
    if let Some(shortcut) = grant.keybindings.get("new").filter(|value| value.is_string()) {
        config.push(("shortcut", shortcut.clone()));
    }
    config
}

const CLAUDE_USAGE_SWITCHES: [&str; 5] = ["claudeCode", "codex", "glm", "kimi", "askAnthropic"];
const CLAUDE_USAGE_TEXTS: [&str; 2] = ["show", "proxy"];

fn claude_usage_config(grant: &Grant) -> Vec<(&'static str, Value)> {
    let settings = &grant.settings;
    let switches = CLAUDE_USAGE_SWITCHES.into_iter().filter_map(|key| settings.get(key).filter(|value| value.is_boolean()).map(|value| (key, value.clone())));
    let texts = CLAUDE_USAGE_TEXTS.into_iter().filter_map(|key| settings.get(key).filter(|value| value.is_string()).map(|value| (key, value.clone())));
    let interval = settings.get("intervalMinutes").filter(|value| value.is_number()).map(|value| ("intervalMinutes", value.clone()));
    switches.chain(texts).chain(interval).collect()
}

fn cc_connect_config(grant: &Grant) -> Vec<(&'static str, Value)> {
    let settings = &grant.settings;
    let path = settings.get("path").filter(|value| value.as_str().is_some_and(|path| !path.trim().is_empty())).map(|value| ("path", value.clone()));
    let run = settings.get("run").filter(|value| value.is_boolean()).map(|value| ("run", value.clone()));
    path.into_iter().chain(run).collect()
}

fn session_ring_config(grant: &Grant) -> Vec<(&'static str, Value)> {
    let settings = &grant.settings;
    let style = settings.get("style").filter(|value| value.is_string()).map(|value| ("style", value.clone()));
    let count = settings.get("showCount").filter(|value| value.is_boolean()).map(|value| ("showCount", value.clone()));
    style.into_iter().chain(count).collect()
}

fn local_api_config(grant: &Grant) -> Vec<(&'static str, Value)> {
    grant.settings.get("allowWrite").filter(|value| value.is_boolean()).map(|value| ("allowWrite", value.clone())).into_iter().collect()
}

fn ssh_tunnel_config(grant: &Grant) -> Vec<(&'static str, Value)> {
    let settings = &grant.settings;
    let proxy = settings.get("localProxy").filter(|value| value.is_string()).map(|value| ("localProxy", value.clone()));
    let port = settings.get("customPort").filter(|value| value.is_number()).map(|value| ("customPort", value.clone()));
    proxy.into_iter().chain(port).collect()
}

fn center_pattern_config(grant: &Grant) -> Vec<(&'static str, Value)> {
    let settings = &grant.settings;
    let pattern = settings.get("pattern").filter(|value| value.is_string()).map(|value| ("pattern", value.clone()));
    let pet = settings.get("pet").filter(|value| value.is_string()).map(|value| ("pet", value.clone()));
    let size = settings.get("size").filter(|value| value.is_number()).map(|value| ("size", value.clone()));
    pattern.into_iter().chain(pet).chain(size).collect()
}

const LOCAL_API_V2: &str = "focusd.local-api";
const LOCAL_API_FILE: &str = "local-api.json";

pub(crate) fn with_old_local_api(mut grants: Map<String, Value>, local_api: Option<&str>) -> Map<String, Value> {
    if grants.contains_key(LOCAL_API_V2) {
        return grants;
    }
    let Some(old) = local_api.and_then(|text| serde_json::from_str::<Value>(text).ok()) else { return grants };
    let enabled = old.get("enabled").and_then(Value::as_bool).unwrap_or(false);
    let allow_write = old.get("allowWrite").and_then(Value::as_bool).unwrap_or(false);
    if enabled || allow_write {
        grants.insert(LOCAL_API_V2.to_owned(), serde_json::json!({ "enabled": enabled, "settings": { "allowWrite": allow_write } }));
    }
    grants
}

pub(crate) const MIGRATIONS: &[Migration] = &[
    Migration { v2: "focusd.timer", v3: "timer", config: timer_config, off_without_grant: false },
    Migration { v2: "focusd.claude-usage", v3: "claude-usage", config: claude_usage_config, off_without_grant: true },
    Migration { v2: "focusd.cc-connect", v3: "cc-connect", config: cc_connect_config, off_without_grant: true },
    Migration { v2: "focusd.session-ring", v3: "session-ring", config: session_ring_config, off_without_grant: true },
    Migration { v2: LOCAL_API_V2, v3: "local-api", config: local_api_config, off_without_grant: true },
    Migration { v2: "focusd.ssh-proxy-tunnel", v3: "ssh-tunnel", config: ssh_tunnel_config, off_without_grant: true },
    Migration { v2: "focusd.center-pattern", v3: "center-pattern", config: center_pattern_config, off_without_grant: true },
];

#[derive(Debug, Default, Serialize, Deserialize)]
struct Marker {
    format: u32,
    #[serde(default)]
    migrated: BTreeSet<String>,
}

pub(crate) fn grants(text: &str) -> Map<String, Value> {
    serde_json::from_str::<Value>(text)
        .ok()
        .and_then(|state| state.get("plugins").and_then(Value::as_object).cloned())
        .unwrap_or_default()
}

#[derive(Debug, PartialEq)]
pub(crate) struct Plan {
    pub(crate) id: &'static str,
    pub(crate) disable: bool,
    pub(crate) config: Vec<(&'static str, Value)>,
}

pub(crate) fn plan(migration: &Migration, grants: &Map<String, Value>) -> Option<Plan> {
    let Some(grant) = grants.get(migration.v2) else {
        return migration.off_without_grant.then(|| Plan { id: migration.v3, disable: true, config: Vec::new() });
    };
    let grant: Grant = serde_json::from_value(grant.clone()).ok()?;
    Some(Plan { id: migration.v3, disable: !grant.enabled, config: (migration.config)(&grant) })
}

fn read_marker(file: &Path) -> Marker {
    std::fs::read_to_string(file).ok().and_then(|text| serde_json::from_str::<Marker>(&text).ok()).filter(|marker| marker.format == MARKER_FORMAT).unwrap_or(Marker { format: MARKER_FORMAT, migrated: BTreeSet::new() })
}

fn apply(plan: &Plan, plugins_file: &Path) -> Result<(), String> {
    if plan.disable {
        write_switch(plugins_file, plan.id, false).map_err(|error| error.to_string())?;
    }
    for (key, value) in &plan.config {
        write_config(plugins_file, plan.id, key, Some(value)).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub(crate) fn migrate(home: &Path, plugins_file: &Path) {
    let Some(dir) = plugins_file.parent() else { return };
    let marker_file = dir.join(MARKER);
    let mut marker = read_marker(&marker_file);
    let pending: Vec<&Migration> = MIGRATIONS.iter().filter(|migration| !marker.migrated.contains(migration.v2)).collect();
    if pending.is_empty() {
        return;
    }
    let state = home.join(V2_STATE);
    let grants = match std::fs::read_to_string(&state) {
        Ok(text) => grants(&text),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Map::new(),
        Err(error) => {
            eprintln!("[plugins-v3] could not read {}, so the old built-in plugins are carried over next time: {error}", state.display());
            return;
        }
    };
    let grants = with_old_local_api(grants, std::fs::read_to_string(home.join(LOCAL_API_FILE)).ok().as_deref());
    for migration in pending {
        if let Some(plan) = plan(migration, &grants) {
            if let Err(error) = apply(&plan, plugins_file) {
                eprintln!("[plugins-v3] could not carry {} over from the old plugin settings: {error}", migration.v2);
                continue;
            }
        }
        marker.migrated.insert(migration.v2.to_owned());
    }
    let saved = serde_json::to_vec_pretty(&marker).map_err(|error| error.to_string()).and_then(|bytes| {
        std::fs::create_dir_all(dir).map_err(|error| error.to_string())?;
        crate::fs_write::replace_file(&marker_file, &bytes).map_err(|error| error.to_string())
    });
    if let Err(error) = saved {
        eprintln!("[plugins-v3] could not note which old built-in plugins were carried over in {}: {error}", marker_file.display());
    }
}

#[cfg(test)]
#[path = "v2_builtins_tests.rs"]
mod tests;
