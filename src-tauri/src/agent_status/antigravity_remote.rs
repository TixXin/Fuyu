use serde_json::{json, Value};

use super::antigravity;
use super::harness::{RemoteFiles, ScanRoots};
use super::remote_fetch::run_ssh;
use super::remote_hosts::SshTarget;
use super::remote_setup::edit;
use super::sessions::AgentSessionSummary;

const HOOKS_PATH: &str = ".gemini/config/hooks.json";
const CLI_DIR: &str = ".gemini/antigravity-cli";
const MIRRORED_APP_DIR: &str = ".fuyu";
const SAVED_DIR: &str = ".fuyu/agent-antigravity";
const HOOK_NAME: &str = "fuyu";

pub(super) const REMOTE_FILES: RemoteFiles = RemoteFiles {
    find: &["find .fuyu/agent-antigravity -maxdepth 1 -type f -name '*.json' -mmin -\"$W\" 2>/dev/null"],
    session_dirs: &[],
    files: &[],
    checkpoint_dirs: &[".fuyu/agent-antigravity/"],
};

pub(super) fn read_sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    match roots.local_app_dir {
        Some(app_dir) => antigravity::sessions(app_dir, now, window_ms),
        None => antigravity::sessions(&roots.home_dir.join(MIRRORED_APP_DIR), now, window_ms),
    }
}

fn save_command(state: &str) -> String {
    format!(
        "umask 077; d=\"$HOME/{SAVED_DIR}\"; t=\"$d/.$$-$(date +%s).tmp\"; mkdir -p \"$d\" && cat > \"$t\" && \
         c=$(sed -n 's/.*\"conversationId\" *: *\"\\([A-Za-z0-9_.-]*\\)\".*/\\1/p' \"$t\" | head -n 1) && [ -n \"$c\" ] && \
         rm -f \"$d/running-$c.json\" \"$d/stop-$c.json\" && mv -f \"$t\" \"$d/{state}-$c.json\"; rm -f \"$t\"; \
         find \"$d\" -maxdepth 1 -type f -mmin +1440 -delete 2>/dev/null; exit 0"
    )
}

fn hook_group() -> Value {
    let save = |state: &str| json!([{ "type": "command", "command": save_command(state), "timeout": 5 }]);
    json!({
        "enabled": true,
        "SessionStart": save("running"),
        "PreInvocation": save("running"),
        "Stop": save("stop"),
    })
}

pub(super) fn with_remote_hooks(text: &str) -> Result<String, String> {
    let mut config = match text.trim() {
        "" => json!({}),
        text => serde_json::from_str::<Value>(text).map_err(|error| format!("Failed to parse ~/{HOOKS_PATH}: {error}"))?,
    };
    config
        .as_object_mut()
        .ok_or_else(|| format!("~/{HOOKS_PATH} must contain a JSON object"))?
        .insert(HOOK_NAME.to_string(), hook_group());
    serde_json::to_string_pretty(&config).map_err(|error| error.to_string())
}

fn lives_there(target: &SshTarget) -> Result<bool, String> {
    let said = run_ssh(target, &format!("[ -d \"$HOME/{CLI_DIR}\" ] && echo yes; exit 0\n"))?;
    Ok(String::from_utf8_lossy(&said).trim() == "yes")
}

pub(super) fn install(target: &SshTarget) -> Result<(), String> {
    if !lives_there(target)? {
        return Ok(());
    }
    edit(target, HOOKS_PATH, &with_remote_hooks)
}

#[cfg(test)]
#[path = "antigravity_remote_tests.rs"]
mod tests;
