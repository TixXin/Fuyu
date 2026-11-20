use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::system::windows_home_dir;

use super::harness::{self, HookEnv, Hooks};
use super::{
    dsh, dsh_hooks, install_agent_hook_scripts, remove_legacy_hook_scripts,
    AGENT_RUNNING_SCRIPT_FILE_NAME, AGENT_STATUS_SCRIPT_FILE_NAME,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHookResult {
    pub(super) provider: String,
    pub(super) error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHooksBatchResult {
    pub(super) results: Vec<AgentHookResult>,
    pub(super) dsh_bridge: Option<String>,
}

fn find_hooks(provider: &str) -> Option<&'static Hooks> {
    harness::with_hooks()
        .find(|(id, _)| *id == provider)
        .map(|(_, hooks)| hooks)
}

fn with_env<T>(app_dir: &Path, home_dir: &Path, run: impl FnOnce(&HookEnv) -> T) -> T {
    let running_script = app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status_script = app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME);
    run(&HookEnv {
        home_dir,
        running_script: &running_script,
        status_script: &status_script,
    })
}

pub(super) fn install_in(
    app_dir: &Path,
    home_dir: &Path,
    providers: &[String],
) -> Result<AgentHooksBatchResult, String> {
    fs::create_dir_all(app_dir)
        .map_err(|error| format!("Failed to create app data directory: {error}"))?;
    install_agent_hook_scripts(app_dir)?;
    let (results, dsh_bridge) = with_env(app_dir, home_dir, |env| {
        let results = providers
            .iter()
            .map(|provider| AgentHookResult {
                provider: provider.clone(),
                error: match find_hooks(provider) {
                    Some(hooks) => (hooks.install)(env).err(),
                    None => Some(format!("Unknown agent: {provider}")),
                },
            })
            .collect::<Vec<_>>();
        let dsh_bridge = providers
            .iter()
            .any(|provider| provider == dsh::PROVIDER)
            .then(|| dsh_hooks::bridge_lines(env))
            .flatten();
        (results, dsh_bridge)
    });
    remove_legacy_hook_scripts(app_dir);
    Ok(AgentHooksBatchResult { results, dsh_bridge })
}

pub(super) fn uninstall_in(app_dir: &Path, home_dir: &Path, provider: &str) -> Result<(), String> {
    let hooks = find_hooks(provider).ok_or_else(|| format!("Unknown agent: {provider}"))?;
    with_env(app_dir, home_dir, |env| (hooks.uninstall)(env))
}

fn agent_dir(app: &AppHandle) -> Result<PathBuf, String> {
    crate::home_dir::agent_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

#[tauri::command]
pub async fn install_agent_hooks(
    app: AppHandle,
    providers: Vec<String>,
) -> Result<AgentHooksBatchResult, String> {
    let app_dir = agent_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || install_in(&app_dir, &windows_home_dir()?, &providers))
        .await
        .map_err(|error| format!("Failed to join the agent hooks task: {error}"))?
}

#[tauri::command]
pub async fn uninstall_agent_hooks(app: AppHandle, provider: String) -> Result<(), String> {
    crate::dev_lane::refuse_in_preview("remove the agents' hooks")?;
    let app_dir = agent_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || uninstall_in(&app_dir, &windows_home_dir()?, &provider))
        .await
        .map_err(|error| format!("Failed to join the agent hooks task: {error}"))?
}

#[cfg(test)]
#[path = "per_agent_hooks_tests.rs"]
mod tests;
