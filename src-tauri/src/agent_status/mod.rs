#[cfg_attr(not(windows), path = "approval_hotkeys_unsupported.rs")]
pub(crate) mod approval_hotkeys;
mod background_tasks;
mod claude_hooks;
mod codex_hooks;
mod editor_extension;
mod editor_terminal;
mod external;
mod hooks_state;
pub(crate) mod host_icon;
mod codex_usage;
mod codex_version;
mod magpie;
mod markers;
mod notifications;
mod orca;
mod plan_usage;
pub(crate) mod reply_marker;
mod reply_text;
pub(crate) mod remote_fetch;
pub(crate) mod remote_hosts;
mod remote_sessions;
mod remote_setup;
mod focus;
mod focus_log;
mod session_host;
mod session_memory;
mod session_mode;
mod session_process;
mod session_records;
mod snapshot;
pub(crate) mod sound_packs;
#[cfg(test)]
mod tests;
mod session_scan;
mod sessions;
mod title;
mod todo_list;
mod tool_call;
mod usage;
mod push_detail;
mod wezterm;
mod window_focus;

use serde::Serialize;
use serde_json::{json, Value};
use std::{fs, path::Path};
use tauri::{AppHandle, Emitter, Manager};

use crate::system::windows_home_dir;

use claude_hooks::install_claude_code_status_hooks;
use codex_hooks::install_codex_status_hooks;
use hooks_state::{
    claude_code_hooks_state, codex_hooks_state, script_outdated, AgentHooksState, HookInstallState,
};
use markers::{
    apply_agent_running_markers, remove_agent_marker_files, remove_legacy_hook_inputs,
    CLAUDE_CODE_RUNNING_HOLD_FILE_NAME, CLAUDE_CODE_RUNNING_MARKER_FILE_NAME,
    CLAUDE_CODE_SAVED_INPUT_FILE_NAMES, CODEX_RUNNING_HOLD_FILE_NAME,
    CODEX_RUNNING_MARKER_FILE_NAME, CODEX_SAVED_INPUT_FILE_NAMES,
};
use snapshot::{
    agent_status_snapshot_from_persisted, current_unix_millis, default_agent_phase,
    default_agent_status_snapshot, default_persisted_agent_status, AgentStatusSnapshot,
    AgentTaskStatus, PersistedAgentStatus,
};

pub(super) const AGENT_STATUS_FILE_NAME: &str = "agent-status.json";

pub(super) const AGENT_RUNNING_SCRIPT_FILE_NAME: &str = "fuyu-agent-running.cmd";
pub(super) const AGENT_STATUS_SCRIPT_FILE_NAME: &str = "fuyu-agent-status.ps1";
pub(super) const AGENT_SESSION_SCRIPT_FILE_NAME: &str = "fuyu-agent-session.ps1";

pub(super) const AGENT_HOOK_SIGNATURE: &str = "fuyu-agent-";
const LEGACY_AGENT_HOOK_SIGNATURE: &str = "focusd-agent-";
const LEGACY_SCRIPT_FILE_NAMES: [&str; 4] =
    ["focusd-agent-running.cmd", "focusd-agent-status.ps1", "focusd-agent-session.ps1", "focusd-agent-approval.ps1"];

pub(super) fn is_island_hook_text(text: &str) -> bool {
    text.contains(AGENT_HOOK_SIGNATURE) || text.contains(LEGACY_AGENT_HOOK_SIGNATURE)
}
pub(super) const AGENT_RUNNING_NOTIFICATION_ARG: &str = "notification";
pub(super) const AGENT_RUNNING_SCRIPT: &str =
    include_str!("hooks/fuyu-agent-running.cmd");
pub(super) const AGENT_STATUS_SCRIPT: &str =
    include_str!("hooks/fuyu-agent-status.ps1");
pub(super) const AGENT_SESSION_SCRIPT: &str =
    include_str!("hooks/fuyu-agent-session.ps1");
pub(super) const AGENT_APPROVAL_SCRIPT_FILE_NAME: &str = "fuyu-agent-approval.ps1";
pub(super) const AGENT_APPROVAL_SCRIPT: &str =
    include_str!("hooks/fuyu-agent-approval.ps1");

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHooksInstallResult {
    pub(super) scripts_dir: String,
    pub(super) status_path: String,
    pub(super) codex_config_path: String,
    pub(super) claude_config_path: String,
    pub(super) installed_at: i64,
    pub(super) remotes: Vec<remote_setup::RemoteResult>,
}

