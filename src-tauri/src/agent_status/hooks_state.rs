use std::path::Path;

use serde::Serialize;
use serde_json::Value;

use super::claude_hooks::{claude_code_installed_entries, ApprovalHook};
use super::codex_hooks::build_codex_hook_block;
use super::{is_island_hook_text, normalize_windows_line_endings};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) enum HookInstallState {
    NotInstalled,
    Outdated,
    Current,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHooksState {
    pub(super) codex: HookInstallState,
    pub(super) claude_code: HookInstallState,
    pub(super) scripts_outdated: bool,
}

pub(super) fn claude_code_hooks_state(
    settings_json: Option<&str>,
    running_script_path: &Path,
    status_script_path: &Path,
    approval: Option<&ApprovalHook>,
) -> HookInstallState {
    let Some(config) = settings_json.and_then(|text| serde_json::from_str::<Value>(text).ok())
    else {
        return HookInstallState::NotInstalled;
    };
    let hooks = &config["hooks"];
    if !is_island_hook_text(&hooks.to_string()) {
        return HookInstallState::NotInstalled;
    }

    let all_current = claude_code_installed_entries(running_script_path, status_script_path, approval)
        .iter()
        .all(|(event_name, expected)| {
            hooks[*event_name]
                .as_array()
                .is_some_and(|entries| entries.contains(expected))
        });
    if all_current {
        HookInstallState::Current
    } else {
        HookInstallState::Outdated
    }
}

pub(super) fn codex_hooks_state(
    config_toml: Option<&str>,
    running_script_path: &Path,
    status_script_path: &Path,
    runs_async: Option<bool>,
) -> HookInstallState {
    let Some(config) = config_toml else {
        return HookInstallState::NotInstalled;
    };
    let config = normalize_windows_line_endings(config);
    let holds = |async_start: bool| {
        let expected = build_codex_hook_block(running_script_path, status_script_path, async_start);
        config.contains(&normalize_windows_line_endings(&expected))
    };
    let current = match runs_async {
        Some(async_start) => holds(async_start),
        None => holds(false) || holds(true),
    };
    if current {
        HookInstallState::Current
    } else if is_island_hook_text(&config) {
        HookInstallState::Outdated
    } else {
        HookInstallState::NotInstalled
    }
}

pub(super) fn script_outdated(
    installed: Option<&str>,
    bundled: &str,
    hooks_installed: bool,
) -> bool {
    match installed {
        Some(content) => {
            normalize_windows_line_endings(content) != normalize_windows_line_endings(bundled)
        }
        None => hooks_installed,
    }
}
