use std::{
    fs,
    path::{Path, PathBuf},
};

use serde_json::{json, Map, Value};

use super::claude_hooks::{command_hook_entry, install_claude_code_hook_events, turn_hook_entries, APPROVAL_HOOK_TIMEOUT_SECONDS};
use super::codex_hooks::{agent_running_command_with, agent_status_command};
use super::harness::{Harness, HookEnv, Hooks, StatusLight};
use super::hooks_state::{hook_entries_state, HookInstallState};
use super::markers::AGENT_RUNNING_STALE_AFTER_MS;
use super::opencode;
use super::sessions::{session_phase, AgentSessionSummary};
use super::{write_text_file, AGENT_APPROVAL_SCRIPT_FILE_NAME, AGENT_RUNNING_NOTIFICATION_ARG};

pub(super) const PROVIDER: &str = "zcode";
const LABEL: &str = "ZCode";
const HOME: &str = ".zcode";
const DB_ENV: &str = "ZCODE_SESSION_DB_PATH";

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks { install: install_hooks, check: hooks_state, uninstall: uninstall_hooks }),
    status_light: Some(StatusLight {
        running_marker: "agent-zcode-running.flag",
        running_hold: "agent-zcode-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: Some(|roots, now, window_ms| match roots.local_app_dir {
        Some(_) => sessions(&database_path(roots.home_dir, |name| std::env::var_os(name)), now, window_ms),
        None => Vec::new(),
    }),
    remote: None,
};

pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
    vec![home_dir.join(HOME).join("AGENTS.md")]
}

fn lives_here(home_dir: &Path) -> bool {
    home_dir.join(HOME).is_dir()
}

fn config_path(home_dir: &Path) -> PathBuf {
    home_dir.join(HOME).join("cli").join("config.json")
}

fn database_path(home_dir: &Path, env: impl Fn(&str) -> Option<std::ffi::OsString>) -> PathBuf {
    env(DB_ENV)
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .unwrap_or_else(|| home_dir.join(HOME).join("cli").join("db").join("db.sqlite"))
}

pub(super) fn hook_entries(env: &HookEnv) -> Vec<(&'static str, Value)> {
    let approval_script = env.status_script.with_file_name(AGENT_APPROVAL_SCRIPT_FILE_NAME);
    let mut entries = turn_hook_entries(env.running_script, env.status_script, PROVIDER);
    entries.push((
        "PermissionRequest",
        command_hook_entry(agent_running_command_with(env.running_script, PROVIDER, AGENT_RUNNING_NOTIFICATION_ARG), 5),
    ));
    entries.push((
        "PermissionRequest",
        command_hook_entry(agent_status_command(&approval_script, PROVIDER, "permission"), APPROVAL_HOOK_TIMEOUT_SECONDS),
    ));
    entries
}

fn read_config(path: &Path) -> Option<Value> {
    serde_json::from_str(fs::read_to_string(path).ok()?.trim_start_matches('\u{feff}')).ok()
}

fn hooks_state(env: &HookEnv) -> HookInstallState {
    if !lives_here(env.home_dir) {
        return HookInstallState::Absent;
    }
    let Some(config) = read_config(&config_path(env.home_dir)) else {
        return HookInstallState::NotInstalled;
    };
    match hook_entries_state(&config["hooks"]["events"], &hook_entries(env)) {
        HookInstallState::Current if config["hooks"]["enabled"] != Value::Bool(true) => HookInstallState::Outdated,
        state => state,
    }
}

fn install_hooks(env: &HookEnv) -> Result<(), String> {
    if !lives_here(env.home_dir) {
        return Ok(());
    }
    let path = config_path(env.home_dir);
    let mut config = match fs::read_to_string(&path) {
        Ok(content) if !content.trim().is_empty() => serde_json::from_str::<Value>(content.trim_start_matches('\u{feff}'))
            .map_err(|error| format!("Failed to parse {LABEL} config.json: {error}"))?,
        _ => json!({}),
    };
    let root = config
        .as_object_mut()
        .ok_or_else(|| format!("{LABEL} config.json must contain a JSON object."))?;
    let unprepared = || format!("Failed to prepare {LABEL} hooks object.");
    let hooks = object_entry(root, "hooks").ok_or_else(unprepared)?;
    hooks.insert("enabled".to_string(), Value::Bool(true));
    let events = object_entry(hooks, "events").ok_or_else(unprepared)?;
    install_claude_code_hook_events(events, hook_entries(env));
    let content =
        serde_json::to_string_pretty(&config).map_err(|error| format!("Failed to serialize {LABEL} config.json: {error}"))?;
    write_text_file(&path, &content)
}

pub(super) fn uninstall_hooks(env: &HookEnv) -> Result<(), String> {
    let path = config_path(env.home_dir);
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Failed to read {LABEL} config.json: {error}")),
    };
    let trimmed = content.trim_start_matches('\u{feff}').trim();
    if trimmed.is_empty() {
        return Ok(());
    }
    let original: Value = serde_json::from_str(trimmed)
        .map_err(|error| format!("Failed to parse {LABEL} config.json: {error}"))?;
    let mut config = original.clone();
    let root = config
        .as_object_mut()
        .ok_or_else(|| format!("{LABEL} config.json must contain a JSON object."))?;
    if let Some(Value::Object(hooks)) = root.get_mut("hooks") {
        if let Some(Value::Object(events)) = hooks.get_mut("events") {
            install_claude_code_hook_events(events, Vec::new());
        }
    }
    if Some(&*root) == original.as_object() {
        return Ok(());
    }
    if let Some(Value::Object(hooks)) = root.get_mut("hooks") {
        if hooks.get("events").and_then(Value::as_object).is_some_and(Map::is_empty) {
            hooks.remove("events");
            if hooks.is_empty() || (hooks.len() == 1 && hooks.contains_key("enabled")) {
                root.remove("hooks");
            }
        }
    }
    let serialized =
        serde_json::to_string_pretty(&config).map_err(|error| format!("Failed to serialize {LABEL} config.json: {error}"))?;
    write_text_file(&path, &serialized)
}

fn object_entry<'a>(parent: &'a mut Map<String, Value>, key: &str) -> Option<&'a mut Map<String, Value>> {
    let value = parent.entry(key).or_insert_with(|| json!({}));
    if !value.is_object() {
        *value = json!({});
    }
    value.as_object_mut()
}

fn sessions(db: &Path, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    opencode::cached_rows(db, now - window_ms)
        .into_iter()
        .map(|row| {
            let mut summary = row.summary;
            summary.provider = PROVIDER;
            summary.phase = session_phase(row.state, now - summary.updated_at, AGENT_RUNNING_STALE_AFTER_MS);
            summary
        })
        .collect()
}

#[cfg(test)]
#[path = "zcode_tests.rs"]
mod tests;
