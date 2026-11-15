use std::{
    fs,
    path::{Path, PathBuf},
};

use serde_json::{json, Map, Value};

use super::claude_hooks::{command_hook_entry, turn_hook_entries, APPROVAL_HOOK_TIMEOUT_SECONDS};
use super::codex_hooks::agent_status_command;
use super::harness::HookEnv;
use super::hooks_state::{hook_entries_state, HookInstallState};
use super::{dsh, write_text_file, AGENT_APPROVAL_SCRIPT_FILE_NAME};

pub(super) const HOOKS_FILE_NAME: &str = "fuyu-dsh-hooks.json";
const BRIDGE_PACKAGE: &str = "dsh-hooks-claude-code";
const PROFILE_FILES: [&str; 2] = ["cordis.patch.yml", "cordis.yml"];
const APPROVED_TOOLS: &str = "^(shell|exec|bash|run_command|run_code)$";

fn hooks_file(env: &HookEnv) -> PathBuf {
    env.status_script.with_file_name(HOOKS_FILE_NAME)
}

fn installed_homes(home_dir: &Path) -> Vec<PathBuf> {
    let from_env = std::env::var_os("DSH_HOME").map(PathBuf::from).filter(|home| home.is_absolute());
    let mut homes: Vec<PathBuf> = Vec::new();
    for home in from_env.into_iter().chain([home_dir.join(".dsh"), home_dir.join(".dsh-beta")]) {
        if home.is_dir() && !homes.contains(&home) {
            homes.push(home);
        }
    }
    homes
}

pub(super) fn hook_entries(env: &HookEnv) -> Vec<(&'static str, Value)> {
    let approval_script = env.status_script.with_file_name(AGENT_APPROVAL_SCRIPT_FILE_NAME);
    let mut entries = turn_hook_entries(env.running_script, env.status_script, dsh::PROVIDER);
    let mut approval =
        command_hook_entry(agent_status_command(&approval_script, dsh::PROVIDER, "permission"), APPROVAL_HOOK_TIMEOUT_SECONDS);
    if let Value::Object(object) = &mut approval {
        object.insert("matcher".to_string(), Value::String(APPROVED_TOOLS.to_string()));
    }
    entries.push(("PreToolUse", approval));
    entries
}

fn hooks_config(env: &HookEnv) -> Value {
    let mut hooks = Map::new();
    for (event_name, entry) in hook_entries(env) {
        if let Value::Array(list) = hooks.entry(event_name).or_insert_with(|| json!([])) {
            list.push(entry);
        }
    }
    json!({ "hooks": hooks })
}

fn profile_files(dsh_home: &Path) -> Vec<PathBuf> {
    fs::read_dir(dsh_home.join("profiles"))
        .into_iter()
        .flatten()
        .flatten()
        .flat_map(|profile| PROFILE_FILES.map(|name| profile.path().join(name)))
        .filter(|path| path.is_file())
        .collect()
}

fn bridge_mounted(homes: &[PathBuf]) -> bool {
    homes.iter().flat_map(|home| profile_files(home)).any(|path| {
        fs::read_to_string(path).is_ok_and(|text| text.contains(BRIDGE_PACKAGE) && text.contains(HOOKS_FILE_NAME))
    })
}

pub(super) fn hooks_state(env: &HookEnv) -> HookInstallState {
    let homes = installed_homes(env.home_dir);
    if homes.is_empty() {
        return HookInstallState::Absent;
    }
    let Some(config) = fs::read_to_string(hooks_file(env))
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
    else {
        return HookInstallState::NotInstalled;
    };
    if !bridge_mounted(&homes) {
        return HookInstallState::NotInstalled;
    }
    hook_entries_state(&config["hooks"], &hook_entries(env))
}

pub(super) fn install_hooks(env: &HookEnv) -> Result<(), String> {
    if installed_homes(env.home_dir).is_empty() {
        return Ok(());
    }
    let content = serde_json::to_string_pretty(&hooks_config(env))
        .map_err(|error| format!("Failed to serialize the DeepSeek Harness hooks: {error}"))?;
    write_text_file(&hooks_file(env), &content)
}

pub(super) fn bridge_lines(env: &HookEnv) -> Option<String> {
    let homes = installed_homes(env.home_dir);
    if homes.is_empty() || bridge_mounted(&homes) {
        return None;
    }
    let path = serde_json::to_string(&hooks_file(env).to_string_lossy()).ok()?;
    Some(format!(
        "- id: fuyu-hooks\n  name: \"@deepseek-ai/{BRIDGE_PACKAGE}\"\n  config:\n    configPath: {path}\n"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn home(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fuyu-dsh-hooks-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn writes_its_own_hook_file_and_waits_for_the_bridge() {
        let home = home("bridge");
        let running = home.join(".fuyu").join(crate::agent_status::AGENT_RUNNING_SCRIPT_FILE_NAME);
        let status = home.join(".fuyu").join(crate::agent_status::AGENT_STATUS_SCRIPT_FILE_NAME);
        let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
        install_hooks(&env).unwrap();
        assert!(!hooks_file(&env).exists());
        assert_eq!(hooks_state(&env), HookInstallState::Absent);
        assert_eq!(bridge_lines(&env), None);

        let profile = home.join(".dsh").join("profiles").join("desktop");
        fs::create_dir_all(&profile).unwrap();
        fs::write(profile.join("cordis.patch.yml"), "- { id: computer-use, disabled: false }\n").unwrap();
        install_hooks(&env).unwrap();
        let config: Value = serde_json::from_str(&fs::read_to_string(hooks_file(&env)).unwrap()).unwrap();
        let command = |event: &str, index: usize| config["hooks"][event][index]["hooks"][0]["command"].as_str().unwrap().to_string();
        assert!(command("UserPromptSubmit", 0).contains("fuyu-agent-running") && command("UserPromptSubmit", 0).contains("dsh"));
        assert!(command("Stop", 0).contains("dsh completed"));
        assert!(command("PreToolUse", 1).contains("fuyu-agent-approval") && command("PreToolUse", 1).contains("dsh permission"));
        assert_eq!(config["hooks"]["PreToolUse"][1]["matcher"], APPROVED_TOOLS);
        assert!(config["hooks"]["PreToolUse"][0]["hooks"][0].get("args").is_none());
        assert_eq!(hooks_state(&env), HookInstallState::NotInstalled);

        let lines = bridge_lines(&env).unwrap();
        assert!(lines.contains("\"@deepseek-ai/dsh-hooks-claude-code\""));
        assert!(lines.contains(HOOKS_FILE_NAME));
        let patch = profile.join("cordis.patch.yml");
        fs::write(&patch, format!("{}{lines}", fs::read_to_string(&patch).unwrap())).unwrap();
        assert_eq!(bridge_lines(&env), None);
        assert_eq!(hooks_state(&env), HookInstallState::Current);

        fs::write(hooks_file(&env), r#"{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"x fuyu-agent-status"}]}]}}"#).unwrap();
        assert_eq!(hooks_state(&env), HookInstallState::Outdated);
        fs::remove_dir_all(&home).unwrap();
    }
}
