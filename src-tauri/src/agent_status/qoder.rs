use std::path::{Path, PathBuf};

use super::claude_compat::{self, Compat, Home, Records, Waiting};
use super::harness::{Harness, HookEnv, Hooks, ScanRoots, StatusLight};
use super::hooks_state::HookInstallState;
use super::sessions::AgentSessionSummary;

pub(super) const PROVIDER: &str = "qoder";

pub(super) const SPEC: Compat = Compat {
    provider: PROVIDER,
    label: "Qoder",
    homes: &[Home { dir: ".qoder", env: "QODER_CONFIG_DIR" }, Home { dir: ".qoder-cn", env: "QODERCN_CONFIG_DIR" }],
    chats: None,
    records: Records::Claude,
    prompt_file: "AGENTS.md",
    waiting: Waiting::PermissionRequest,
};

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks { install, check }),
    status_light: Some(StatusLight {
        running_marker: "agent-qoder-running.flag",
        running_hold: "agent-qoder-running-hold.flag",
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

fn sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    claude_compat::sessions(&SPEC, roots, now, window_ms)
}

pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
    claude_compat::prompt_files(&SPEC, home_dir)
}