#[tauri::command]
pub async fn get_agent_status(app: AppHandle) -> Result<AgentStatusSnapshot, String> {
    tauri::async_runtime::spawn_blocking(move || read_agent_status(app))
        .await
        .map_err(|error| format!("Failed to join the agent status task: {error}"))?
}

fn read_agent_status(app: AppHandle) -> Result<AgentStatusSnapshot, String> {
    let app_dir = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    fs::create_dir_all(&app_dir)
        .map_err(|error| format!("Failed to create app data directory: {error}"))?;

    let status_path = app_dir.join(AGENT_STATUS_FILE_NAME);
    let status_path_display = status_path.to_string_lossy().to_string();
    let mut snapshot = match fs::read_to_string(&status_path) {
        Ok(content) => match serde_json::from_str::<PersistedAgentStatus>(&content) {
            Ok(persisted) => agent_status_snapshot_from_persisted(persisted, status_path_display),
            Err(_) => default_agent_status_snapshot(status_path_display),
        },
        Err(_) => default_agent_status_snapshot(status_path_display),
    };
    apply_agent_running_markers(&app_dir, &mut snapshot);

    Ok(snapshot)
}

#[tauri::command]
pub fn clear_agent_status(app: AppHandle, provider: String) -> Result<AgentStatusSnapshot, String> {
    if provider != "codex" && provider != "claudeCode" {
        return if external::clear_by_id(&provider) {
            read_agent_status(app)
        } else {
            Err("Unsupported agent provider.".to_string())
        };
    }
    let app_dir = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    fs::create_dir_all(&app_dir)
        .map_err(|error| format!("Failed to create app data directory: {error}"))?;

    let status_path = app_dir.join(AGENT_STATUS_FILE_NAME);
    let status_path_display = status_path.to_string_lossy().to_string();
    let mut persisted = match fs::read_to_string(&status_path) {
        Ok(content) => serde_json::from_str::<PersistedAgentStatus>(&content)
            .unwrap_or_else(|_| default_persisted_agent_status()),
        Err(_) => default_persisted_agent_status(),
    };

    let now = current_unix_millis();
    let cleared_status = AgentTaskStatus {
        phase: default_agent_phase(),
        task_id: None,
        updated_at: now,
    };

    match provider.as_str() {
        "codex" => {
            persisted.codex = cleared_status;
            remove_agent_marker_files(
                &app_dir,
                CODEX_RUNNING_MARKER_FILE_NAME,
                CODEX_RUNNING_HOLD_FILE_NAME,
                CODEX_SAVED_INPUT_FILE_NAMES,
            );
        }
        "claudeCode" => {
            persisted.claude_code = cleared_status;
            remove_agent_marker_files(
                &app_dir,
                CLAUDE_CODE_RUNNING_MARKER_FILE_NAME,
                CLAUDE_CODE_RUNNING_HOLD_FILE_NAME,
                CLAUDE_CODE_SAVED_INPUT_FILE_NAMES,
            );
        }
        _ => {
            return Err("Unsupported agent provider.".to_string());
        }
    }

    let prefix = format!("{provider}-");
    for entry in fs::read_dir(app_dir.join(notifications::NOTIFICATIONS_DIR)).into_iter().flatten().flatten() {
        if entry.file_name().to_string_lossy().starts_with(&prefix) {
            fs::remove_file(entry.path()).ok();
        }
    }

    persisted.updated_at = now;
    let content = serde_json::to_string_pretty(&persisted)
        .map_err(|error| format!("Failed to serialize agent status: {error}"))?;
    write_text_file(&status_path, &content)?;

    Ok(agent_status_snapshot_from_persisted(
        persisted,
        status_path_display,
    ))
}

pub fn init() {
    std::thread::spawn(reply_marker::upgrade_installed);
}

pub(crate) fn report_external_status(owner: &str, default_name: &str, params: &Value) -> Result<Value, (u16, String)> {
    let report = external::parse_report(params).map_err(|message| (400, message))?;
    let status = external::report(owner, default_name, report).map_err(|message| (429, message))?;
    serde_json::to_value(status).map_err(|error| (500, error.to_string()))
}

