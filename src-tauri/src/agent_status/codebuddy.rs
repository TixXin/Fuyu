use std::path::{Path, PathBuf};

use super::claude_compat::{self, Compat, Home, Records, Reply, Waiting};
use super::harness::{Harness, HookEnv, Hooks, ScanRoots, StatusLight};
use super::hooks_state::HookInstallState;
use super::sessions::AgentSessionSummary;

pub(super) const PROVIDER: &str = "codebuddy";

pub(super) const SPEC: Compat = Compat {
    provider: PROVIDER,
    label: "CodeBuddy",
    homes: &[Home { dir: ".codebuddy", env: "CODEBUDDY_CONFIG_DIR" }],
    chats: None,
    records: Records::CodeBuddy,
    prompt_file: "CODEBUDDY.md",
    waiting: Waiting::PermissionPrompt,
    hooks_file: "settings.json",
    reply: Reply::PermissionRequest,
    aliases: &[],
};

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks { install, check, uninstall }),
    status_light: Some(StatusLight {
        running_marker: "agent-codebuddy-running.flag",
        running_hold: "agent-codebuddy-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: Some(sessions),
    remote: None,
};

fn install(env: &HookEnv) -> Result<(), String> {
    claude_compat::install_hooks(&SPEC, env)
}

fn check(env: &HookEnv) -> HookInstallState {
    claude_compat::hooks_state(&SPEC, env)
}

fn uninstall(env: &HookEnv) -> Result<(), String> {
    claude_compat::uninstall_hooks(&SPEC, env)
}

fn sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    claude_compat::sessions(&SPEC, roots, now, window_ms)
}

pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
    claude_compat::prompt_files(&SPEC, home_dir)
}
