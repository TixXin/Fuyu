use std::{fs, path::Path};

use serde::{Deserialize, Serialize};

use crate::system::windows_home_dir;

use super::harness::{self, HookEnv};
use super::snapshot::current_unix_millis;
use super::{
    install_agent_hook_scripts, may_change_hook_files, remote_setup, remove_legacy_hook_scripts,
    reply_marker, write_text_file, AGENT_RUNNING_SCRIPT_FILE_NAME, AGENT_STATUS_SCRIPT_FILE_NAME,
};

pub(super) const UNINSTALLED_HOOKS_FILE_NAME: &str = "uninstalled-hooks.json";

const SCRIPT_PREFIXES: [&str; 2] = ["fuyu-agent-", "focusd-agent-"];
const SCRIPT_EXTENSIONS: [&str; 3] = ["cmd", "ps1", "sh"];
const KNOWN_SCRIPT_NAMES: [&str; 12] = [
    "fuyu-agent-running.cmd",
    "fuyu-agent-status.ps1",
    "fuyu-agent-session.ps1",
    "fuyu-agent-approval.ps1",
    "fuyu-agent-running.sh",
    "fuyu-agent-status.sh",
    "fuyu-agent-session.sh",
    "fuyu-agent-approval.sh",
    "focusd-agent-running.cmd",
    "focusd-agent-status.ps1",
    "focusd-agent-session.ps1",
    "focusd-agent-approval.ps1",
];

const EDITOR_CONFIG_DIRS: [&str; 8] = [
    ".vscode",
    ".vscode-insiders",
    ".cursor",
    ".windsurf",
    ".vscodium",
    ".vscode-oss",
    ".trae",
    ".kiro",
];
const EDITOR_EXTENSION_PREFIXES: [&str; 3] = [
    "tixxin.fuyu-",
    "focusd.island-",
    "tixxin.focusd-island-",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHooksUninstallResult {
    pub(super) removed_at: i64,
    pub(super) remotes: Vec<remote_setup::RemoteResult>,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UninstalledHooksMarker {
    #[serde(default)]
    hooks: bool,
    #[serde(default)]
    reply_marker: bool,
}

pub(super) fn remove_file_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Failed to remove {}: {error}", path.display())),
    }
}

fn is_managed_script_name(name: &str) -> bool {
    let matches_prefix = SCRIPT_PREFIXES.iter().any(|prefix| name.starts_with(prefix));
    let matches_ext = Path::new(name)
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| SCRIPT_EXTENSIONS.iter().any(|known| ext.eq_ignore_ascii_case(known)));
    matches_prefix && matches_ext
}

pub(super) fn remove_hook_scripts(app_dir: &Path) {
    for name in KNOWN_SCRIPT_NAMES {
        let _ = fs::remove_file(app_dir.join(name));
    }
    for entry in fs::read_dir(app_dir).into_iter().flatten().flatten() {
        let name = entry.file_name();
        if entry.file_type().is_ok_and(|kind| kind.is_file())
            && is_managed_script_name(&name.to_string_lossy())
        {
            let _ = fs::remove_file(entry.path());
        }
    }
}

