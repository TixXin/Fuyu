use serde_json::{json, Value};

use super::antigravity::{self, APPROVED_TOOLS};
use super::claude_hooks::APPROVAL_HOOK_TIMEOUT_SECONDS;
use super::harness::{RemoteFiles, ScanRoots};
use super::remote_fetch::run_ssh;
use super::remote_hosts::SshTarget;
use super::remote_setup::{edit, RemoteApproval};
use super::sessions::AgentSessionSummary;

const HOOKS_PATH: &str = ".gemini/config/hooks.json";
const CLI_DIR: &str = ".gemini/antigravity-cli";
const MIRRORED_APP_DIR: &str = ".fuyu";
const SAVED_DIR: &str = ".fuyu/agent-antigravity";
const HOOK_NAME: &str = "fuyu";

pub(super) const REMOTE_FILES: RemoteFiles = RemoteFiles {
    find: &[
        "for j in $(find .fuyu/agent-antigravity -maxdepth 1 -type f -name '*.json' -mmin -\"$W\" 2>/dev/null); do \
         echo \"$j\"; c=${j##*/}; c=${c#*-}; c=${c%.json}; \
         f=\".gemini/antigravity-cli/annotations/$c.pbtxt\"; [ -f \"$f\" ] && echo \"$f\"; done",
    ],
    session_dirs: &[],
    files: &[],
    checkpoint_dirs: &[".fuyu/agent-antigravity/", ".gemini/antigravity-cli/annotations/"],
};

pub(super) fn read_sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    match roots.local_app_dir {
        Some(app_dir) => antigravity::sessions_at(app_dir, Some(roots.home_dir), true, now, window_ms),
        None => antigravity::sessions_at(&roots.home_dir.join(MIRRORED_APP_DIR), Some(roots.home_dir), false, now, window_ms),
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

fn approval_command(approval: &RemoteApproval) -> String {
    let wait = format!("-f -m {}", APPROVAL_HOOK_TIMEOUT_SECONDS - 5);
    approval.curl(&approval.antigravity_path, "approval", &wait, "exit 0")
}

fn hook_group(approval: Option<&RemoteApproval>) -> Value {
    let save = |state: &str| json!([{ "type": "command", "command": save_command(state), "timeout": 5 }]);
    let mut group = json!({
        "enabled": true,
        "SessionStart": save("running"),
        "PreInvocation": save("running"),
        "Stop": save("stop"),
    });
    if let Some(approval) = approval {
        group["PreToolUse"] = json!([{
            "matcher": APPROVED_TOOLS,
            "hooks": [{ "type": "command", "command": approval_command(approval), "timeout": APPROVAL_HOOK_TIMEOUT_SECONDS }],
        }]);
    }
    group
}

pub(super) fn with_remote_hooks(text: &str, approval: Option<&RemoteApproval>) -> Result<String, String> {
    let mut config = match text.trim() {
        "" => json!({}),
        text => serde_json::from_str::<Value>(text).map_err(|error| format!("Failed to parse ~/{HOOKS_PATH}: {error}"))?,
    };
    config
        .as_object_mut()
        .ok_or_else(|| format!("~/{HOOKS_PATH} must contain a JSON object"))?
        .insert(HOOK_NAME.to_string(), hook_group(approval));
    serde_json::to_string_pretty(&config).map_err(|error| error.to_string())
}

fn lives_there(target: &SshTarget) -> Result<bool, String> {
    let said = run_ssh(target, &format!("[ -d \"$HOME/{CLI_DIR}\" ] && echo yes; exit 0\n"))?;
    Ok(String::from_utf8_lossy(&said).trim() == "yes")
}

pub(super) fn install(target: &SshTarget, approval: Option<&RemoteApproval>) -> Result<(), String> {
    if !lives_there(target)? {
        return Ok(());
    }
    edit(target, HOOKS_PATH, &|text| with_remote_hooks(text, approval))
}

#[cfg(test)]
#[path = "antigravity_remote_tests.rs"]
mod tests;
