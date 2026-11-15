use std::{
    fs,
    path::{Path, PathBuf},
};

use super::codex_hooks::install_codex_status_hooks;
use super::codex_version::codex_runs_async_hooks;
use super::harness::{Harness, HookCheck, HookEnv, Hooks, RemoteFiles, StatusLight};
use super::hooks_state::{codex_hooks_state, HookInstallState};
use super::markers::{
    CODEX_RUNNING_HOLD_FILE_NAME, CODEX_RUNNING_MARKER_FILE_NAME, CODEX_SAVED_INPUT_FILE_NAMES,
};

pub(super) const PROVIDER: &str = "codex";

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks {
        install,
        check: HookCheck::State(hooks_state),
    }),
    status_light: Some(StatusLight {
        running_marker: CODEX_RUNNING_MARKER_FILE_NAME,
        running_hold: CODEX_RUNNING_HOLD_FILE_NAME,
        saved_inputs: CODEX_SAVED_INPUT_FILE_NAMES,
    }),
    sessions: None,
    remote: Some(RemoteFiles {
        find: &[
            "find .codex/sessions -mindepth 4 -maxdepth 4 -type f -name '*.jsonl' -mmin -\"$W\" 2>/dev/null",
            "[ -f .codex/session_index.jsonl ] && echo .codex/session_index.jsonl",
        ],
        session_dirs: &[".codex/sessions/"],
        files: &[".codex/session_index.jsonl"],
    }),
};

fn config_path(home_dir: &Path) -> PathBuf {
    home_dir.join(".codex").join("config.toml")
}

fn install(env: &HookEnv) -> Result<(), String> {
    install_codex_status_hooks(
        &config_path(env.home_dir),
        env.running_script,
        env.status_script,
        codex_runs_async_hooks(env.home_dir) == Some(true),
    )
}

fn hooks_state(env: &HookEnv) -> HookInstallState {
    codex_hooks_state(
        fs::read_to_string(config_path(env.home_dir)).ok().as_deref(),
        env.running_script,
        env.status_script,
        codex_runs_async_hooks(env.home_dir),
    )
}
