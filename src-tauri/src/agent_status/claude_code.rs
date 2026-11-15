use std::{
    fs,
    path::{Path, PathBuf},
};

use super::claude_hooks::{install_claude_code_status_hooks, ApprovalHook};
use super::harness::{Harness, HookEnv, Hooks, RemoteFiles, StatusLight};
use super::hooks_state::{claude_code_hooks_state, HookInstallState};
use super::markers::{
    CLAUDE_CODE_RUNNING_HOLD_FILE_NAME, CLAUDE_CODE_RUNNING_MARKER_FILE_NAME,
    CLAUDE_CODE_SAVED_INPUT_FILE_NAMES,
};

pub(super) const PROVIDER: &str = "claudeCode";

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks {
        install,
        check: hooks_state,
    }),
    status_light: Some(StatusLight {
        running_marker: CLAUDE_CODE_RUNNING_MARKER_FILE_NAME,
        running_hold: CLAUDE_CODE_RUNNING_HOLD_FILE_NAME,
        saved_inputs: CLAUDE_CODE_SAVED_INPUT_FILE_NAMES,
    }),
    sessions: None,
    remote: Some(RemoteFiles {
        find: &["find .claude/projects -mindepth 2 -maxdepth 2 -type f -name '*.jsonl' -mmin -\"$W\" 2>/dev/null"],
        session_dirs: &[".claude/projects/"],
        files: &[],
        checkpoint_dirs: &[],
    }),
};

fn settings_path(home_dir: &Path) -> PathBuf {
    home_dir.join(".claude").join("settings.json")
}

fn install(env: &HookEnv) -> Result<(), String> {
    install_claude_code_status_hooks(
        &settings_path(env.home_dir),
        env.running_script,
        env.status_script,
        approval_hook().as_ref(),
    )
}

fn hooks_state(env: &HookEnv) -> HookInstallState {
    claude_code_hooks_state(
        fs::read_to_string(settings_path(env.home_dir)).ok().as_deref(),
        env.running_script,
        env.status_script,
        approval_hook().as_ref(),
    )
}

fn approval_hook() -> Option<ApprovalHook> {
    use crate::agent_approval::{activity_hook_url, endpoint, hook_url, question_hook_url, Agent};
    Some(ApprovalHook {
        url: hook_url(Agent::ClaudeCode)?,
        question_url: question_hook_url(),
        activity_url: activity_hook_url(),
        token: endpoint()?.token,
    })
}
