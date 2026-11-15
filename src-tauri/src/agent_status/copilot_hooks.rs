use std::{fs, path::Path};

use serde_json::{json, Map, Value};

use super::claude_hooks::APPROVAL_HOOK_TIMEOUT_SECONDS;
use super::copilot::{home, PROVIDER};
use super::harness::HookEnv;
use super::hooks_state::HookInstallState;
use super::{write_text_file, AGENT_APPROVAL_SCRIPT_FILE_NAME, AGENT_RUNNING_NOTIFICATION_ARG};

pub(super) const HOOKS_FILE: &str = "hooks/fuyu-island.json";

struct Hook {
    event: &'static str,
    script: Script,
    args: &'static [&'static str],
    timeout: i64,
}

#[derive(Clone, Copy)]
enum Script {
    Running,
    Status,
    Approval,
}

const HOOKS: [Hook; 5] = [
    Hook { event: "UserPromptSubmit", script: Script::Running, args: &[], timeout: 5 },
    Hook { event: "PreToolUse", script: Script::Running, args: &[], timeout: 5 },
    Hook { event: "PermissionRequest", script: Script::Running, args: &[AGENT_RUNNING_NOTIFICATION_ARG], timeout: 5 },
    Hook { event: "PermissionRequest", script: Script::Approval, args: &["permission"], timeout: APPROVAL_HOOK_TIMEOUT_SECONDS },
    Hook { event: "Stop", script: Script::Status, args: &["completed"], timeout: 10 },
];

pub(super) fn hooks_config(env: &HookEnv) -> Value {
    let approval = env.status_script.with_file_name(AGENT_APPROVAL_SCRIPT_FILE_NAME);
    let mut events = Map::new();
    for hook in &HOOKS {
        let script = match hook.script {
            Script::Running => env.running_script,
            Script::Status => env.status_script,
            Script::Approval => approval.as_path(),
        };
        let entry = json!({
            "type": "command",
            "bash": bash_command(script, hook.args),
            "powershell": powershell_command(hook.script, script, hook.args),
            "timeoutSec": hook.timeout,
        });
        if let Value::Array(list) = events.entry(hook.event).or_insert_with(|| json!([])) {
            list.push(entry);
        }
    }
    json!({ "version": 1, "hooks": events })
}

fn bash_command(script: &Path, args: &[&str]) -> String {
    let quoted = format!("'{}'", script.to_string_lossy().replace('\'', "'\\''"));
    [format!("/bin/sh {quoted} {PROVIDER}")].into_iter().chain(args.iter().map(|arg| (*arg).to_string())).collect::<Vec<_>>().join(" ")
}

fn powershell_command(kind: Script, script: &Path, args: &[&str]) -> String {
    let quoted = format!("'{}'", script.to_string_lossy().replace('\'', "''"));
    let head = match kind {
        Script::Running => format!("& {quoted} {PROVIDER}"),
        Script::Status | Script::Approval => {
            format!("powershell.exe -NoProfile -ExecutionPolicy Bypass -File {quoted} {PROVIDER}")
        }
    };
    [head].into_iter().chain(args.iter().map(|arg| (*arg).to_string())).collect::<Vec<_>>().join(" ")
}

pub(super) fn install(env: &HookEnv) -> Result<(), String> {
    let dir = home(env.home_dir);
    if !dir.is_dir() {
        return Ok(());
    }
    install_into(&dir, &hooks_config(env))
}

pub(super) fn install_into(dir: &Path, config: &Value) -> Result<(), String> {
    let path = dir.join(HOOKS_FILE);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Failed to create the Copilot hooks folder: {error}"))?;
    }
    let content = serde_json::to_string_pretty(config).map_err(|error| format!("Failed to serialize Copilot hooks: {error}"))?;
    write_text_file(&path, &content)
}

pub(super) fn check(env: &HookEnv) -> HookInstallState {
    let dir = home(env.home_dir);
    if !dir.is_dir() {
        return HookInstallState::Absent;
    }
    state_in(&dir, &hooks_config(env))
}

pub(super) fn state_in(dir: &Path, config: &Value) -> HookInstallState {
    let Ok(content) = fs::read_to_string(dir.join(HOOKS_FILE)) else {
        return HookInstallState::NotInstalled;
    };
    match serde_json::from_str::<Value>(&content) {
        Ok(installed) if &installed == config => HookInstallState::Current,
        _ => HookInstallState::Outdated,
    }
}
