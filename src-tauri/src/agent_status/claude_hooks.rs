use serde_json::{json, Map, Value};
use std::{fs, path::Path};

use super::{
    write_text_file, AGENT_APPROVAL_SCRIPT_FILE_NAME, AGENT_RUNNING_NOTIFICATION_ARG, AGENT_SESSION_SCRIPT_FILE_NAME,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ApprovalHook;

pub(super) const ACTIVITY_EVENTS: [&str; 6] = ["PostToolUse", "PostToolUseFailure", "PermissionDenied", "Stop", "SubagentStop", "UserPromptSubmit"];

pub(super) const APPROVAL_HOOK_TIMEOUT_SECONDS: i64 = 150;

pub(super) const APPROVAL_HOOK_MARKER_HEADER: &str = "X-Fuyu-Hook";

const APPROVAL_SCRIPT_STEM: &str = "fuyu-agent-approval";

pub(super) fn install_claude_code_status_hooks(
    config_path: &Path,
    running_script_path: &Path,
    status_script_path: &Path,
    approval: Option<&ApprovalHook>,
    keep_approval: bool,
) -> Result<(), String> {
    let mut config = match fs::read_to_string(config_path) {
        Ok(content) if !content.trim().is_empty() => serde_json::from_str::<Value>(&content)
            .map_err(|error| format!("Failed to parse Claude Code settings.json: {error}"))?,
        _ => json!({}),
    };

    let Some(root) = config.as_object_mut() else {
        return Err("Claude Code settings.json must contain a JSON object.".to_string());
    };

    let hooks = root
        .entry("hooks")
        .or_insert_with(|| Value::Object(Map::new()));
    if !hooks.is_object() {
        *hooks = Value::Object(Map::new());
    }
    let hooks = hooks
        .as_object_mut()
        .ok_or_else(|| "Failed to prepare Claude Code hooks object.".to_string())?;

    install_hook_events(
        hooks,
        claude_code_installed_entries(running_script_path, status_script_path, approval),
        keep_approval,
    );

    let json = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Failed to serialize Claude Code settings.json: {error}"))?;
    write_text_file(config_path, &json)
}

pub(super) fn uninstall_claude_code_status_hooks(config_path: &Path) -> Result<(), String> {
    uninstall_nested_json_hooks(config_path, "Claude Code", "settings.json")
}

pub(super) fn uninstall_nested_json_hooks(
    config_path: &Path,
    label: &str,
    file_label: &str,
) -> Result<(), String> {
    let content = match fs::read_to_string(config_path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Failed to read {label} {file_label}: {error}")),
    };
    let trimmed = content.trim_start_matches('\u{feff}').trim();
    if trimmed.is_empty() {
        return Ok(());
    }
    let original: Value = serde_json::from_str(trimmed)
        .map_err(|error| format!("Failed to parse {label} {file_label}: {error}"))?;
    let mut config = original.clone();
    let Some(root) = config.as_object_mut() else {
        return Err(format!("{label} {file_label} must contain a JSON object."));
    };
    if let Some(Value::Object(hooks)) = root.get_mut("hooks") {
        install_claude_code_hook_events(hooks, Vec::new());
    }
    if Some(&*root) == original.as_object() {
        return Ok(());
    }
    if root.get("hooks").and_then(Value::as_object).is_some_and(Map::is_empty) {
        root.remove("hooks");
    }
    let json = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Failed to serialize {label} {file_label}: {error}"))?;
    write_text_file(config_path, &json)
}

pub(super) const CLAUDE_CODE_WAITING_NOTIFICATIONS: &str =
    "permission_prompt|elicitation_dialog|agent_needs_input";

pub(super) fn claude_code_hook_entries(
    running_script_path: &Path,
    status_script_path: &Path,
) -> Vec<(&'static str, Value)> {
    let notification_arg = [AGENT_RUNNING_NOTIFICATION_ARG];
    let mut notification = claude_code_running_hook_entry_with(running_script_path, &notification_arg);
    if let Value::Object(object) = &mut notification {
        object.insert(
            "matcher".to_string(),
            Value::String(CLAUDE_CODE_WAITING_NOTIFICATIONS.to_string()),
        );
    }
    let permission = claude_code_running_hook_entry_with(running_script_path, &notification_arg);
    let compaction = || claude_code_running_hook_entry_with(running_script_path, &notification_arg);

    let session_script_path = status_script_path.with_file_name(AGENT_SESSION_SCRIPT_FILE_NAME);
    let mut session_start = claude_code_session_hook_entry(&session_script_path, "start");
    if let Some(hook) = session_start["hooks"][0].as_object_mut() {
        hook.insert("async".to_string(), Value::Bool(true));
    }

    vec![
        ("SessionStart", session_start),
        ("SessionEnd", claude_code_session_hook_entry(&session_script_path, "end")),
        ("PermissionRequest", permission),
        (
            "UserPromptSubmit",
            claude_code_running_hook_entry(running_script_path),
        ),
        (
            "PreToolUse",
            claude_code_match_all_hook_entry(claude_code_running_hook_entry(running_script_path)),
        ),
        ("Notification", notification),
        ("PreCompact", compaction()),
        ("PostCompact", compaction()),
        (
            "Stop",
            claude_code_status_hook_entry(status_script_path, "completed"),
        ),
        (
            "StopFailure",
            claude_code_status_hook_entry(status_script_path, "failed"),
        ),
    ]
}

pub(super) fn claude_code_installed_entries(
    running_script_path: &Path,
    status_script_path: &Path,
    approval: Option<&ApprovalHook>,
) -> Vec<(&'static str, Value)> {
    let mut entries = claude_code_hook_entries(running_script_path, status_script_path);
    if approval.is_some() {
        let approval_script = running_script_path.with_file_name(AGENT_APPROVAL_SCRIPT_FILE_NAME);
        entries.push(("PermissionRequest", claude_code_approval_hook_entry(&approval_script, None, APPROVAL_HOOK_TIMEOUT_SECONDS)));
        let mut question = claude_code_approval_hook_entry(&approval_script, Some(QUESTION_ARG), APPROVAL_HOOK_TIMEOUT_SECONDS);
        if let Value::Object(object) = &mut question {
            object.insert("matcher".to_string(), Value::String("AskUserQuestion".to_string()));
        }
        entries.push(("PreToolUse", question));
        for event_name in ACTIVITY_EVENTS {
            let mut activity = claude_code_approval_hook_entry(&approval_script, Some(ACTIVITY_ARG), 10);
            if let Some(hook) = activity["hooks"][0].as_object_mut() {
                hook.insert("async".to_string(), Value::Bool(true));
            }
            entries.push((event_name, activity));
        }
    }
    entries
}

fn claude_code_approval_hook_entry(approval_script: &Path, mode: Option<&str>, timeout: i64) -> Value {
    let args: Vec<&str> = std::iter::once(super::claude_code::PROVIDER).chain(mode).collect();
    command_hook_entry(claude_code_powershell_command(approval_script, &args), timeout)
}

pub(super) const ACTIVITY_ARG: &str = "activity";

const QUESTION_ARG: &str = "question";

#[cfg(windows)]
fn quoted_script(path: &Path) -> String {
    let text = path.to_string_lossy().replace('\\', "/");
    if text.contains('$') || text.contains('`') {
        format!("'{text}'")
    } else {
        format!("\"{text}\"")
    }
}

#[cfg(windows)]
pub(super) fn claude_code_running_command(script_path: &Path, rest: &[&str]) -> String {
    std::iter::once(quoted_script(script_path)).chain(rest.iter().map(|arg| (*arg).to_string())).collect::<Vec<_>>().join(" ")
}

#[cfg(windows)]
fn claude_code_powershell_command(script_path: &Path, rest: &[&str]) -> String {
    let mut command = format!("powershell.exe -NoProfile -ExecutionPolicy Bypass -File {}", quoted_script(script_path));
    for arg in rest {
        command.push(' ');
        command.push_str(arg);
    }
    command
}

#[cfg(not(windows))]
fn shell_quoted(text: &str) -> String {
    format!("'{}'", text.replace('\'', "'\\''"))
}

#[cfg(not(windows))]
pub(super) fn claude_code_running_command(script_path: &Path, rest: &[&str]) -> String {
    let script = shell_quoted(&script_path.to_string_lossy());
    let rest: String = rest.iter().map(|arg| format!(" {}", shell_quoted(arg))).collect();
    format!("[ -f {script} ] && exec /bin/sh {script}{rest} || exit 0")
}

#[cfg(not(windows))]
fn claude_code_powershell_command(script_path: &Path, rest: &[&str]) -> String {
    claude_code_running_command(script_path, rest)
}

pub(super) fn install_claude_code_hook_events(
    hooks: &mut Map<String, Value>,
    entries: Vec<(&'static str, Value)>,
) {
    install_hook_events(hooks, entries, false);
}

fn install_hook_events(hooks: &mut Map<String, Value>, entries: Vec<(&'static str, Value)>, keep_approval: bool) {
    let mut cleared: Vec<&str> = Vec::new();
    for (event_name, entry) in entries {
        if !cleared.contains(&event_name) {
            cleared.push(event_name);
            let kept = unmanaged_entries(hooks, event_name, keep_approval);
            hooks.insert(event_name.to_string(), Value::Array(kept));
        }
        if let Some(Value::Array(list)) = hooks.get_mut(event_name) {
            list.push(entry);
        }
    }
    let others: Vec<String> = hooks.keys().filter(|name| !cleared.contains(&name.as_str())).cloned().collect();
    for event_name in others {
        if !matches!(hooks.get(&event_name), Some(Value::Array(list)) if list.iter().any(value_contains_island_hook_signature)) {
            continue;
        }
        let kept = unmanaged_entries(hooks, &event_name, keep_approval);
        if !kept.is_empty() {
            hooks.insert(event_name, Value::Array(kept));
        }
    }
}

fn unmanaged_entries(hooks: &mut Map<String, Value>, event_name: &str, keep_approval: bool) -> Vec<Value> {
    hooks
        .remove(event_name)
        .and_then(|value| match value {
            Value::Array(entries) => Some(entries),
            _ => None,
        })
        .unwrap_or_default()
        .into_iter()
        .filter_map(|entry| remove_managed(entry, keep_approval))
        .collect()
}

fn is_approval_hook(hook: &Value) -> bool {
    let text = hook.to_string();
    text.contains(APPROVAL_HOOK_MARKER_HEADER) || text.contains("/claude/activity") || text.contains(APPROVAL_SCRIPT_STEM)
}

fn remove_managed(mut entry: Value, keep_approval: bool) -> Option<Value> {
    let Value::Object(entry_object) = &mut entry else {
        return Some(entry);
    };

    let Some(hooks_value) = entry_object.get_mut("hooks") else {
        return Some(entry);
    };

    let Value::Array(hooks) = hooks_value else {
        return Some(entry);
    };

    hooks.retain(|hook| !value_contains_island_hook_signature(hook) || (keep_approval && is_approval_hook(hook)));
    if hooks.is_empty() {
        None
    } else {
        Some(entry)
    }
}

pub(super) fn value_contains_island_hook_signature(value: &Value) -> bool {
    match value {
        Value::String(text) => super::is_island_hook_text(text) || text.contains(APPROVAL_HOOK_MARKER_HEADER),
        Value::Array(values) => values.iter().any(value_contains_island_hook_signature),
        Value::Object(values) => {
            values.keys().any(|key| key == APPROVAL_HOOK_MARKER_HEADER)
                || values.values().any(value_contains_island_hook_signature)
        }
        _ => false,
    }
}

pub(super) fn claude_code_match_all_hook_entry(mut entry: Value) -> Value {
    if let Value::Object(object) = &mut entry {
        object.insert("matcher".to_string(), Value::String("*".to_string()));
    }

    entry
}

pub(super) fn claude_code_running_hook_entry(script_path: &Path) -> Value {
    claude_code_running_hook_entry_with(script_path, &[])
}

fn claude_code_running_hook_entry_with(script_path: &Path, rest: &[&str]) -> Value {
    let args: Vec<&str> = std::iter::once(super::claude_code::PROVIDER).chain(rest.iter().copied()).collect();
    command_hook_entry(claude_code_running_command(script_path, &args), 5)
}

pub(super) fn claude_code_status_hook_entry(script_path: &Path, phase: &str) -> Value {
    command_hook_entry(claude_code_powershell_command(script_path, &[super::claude_code::PROVIDER, phase]), 5)
}

pub(super) fn claude_code_session_hook_entry(script_path: &Path, event: &str) -> Value {
    command_hook_entry(claude_code_powershell_command(script_path, &[super::claude_code::PROVIDER, event]), 15)
}

pub(super) fn has_exec_form_hooks(hooks: &Value) -> bool {
    hooks.as_object().is_some_and(|events| {
        events.values().filter_map(Value::as_array).flatten().filter_map(|entry| entry["hooks"].as_array()).flatten().any(|hook| hook.get("args").is_some() && value_contains_island_hook_signature(hook))
    })
}

pub(super) fn has_fixed_port_hooks(hooks: &Value) -> bool {
    hooks.as_object().is_some_and(|events| {
        events.values().filter_map(Value::as_array).flatten().filter_map(|entry| entry["hooks"].as_array()).flatten().any(|hook| {
            value_contains_island_hook_signature(hook) && (hook["type"] == "http" || hook.to_string().contains("/claude/activity"))
        })
    })
}

pub(super) fn command_hook_entry(command: String, timeout: i64) -> Value {
    json!({ "hooks": [{ "type": "command", "command": command, "timeout": timeout }] })
}

pub(super) fn turn_hook_entries(
    running_script_path: &Path,
    status_script_path: &Path,
    provider: &str,
) -> Vec<(&'static str, Value)> {
    use super::codex_hooks::{agent_running_command, agent_status_command};
    let running = || command_hook_entry(agent_running_command(running_script_path, provider), 5);
    vec![
        ("UserPromptSubmit", running()),
        ("PreToolUse", claude_code_match_all_hook_entry(running())),
        ("Stop", command_hook_entry(agent_status_command(status_script_path, provider, "completed"), 10)),
    ]
}

#[cfg(test)]
#[path = "claude_hooks_tests.rs"]
mod tests;