pub(crate) fn clear_external_status(owner: &str, params: &Value) -> Result<Value, (u16, String)> {
    let source = match params.get("source") {
        None | Some(Value::Null) => None,
        Some(Value::String(source)) => Some(source.as_str()),
        Some(_) => return Err((400, "\"source\" must be a string.".into())),
    };
    Ok(json!({ "cleared": external::clear(owner, source) }))
}

pub(crate) fn clear_external_owner(owner: &str) {
    external::clear(owner, None);
}

#[tauri::command]
pub async fn install_agent_status_hooks(app: AppHandle) -> Result<AgentHooksInstallResult, String> {
    tauri::async_runtime::spawn_blocking(move || install_agent_status_hooks_now(&app))
        .await
        .map_err(|error| format!("Failed to join the agent hooks task: {error}"))?
}

fn install_agent_status_hooks_now(app: &AppHandle) -> Result<AgentHooksInstallResult, String> {
    crate::dev_lane::refuse_in_preview("install the AI agents' status hooks")?;
    let app_dir = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    fs::create_dir_all(&app_dir)
        .map_err(|error| format!("Failed to create app data directory: {error}"))?;

    install_agent_hook_scripts(&app_dir)?;

    let running_script_path = app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status_script_path = app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let home_dir = windows_home_dir()?;
    let codex_config_path = home_dir.join(".codex").join("config.toml");
    let claude_config_path = home_dir.join(".claude").join("settings.json");

    install_codex_status_hooks(
        &codex_config_path,
        &running_script_path,
        &status_script_path,
        codex_version::codex_runs_async_hooks(&home_dir) == Some(true),
    )?;
    install_claude_code_status_hooks(
        &claude_config_path,
        &running_script_path,
        &status_script_path,
        approval_hook().as_ref(),
    )?;

    Ok(AgentHooksInstallResult {
        scripts_dir: app_dir.to_string_lossy().to_string(),
        status_path: app_dir
            .join(AGENT_STATUS_FILE_NAME)
            .to_string_lossy()
            .to_string(),
        codex_config_path: codex_config_path.to_string_lossy().to_string(),
        claude_config_path: claude_config_path.to_string_lossy().to_string(),
        installed_at: current_unix_millis(),
        remotes: {
            let remotes = remote_setup::install_hooks(&app_dir);
            remove_legacy_hook_scripts(&app_dir);
            remotes
        },
    })
}

fn remove_legacy_hook_scripts(app_dir: &Path) {
    for name in LEGACY_SCRIPT_FILE_NAMES {
        let _ = fs::remove_file(app_dir.join(name));
    }
}

pub(crate) fn reinstall_hooks_after_rename(app: &AppHandle) -> Result<bool, String> {
    let app_dir = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let state = read_agent_hooks_state(&app_dir)?;
    let codex = state.codex != HookInstallState::NotInstalled;
    let claude_code = state.claude_code != HookInstallState::NotInstalled;
    if !codex && !claude_code {
        return Ok(false);
    }
    install_agent_hook_scripts(&app_dir)?;
    let running_script_path = app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status_script_path = app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let home_dir = windows_home_dir()?;
    if codex {
        install_codex_status_hooks(
            &home_dir.join(".codex").join("config.toml"),
            &running_script_path,
            &status_script_path,
            codex_version::codex_runs_async_hooks(&home_dir) == Some(true),
        )?;
    }
    if claude_code {
        install_claude_code_status_hooks(
            &home_dir.join(".claude").join("settings.json"),
            &running_script_path,
            &status_script_path,
            approval_hook().as_ref(),
        )?;
    }
    for remote in remote_setup::install_hooks(&app_dir) {
        if let Some(error) = remote.error {
            eprintln!("could not reinstall the hooks on {}: {error}", remote.host);
        }
    }
    remove_legacy_hook_scripts(&app_dir);
    Ok(true)
}

#[tauri::command]
pub async fn list_agent_sessions(
    app: AppHandle,
    window_hours: Option<u32>,
) -> Result<Vec<sessions::AgentSessionSummary>, String> {
    let window_ms = window_hours
        .map(|hours| i64::from(hours.clamp(1, 24)) * 60 * 60 * 1000)
        .unwrap_or(session_scan::ACTIVE_WINDOW_MS);
    let app_dir = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    tauri::async_runtime::spawn_blocking(move || {
        let waiting = notifications::waiting_notifications(&app_dir);
        windows_home_dir().map(|home_dir| {
            let mut sessions = session_scan::list_sessions(&home_dir, Some(&app_dir), &waiting, window_ms);
            session_host::attach_hosts(&home_dir, Some(&app_dir), &mut sessions);
            sessions.extend(remote_sessions::sessions(&app_dir, window_ms));
            let is_active = |phase: &str| matches!(phase, "running" | "waiting");
            sessions.sort_by_key(|session| (!is_active(session.phase), -session.updated_at));
            sessions
        })
    })
    .await
    .map_err(|error| format!("Failed to join the agent sessions task: {error}"))?
}

