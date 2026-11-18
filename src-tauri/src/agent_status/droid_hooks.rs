use std::{fs, path::Path};

use serde_json::{json, Value};

use super::claude_compat;
use super::claude_hooks::{install_claude_code_hook_events, uninstall_nested_json_hooks};
use super::droid::{home, SPEC};
use super::harness::HookEnv;
use super::hooks_state::{hook_entries_state, HookInstallState};
use super::write_text_file;

const HOOKS_FILE: &str = "hooks.json";
const SETTINGS_FILE: &str = "settings.json";

pub(super) fn hook_entries(env: &HookEnv) -> Vec<(&'static str, Value)> {
    claude_compat::hook_entries(&SPEC, env)
        .into_iter()
        .filter(|(event, _)| *event != "StopFailure")
        .collect()
}

pub(super) fn install(env: &HookEnv) -> Result<(), String> {
    let dir = home(env.home_dir);
    if !dir.is_dir() {
        return Ok(());
    }
    install_into(&dir, hook_entries(env))
}

pub(super) fn install_into(dir: &Path, entries: Vec<(&'static str, Value)>) -> Result<(), String> {
    let (path, nested) = target(dir);
    let mut config = match fs::read_to_string(&path) {
        Ok(content) if !content.trim().is_empty() => serde_json::from_str::<Value>(&content)
            .map_err(|error| format!("Failed to parse Droid {}: {error}", file_name(&path)))?,
        Ok(_) => json!({}),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => json!({}),
        Err(error) => return Err(format!("Failed to read Droid {}: {error}", file_name(&path))),
    };
    let root = config
        .as_object_mut()
        .ok_or_else(|| format!("Droid {} must contain a JSON object.", file_name(&path)))?;
    let hooks = if nested {
        let hooks = root.entry("hooks").or_insert_with(|| json!({}));
        if !hooks.is_object() {
            *hooks = json!({});
        }
        hooks.as_object_mut().ok_or_else(|| "Failed to prepare the Droid hooks object.".to_string())?
    } else {
        root
    };
    install_claude_code_hook_events(hooks, entries);
    let content = serde_json::to_string_pretty(&config).map_err(|error| format!("Failed to serialize Droid hooks: {error}"))?;
    write_text_file(&path, &content)
}

pub(super) fn uninstall(env: &HookEnv) -> Result<(), String> {
    uninstall_from(&home(env.home_dir))
}

pub(super) fn uninstall_from(dir: &Path) -> Result<(), String> {
    uninstall_nested_json_hooks(&dir.join(SETTINGS_FILE), "Droid", SETTINGS_FILE)?;
    let hooks_path = dir.join(HOOKS_FILE);
    let content = match fs::read_to_string(&hooks_path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Failed to read Droid {HOOKS_FILE}: {error}")),
    };
    let trimmed = content.trim_start_matches('\u{feff}').trim();
    if trimmed.is_empty() {
        return Ok(());
    }
    let original: Value = serde_json::from_str(trimmed)
        .map_err(|error| format!("Failed to parse Droid {HOOKS_FILE}: {error}"))?;
    let mut config = original.clone();
    let root = config
        .as_object_mut()
        .ok_or_else(|| format!("Droid {HOOKS_FILE} must contain a JSON object."))?;
    install_claude_code_hook_events(root, Vec::new());
    if config == original {
        return Ok(());
    }
    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Failed to serialize Droid {HOOKS_FILE}: {error}"))?;
    write_text_file(&hooks_path, &serialized)
}

pub(super) fn check(env: &HookEnv) -> HookInstallState {
    let dir = home(env.home_dir);
    if !dir.is_dir() {
        return HookInstallState::Absent;
    }
    state_in(&dir, &hook_entries(env))
}

pub(super) fn state_in(dir: &Path, entries: &[(&'static str, Value)]) -> HookInstallState {
    let (path, nested) = target(dir);
    let Some(config) = fs::read_to_string(path).ok().and_then(|content| serde_json::from_str::<Value>(&content).ok()) else {
        return HookInstallState::NotInstalled;
    };
    hook_entries_state(if nested { &config["hooks"] } else { &config }, entries)
}

fn target(dir: &Path) -> (std::path::PathBuf, bool) {
    let hooks = dir.join(HOOKS_FILE);
    if hooks.exists() {
        (hooks, false)
    } else {
        (dir.join(SETTINGS_FILE), true)
    }
}

fn file_name(path: &Path) -> String {
    path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default()
}