pub(super) fn uninstall_local_hooks_in(app_dir: &Path, home_dir: &Path) -> Result<(), String> {
    let running_script = app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status_script = app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let env = HookEnv {
        home_dir,
        running_script: &running_script,
        status_script: &status_script,
    };
    let mut errors = Vec::new();
    for (id, hooks) in harness::with_hooks() {
        if let Err(error) = (hooks.uninstall)(&env) {
            errors.push(format!("{id}: {error}"));
        }
    }
    remove_hook_scripts(app_dir);
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

pub(super) fn uninstall_agent_status_hooks_now(
    app_dir: &Path,
) -> Result<AgentHooksUninstallResult, String> {
    let home_dir = windows_home_dir()?;
    let local = uninstall_local_hooks_in(app_dir, &home_dir);
    let _ = remove_file_if_exists(&app_dir.join(UNINSTALLED_HOOKS_FILE_NAME));
    let remotes = remote_setup::uninstall_hooks(app_dir);
    local?;
    Ok(AgentHooksUninstallResult {
        removed_at: current_unix_millis(),
        remotes,
    })
}

fn read_marker(app_dir: &Path) -> Option<UninstalledHooksMarker> {
    let text = fs::read_to_string(app_dir.join(UNINSTALLED_HOOKS_FILE_NAME)).ok()?;
    serde_json::from_str(text.trim_start_matches('\u{feff}')).ok()
}

fn remove_editor_extensions(home_dir: &Path) {
    for config_dir in EDITOR_CONFIG_DIRS {
        let extensions_dir = home_dir.join(config_dir).join("extensions");
        for entry in fs::read_dir(extensions_dir).into_iter().flatten().flatten() {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if !file_type.is_dir() {
                continue;
            }
            let lower = entry.file_name().to_string_lossy().to_ascii_lowercase();
            if EDITOR_EXTENSION_PREFIXES
                .iter()
                .any(|prefix| lower.starts_with(prefix))
            {
                let _ = fs::remove_dir_all(entry.path());
            }
        }
    }
}

pub(crate) fn cleanup_for_app_uninstall(app_dir: &Path, home_dir: &Path, delete_data: bool) {
    let previous = read_marker(app_dir).unwrap_or_default();
    let running_script = app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status_script = app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let env = HookEnv {
        home_dir,
        running_script: &running_script,
        status_script: &status_script,
    };
    let had_hooks = previous.hooks
        || harness::with_hooks().any(|(_, hooks)| (hooks.check)(&env).is_installed());
    let had_reply_marker = previous.reply_marker || reply_marker::is_installed_in(home_dir);

    let _ = uninstall_local_hooks_in(app_dir, home_dir);
    let _ = reply_marker::set_local(home_dir, false);

    let marker_path = app_dir.join(UNINSTALLED_HOOKS_FILE_NAME);
    if delete_data {
        let _ = remove_file_if_exists(&marker_path);
        remove_editor_extensions(home_dir);
    } else if had_hooks || had_reply_marker {
        let marker = UninstalledHooksMarker {
            hooks: had_hooks,
            reply_marker: had_reply_marker,
        };
        if let Ok(serialized) = serde_json::to_string_pretty(&marker) {
            let _ = write_text_file(&marker_path, &serialized);
        }
    }
}

pub(crate) fn restore_hooks_after_reinstall(
    app_dir: &Path,
    home_dir: &Path,
) -> Result<bool, String> {
    if !may_change_hook_files() {
        return Ok(false);
    }
    let marker_path = app_dir.join(UNINSTALLED_HOOKS_FILE_NAME);
    let content = match fs::read_to_string(&marker_path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(format!("Failed to read {}: {error}", marker_path.display())),
    };
    let marker: UninstalledHooksMarker = serde_json::from_str(content.trim_start_matches('\u{feff}'))
        .map_err(|error| {
            let _ = remove_file_if_exists(&marker_path);
            format!("Failed to parse {}: {error}", marker_path.display())
        })?;
    if marker.hooks {
        fs::create_dir_all(app_dir)
            .map_err(|error| format!("Failed to create {}: {error}", app_dir.display()))?;
        install_agent_hook_scripts(app_dir)?;
        let running_script = app_dir.join(AGENT_RUNNING_SCRIPT_FILE_NAME);
        let status_script = app_dir.join(AGENT_STATUS_SCRIPT_FILE_NAME);
        let env = HookEnv {
            home_dir,
            running_script: &running_script,
            status_script: &status_script,
        };
        for (_, hooks) in harness::with_hooks() {
            (hooks.install)(&env)?;
        }
        remove_legacy_hook_scripts(app_dir);
    }
    if marker.reply_marker {
        reply_marker::set_local(home_dir, true)?;
    }
    remove_file_if_exists(&marker_path)?;
    Ok(marker.hooks || marker.reply_marker)
}

#[cfg(test)]
#[path = "uninstall_tests.rs"]
mod tests;