#[tauri::command]
pub async fn get_agent_push_detail(
    app: AppHandle,
    provider: String,
    session_id: String,
    remote_host: Option<String>,
) -> Result<push_detail::PushDetail, String> {
    if provider != "claudeCode" {
        return Ok(push_detail::PushDetail::default());
    }
    let home_dir = match remote_host {
        Some(host) => {
            let app_dir = crate::home_dir::fuyu_home(app.path())
                .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
            remote_sessions::mirrored_home(&app_dir, &host).ok_or_else(|| format!("Unknown SSH computer {host}."))?
        }
        None => windows_home_dir()?,
    };
    tauri::async_runtime::spawn_blocking(move || {
        push_detail::claude_transcript(&home_dir, &session_id)
            .and_then(|path| session_scan::read_tail(&path))
            .map(|tail| push_detail::claude_push_detail(&tail))
            .unwrap_or_default()
    })
    .await
    .map_err(|error| format!("Failed to join the push detail task: {error}"))
}

#[tauri::command]
pub async fn list_ssh_hosts() -> Result<Vec<String>, String> {
    let home_dir = windows_home_dir()?;
    let config = std::fs::read_to_string(home_dir.join(".ssh").join("config")).unwrap_or_default();
    Ok(remote_hosts::ssh_config_hosts(&config))
}

#[tauri::command]
pub async fn get_agent_remote_hosts(app: AppHandle) -> Result<Vec<remote_sessions::RemoteHostStatus>, String> {
    let app_dir = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    Ok(remote_sessions::statuses(&app_dir))
}

#[tauri::command]
pub async fn set_agent_remote_hosts(app: AppHandle, hosts: Vec<String>) -> Result<Vec<String>, String> {
    let app_dir = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let saved = remote_hosts::write(&app_dir, &hosts)?;
    remote_sessions::refresh_soon();
    Ok(saved)
}

#[tauri::command]
pub async fn get_agent_custom_hosts(app: AppHandle) -> Result<Vec<remote_hosts::CustomHost>, String> {
    Ok(remote_hosts::custom(&remote_app_dir(&app)?))
}

#[tauri::command]
pub async fn add_agent_remote_host(app: AppHandle, host: remote_hosts::CustomHost) -> Result<Vec<remote_hosts::CustomHost>, String> {
    let added = remote_hosts::add_custom(&remote_app_dir(&app)?, &host)?;
    remote_sessions::refresh_soon();
    Ok(added)
}

#[tauri::command]
pub async fn remove_agent_remote_host(app: AppHandle, name: String) -> Result<Vec<remote_hosts::CustomHost>, String> {
    let remaining = remote_hosts::remove_custom(&remote_app_dir(&app)?, &name)?;
    remote_sessions::refresh_soon();
    Ok(remaining)
}

#[tauri::command]
pub async fn refresh_agent_remote_hosts() {
    remote_sessions::refresh_soon();
}

fn remote_app_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

#[tauri::command]
pub async fn focus_agent_window(
    app: AppHandle,
    provider: String,
    cwd: Option<String>,
    title: Option<String>,
    session_id: Option<String>,
) -> Result<bool, String> {
    let app_dir = crate::home_dir::fuyu_home(app.path()).ok();
    let focused = tauri::async_runtime::spawn_blocking(move || {
        focus::focus_session(app_dir.as_deref(), &provider, cwd.as_deref(), title.as_deref(), session_id.as_deref())
    })
    .await
    .map_err(|error| format!("Failed to join the window focus task: {error}"))?;
    if let Some(editor) = focused.missing_extension {
        let name = editor_extension::editor_name(&editor).unwrap_or(&editor).to_string();
        let payload = json!({ "app": editor, "name": name });
        let _ = app.emit_to(crate::island::WINDOW_LABEL, EDITOR_EXTENSION_MISSING_EVENT, payload);
    }
    Ok(focused.found)
}

const EDITOR_EXTENSION_MISSING_EVENT: &str = "agent-editor-extension-missing";

