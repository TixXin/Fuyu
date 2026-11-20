use std::{
    fs,
    path::{Path, PathBuf},
};

use super::claude_hooks::{has_exec_form_hooks, has_fixed_port_hooks, install_claude_code_status_hooks, uninstall_claude_code_status_hooks, ApprovalHook};
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
        uninstall,
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

pub(super) fn config_dir(home_dir: &Path) -> PathBuf {
    std::env::var_os("CLAUDE_CONFIG_DIR")
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
        .unwrap_or_else(|| home_dir.join(".claude"))
}

pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
    vec![config_dir(home_dir).join("CLAUDE.md")]
}

fn settings_path(home_dir: &Path) -> PathBuf {
    home_dir.join(".claude").join("settings.json")
}

fn install(env: &HookEnv) -> Result<(), String> {
    install_claude_code_status_hooks(
        &settings_path(env.home_dir),
        env.running_script,
        env.status_script,
        approval_hook().as_ref(),
        crate::agent_approval::hook_endpoint_unknown(),
    )
}

pub(super) fn upgrade_exec_form_hooks(app_dir: &Path, home_dir: &Path) -> Result<bool, String> {
    let Ok(text) = fs::read_to_string(settings_path(home_dir)) else {
        return Ok(false);
    };
    let Ok(config) = serde_json::from_str::<serde_json::Value>(text.trim_start_matches('\u{feff}')) else {
        return Ok(false);
    };
    if !has_exec_form_hooks(&config["hooks"]) && !has_fixed_port_hooks(&config["hooks"]) {
        return Ok(false);
    }
    super::install_agent_hook_scripts(app_dir)?;
    let running_script = app_dir.join(super::AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status_script = app_dir.join(super::AGENT_STATUS_SCRIPT_FILE_NAME);
    install(&HookEnv { home_dir, running_script: &running_script, status_script: &status_script })?;
    Ok(true)
}

fn uninstall(env: &HookEnv) -> Result<(), String> {
    uninstall_claude_code_status_hooks(&settings_path(env.home_dir))
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
    crate::agent_approval::hook_token().map(|_| ApprovalHook)
}
