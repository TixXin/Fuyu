use std::{fs, path::Path};

use super::codex_hooks::{
    agent_running_command, agent_running_command_with, agent_status_command, remove_hook_blocks, toml_basic_string,
};
use super::harness::HookEnv;
use super::hooks_state::HookInstallState;
use super::kimi_code::{home, PROVIDER};
use super::{is_island_hook_text, normalize_windows_line_endings, write_text_file, AGENT_RUNNING_NOTIFICATION_ARG};

const BLOCK_BEGIN: &str = "# BEGIN Fuyu Agent Status Hooks (Kimi Code)";
const BLOCK_END: &str = "# END Fuyu Agent Status Hooks (Kimi Code)";
const CONFIG_FILE: &str = "config.toml";

pub(super) fn hook_block(running_script: &Path, status_script: &Path) -> String {
    let hooks = [
        ("UserPromptSubmit", agent_running_command(running_script, PROVIDER), 5),
        ("PermissionRequest", agent_running_command_with(running_script, PROVIDER, AGENT_RUNNING_NOTIFICATION_ARG), 5),
        ("Stop", agent_status_command(status_script, PROVIDER, "completed"), 10),
        ("Interrupt", agent_status_command(status_script, PROVIDER, "completed"), 10),
        ("StopFailure", agent_status_command(status_script, PROVIDER, "failed"), 10),
    ];
    let entries: Vec<String> = hooks
        .iter()
        .map(|(event, command, timeout)| {
            format!(
                "[[hooks]]\nevent = \"{event}\"\ncommand = {}\ntimeout = {timeout}",
                toml_basic_string(command)
            )
        })
        .collect();
    format!("{BLOCK_BEGIN}\n{}\n{BLOCK_END}", entries.join("\n\n"))
}

pub(super) fn with_block(content: &str, block: &str) -> Result<String, String> {
    let rest = remove_hook_blocks(content, BLOCK_BEGIN, BLOCK_END);
    if has_inline_hooks(&rest) {
        return Err("Kimi Code config.toml sets hooks as an inline array; the island cannot add [[hooks]] next to it. Move them to [[hooks]] tables first".to_string());
    }
    let mut next = rest.trim_end().to_string();
    if !next.is_empty() {
        next.push_str("\n\n");
    }
    next.push_str(block);
    next.push('\n');
    Ok(next)
}

fn has_inline_hooks(content: &str) -> bool {
    let mut top_level = true;
    for line in content.lines().map(str::trim) {
        if line.starts_with('[') {
            top_level = false;
        } else if top_level && line.strip_prefix("hooks").is_some_and(|rest| rest.trim_start().starts_with('=')) {
            return true;
        }
    }
    false
}

pub(super) fn install(env: &HookEnv) -> Result<(), String> {
    let dir = home(env.home_dir);
    if !dir.is_dir() {
        return Ok(());
    }
    install_into(&dir, &hook_block(env.running_script, env.status_script))
}

pub(super) fn install_into(dir: &Path, block: &str) -> Result<(), String> {
    let path = dir.join(CONFIG_FILE);
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(format!("Failed to read Kimi Code config.toml: {error}")),
    };
    let next = with_block(&content, block)?;
    if next != content {
        write_text_file(&path, &next)?;
    }
    Ok(())
}

pub(super) fn check(env: &HookEnv) -> HookInstallState {
    let dir = home(env.home_dir);
    if !dir.is_dir() {
        return HookInstallState::Absent;
    }
    let Ok(content) = fs::read_to_string(dir.join(CONFIG_FILE)) else {
        return HookInstallState::NotInstalled;
    };
    block_state(&content, &hook_block(env.running_script, env.status_script))
}

pub(super) fn block_state(content: &str, block: &str) -> HookInstallState {
    let content = normalize_windows_line_endings(content);
    if content.contains(&normalize_windows_line_endings(block)) {
        HookInstallState::Current
    } else if content.contains(BLOCK_BEGIN) || is_island_hook_text(&content) {
        HookInstallState::Outdated
    } else {
        HookInstallState::NotInstalled
    }
}