#[tauri::command]
pub async fn get_editor_extension_states() -> Vec<editor_extension::EditorExtensionState> {
    tauri::async_runtime::spawn_blocking(editor_extension::states).await.unwrap_or_default()
}

#[tauri::command]
pub async fn install_editor_extension(app: String) -> Result<(), crate::user_error::UserError> {
    tauri::async_runtime::spawn_blocking(move || editor_extension::install(&app))
        .await
        .map_err(|error| crate::user_error::UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

#[tauri::command]
pub async fn agent_sessions_in_front(app: AppHandle, sessions: Vec<focus::SessionRef>) -> Result<Vec<String>, String> {
    let app_dir = crate::home_dir::fuyu_home(app.path()).ok();
    tauri::async_runtime::spawn_blocking(move || focus::sessions_in_front(app_dir.as_deref(), &sessions))
        .await
        .map_err(|error| format!("Failed to join the window check: {error}"))
}

#[tauri::command]
pub async fn get_agent_usage() -> Result<Option<usage::AgentUsage>, String> {
    let home_dir = windows_home_dir()?;
    let magpie = magpie::read_usage(&usage::claude_dir(&home_dir)).await;
    tauri::async_runtime::spawn_blocking(move || {
        let local = magpie.or_else(|| usage::read_usage(&home_dir));
        usage::merge(local, crate::claude_usage::current())
    })
        .await
        .map_err(|error| format!("Failed to join the usage task: {error}"))
}

#[tauri::command]
pub async fn get_codex_usage() -> Result<Option<usage::AgentUsage>, String> {
    let home_dir = windows_home_dir()?;
    tauri::async_runtime::spawn_blocking(move || codex_usage::read_usage(&home_dir))
        .await
        .map_err(|error| format!("Failed to join the Codex usage task: {error}"))
}

#[tauri::command]
pub async fn get_plan_usage(provider: String, refresh: bool) -> Result<usage::AgentUsage, String> {
    let provider = plan_usage::PlanProvider::parse(&provider)?;
    Ok(plan_usage::read(provider, refresh).await)
}

#[tauri::command]
pub async fn set_plan_key(provider: String, key: String) -> Result<bool, crate::user_error::UserError> {
    let provider = plan_usage::PlanProvider::parse(&provider)?;
    tauri::async_runtime::spawn_blocking(move || plan_usage::save_key(provider, &key))
        .await
        .map_err(|error| crate::user_error::UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

#[tauri::command]
pub async fn has_plan_key(provider: String) -> Result<bool, crate::user_error::UserError> {
    let provider = plan_usage::PlanProvider::parse(&provider)?;
    tauri::async_runtime::spawn_blocking(move || plan_usage::has_key(provider))
        .await
        .map_err(|error| crate::user_error::UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

#[tauri::command]
pub async fn get_agent_host_icon(path: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || host_icon::icon_data_url(&path))
        .await
        .map_err(|error| format!("Failed to join the host icon task: {error}"))
}

#[tauri::command]
pub async fn get_agent_hooks_state(app: AppHandle) -> Result<AgentHooksState, String> {
    let app_dir = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    tauri::async_runtime::spawn_blocking(move || read_agent_hooks_state(&app_dir))
        .await
        .map_err(|error| format!("Failed to join the agent hooks task: {error}"))?
}

fn read_agent_hooks_state(app_dir: &Path) -> Result<AgentHooksState, String> {
    let home_dir = windows_home_dir()?;
    let read = |path: &Path| fs::read_to_string(path).ok();
    let running_script_path = app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status_script_path = app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let codex = codex_hooks_state(
        read(&home_dir.join(".codex").join("config.toml")).as_deref(),
        &running_script_path,
        &status_script_path,
        codex_version::codex_runs_async_hooks(&home_dir),
    );
    let claude_code = claude_code_hooks_state(
        read(&home_dir.join(".claude").join("settings.json")).as_deref(),
        &running_script_path,
        &status_script_path,
        approval_hook().as_ref(),
    );
    let hooks_installed =
        codex != HookInstallState::NotInstalled || claude_code != HookInstallState::NotInstalled;
    let scripts_outdated = script_outdated(
        read(&app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME)).as_deref(),
        AGENT_RUNNING_SCRIPT,
        hooks_installed,
    ) || script_outdated(
        read(&app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME)).as_deref(),
        AGENT_STATUS_SCRIPT,
        hooks_installed,
    ) || script_outdated(
        read(&app_dir.join(AGENT_SESSION_SCRIPT_FILE_NAME)).as_deref(),
        AGENT_SESSION_SCRIPT,
        hooks_installed,
    ) || script_outdated(
        read(&app_dir.join(AGENT_APPROVAL_SCRIPT_FILE_NAME)).as_deref(),
        AGENT_APPROVAL_SCRIPT,
        hooks_installed,
    );

    Ok(AgentHooksState {
        codex,
        claude_code,
        scripts_outdated,
    })
}

pub(super) fn install_agent_hook_scripts(app_dir: &Path) -> Result<(), String> {
    remove_legacy_hook_inputs(app_dir);
    write_text_file(
        &app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME),
        &normalize_windows_line_endings(AGENT_RUNNING_SCRIPT),
    )?;
    write_text_file(
        &app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME),
        &normalize_windows_line_endings(AGENT_STATUS_SCRIPT),
    )?;
    write_text_file(
        &app_dir.join(AGENT_SESSION_SCRIPT_FILE_NAME),
        &normalize_windows_line_endings(AGENT_SESSION_SCRIPT),
    )?;
    write_text_file(
        &app_dir.join(AGENT_APPROVAL_SCRIPT_FILE_NAME),
        &normalize_windows_line_endings(AGENT_APPROVAL_SCRIPT),
    )
}

fn approval_hook() -> Option<claude_hooks::ApprovalHook> {
    use crate::agent_approval::{activity_hook_url, endpoint, hook_url, question_hook_url, Agent};
    Some(claude_hooks::ApprovalHook {
        url: hook_url(Agent::ClaudeCode)?,
        question_url: question_hook_url(),
        activity_url: activity_hook_url(),
        token: endpoint()?.token,
    })
}

pub(super) fn write_text_file(path: &Path, content: &str) -> Result<(), String> {
    if let Ok(target) = fs::read_link(path) {
        return Err(format!(
            "{} is a symlink to {}; the island does not change it. Change that file yourself",
            path.display(),
            target.display()
        ));
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {error}", parent.display()))?;
    }

    let temporary_path = path.with_extension("tmp");
    fs::write(&temporary_path, content)
        .map_err(|error| format!("Failed to write {}: {error}", temporary_path.display()))?;
    fs::rename(&temporary_path, path)
        .or_else(|_| {
            fs::remove_file(path).ok();
            fs::rename(&temporary_path, path)
        })
        .map_err(|error| format!("Failed to replace {}: {error}", path.display()))
}

pub(super) fn normalize_windows_line_endings(content: &str) -> String {
    content.replace("\r\n", "\n").replace('\n', "\r\n")
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::agent_status::get_agent_status,
            crate::agent_status::clear_agent_status,
            crate::agent_status::install_agent_status_hooks,
            crate::agent_status::get_agent_hooks_state,
            crate::agent_status::focus_agent_window,
            crate::agent_status::get_editor_extension_states,
            crate::agent_status::install_editor_extension,
            crate::agent_status::agent_sessions_in_front,
            crate::agent_status::get_agent_host_icon,
            crate::agent_status::list_agent_sessions,
            crate::agent_status::get_agent_push_detail,
            crate::agent_status::list_ssh_hosts,
            crate::agent_status::get_agent_remote_hosts,
            crate::agent_status::set_agent_remote_hosts,
            crate::agent_status::get_agent_custom_hosts,
            crate::agent_status::add_agent_remote_host,
            crate::agent_status::remove_agent_remote_host,
            crate::agent_status::refresh_agent_remote_hosts,
            crate::agent_status::get_agent_usage,
            crate::agent_status::get_codex_usage,
            crate::agent_status::get_plan_usage,
            crate::agent_status::set_plan_key,
            crate::agent_status::has_plan_key,
            crate::agent_status::reply_marker::get_reply_marker_state,
            crate::agent_status::reply_marker::set_reply_marker,
            crate::agent_status::sound_packs::list_sound_packs,
            crate::agent_status::sound_packs::import_sound_pack,
            crate::agent_status::sound_packs::remove_sound_pack,
            crate::agent_status::sound_packs::read_sound_pack_file,
            crate::agent_status::sound_packs::open_sound_pack_folder,
            crate::agent_status::approval_hotkeys::set_agent_approval_hotkeys,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
