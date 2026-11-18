use std::{
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
};

use super::harness::{Harness, HookEnv, Hooks};
use super::hooks_state::HookInstallState;
use super::markers::AGENT_RUNNING_STALE_AFTER_MS;
use super::opencode;
use super::sessions::{session_phase, AgentSessionSummary};
use super::write_text_file;

pub(super) const PROVIDER: &str = "mimo";
const APP: &str = "mimocode";
const PLUGIN_FILE_NAME: &str = "fuyu-island.js";
const PLUGIN_TEMPLATE: &str = include_str!("hooks/fuyu-opencode-plugin.js");
const DIR_PLACEHOLDER: &str = "\"__FUYU_DIR__\"";
const PLUGIN_SWAPS: [(&str, &str); 2] =
    [("\"/opencode/permission\"", "\"/mimo/permission\""), ("`opencode-plugin-", "`mimo-plugin-")];

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks { install: install_hooks, check: hooks_state, uninstall: uninstall_hooks }),
    status_light: None,
    sessions: Some(|roots, now, window_ms| match roots.local_app_dir {
        Some(_) => database_path(roots.home_dir, process_env).map_or_else(Vec::new, |db| sessions(&db, now, window_ms)),
        None => Vec::new(),
    }),
    remote: None,
};

fn process_env(name: &str) -> Option<OsString> {
    std::env::var_os(name)
}

fn base_dir(home_dir: &Path, env: &impl Fn(&str) -> Option<OsString>, kind: &str, xdg: &str, fallback: &[&str]) -> PathBuf {
    let absolute = |name: &str| env(name).map(PathBuf::from).filter(|dir| dir.is_absolute());
    match absolute("MIMOCODE_HOME") {
        Some(home) => home.join(kind),
        None => absolute(xdg)
            .unwrap_or_else(|| fallback.iter().fold(home_dir.to_path_buf(), |dir, part| dir.join(part)))
            .join(APP),
    }
}

fn data_dir(home_dir: &Path, env: &impl Fn(&str) -> Option<OsString>) -> PathBuf {
    base_dir(home_dir, env, "data", "XDG_DATA_HOME", &[".local", "share"])
}

fn config_dir(home_dir: &Path, env: &impl Fn(&str) -> Option<OsString>) -> PathBuf {
    base_dir(home_dir, env, "config", "XDG_CONFIG_HOME", &[".config"])
}

fn database_path(home_dir: &Path, env: impl Fn(&str) -> Option<OsString>) -> Option<PathBuf> {
    let data = data_dir(home_dir, &env);
    match env("MIMOCODE_DB").filter(|name| !name.is_empty()) {
        Some(name) if name == ":memory:" => None,
        Some(name) => {
            let path = PathBuf::from(name);
            Some(if path.is_absolute() { path } else { data.join(path) })
        }
        None => Some(data.join("mimocode.db")),
    }
}

pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
    vec![config_dir(home_dir, &process_env).join("AGENTS.md")]
}

fn present(home_dir: &Path, env: &impl Fn(&str) -> Option<OsString>) -> bool {
    config_dir(home_dir, env).is_dir() || data_dir(home_dir, env).is_dir()
}

fn plugin_path(home_dir: &Path, env: &impl Fn(&str) -> Option<OsString>) -> PathBuf {
    config_dir(home_dir, env).join("plugin").join(PLUGIN_FILE_NAME)
}

fn plugin_text(app_dir: &Path) -> String {
    let dir = serde_json::to_string(&app_dir.to_string_lossy()).unwrap_or_else(|_| "\"\"".to_string());
    PLUGIN_SWAPS
        .iter()
        .fold(PLUGIN_TEMPLATE.replace(DIR_PLACEHOLDER, &dir), |text, (from, to)| text.replace(from, to))
}

fn app_dir<'a>(env: &HookEnv<'a>) -> &'a Path {
    env.status_script.parent().unwrap_or(env.status_script)
}

fn install_hooks(env: &HookEnv) -> Result<(), String> {
    install_with(env, &process_env)
}

fn hooks_state(env: &HookEnv) -> HookInstallState {
    state_with(env, &process_env)
}

fn uninstall_hooks(env: &HookEnv) -> Result<(), String> {
    uninstall_with(env, &process_env)
}

pub(super) fn uninstall_with(env: &HookEnv, vars: &impl Fn(&str) -> Option<OsString>) -> Result<(), String> {
    super::uninstall::remove_file_if_exists(&plugin_path(env.home_dir, vars))
}

fn install_with(env: &HookEnv, vars: &impl Fn(&str) -> Option<OsString>) -> Result<(), String> {
    if !present(env.home_dir, vars) {
        return Ok(());
    }
    write_text_file(&plugin_path(env.home_dir, vars), &plugin_text(app_dir(env)))
}

fn state_with(env: &HookEnv, vars: &impl Fn(&str) -> Option<OsString>) -> HookInstallState {
    if !present(env.home_dir, vars) {
        return HookInstallState::Absent;
    }
    match fs::read_to_string(plugin_path(env.home_dir, vars)) {
        Err(_) => HookInstallState::NotInstalled,
        Ok(text) if text.replace("\r\n", "\n") == plugin_text(app_dir(env)).replace("\r\n", "\n") => HookInstallState::Current,
        Ok(_) => HookInstallState::Outdated,
    }
}

fn sessions(db: &Path, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    opencode::cached_rows(db, now - window_ms)
        .into_iter()
        .map(|row| {
            let mut summary = row.summary;
            summary.provider = PROVIDER;
            summary.phase = session_phase(row.state, now - summary.updated_at, AGENT_RUNNING_STALE_AFTER_MS);
            summary
        })
        .collect()
}

#[cfg(test)]
#[path = "mimo_tests.rs"]
mod tests;
