use serde_json::{json, Map, Value};
use std::{fs, path::Path};

use super::{
    write_text_file, AGENT_RUNNING_NOTIFICATION_ARG, AGENT_SESSION_SCRIPT_FILE_NAME,
    AGENT_HOOK_SIGNATURE,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ApprovalHook {
    pub url: String,
    pub question_url: Option<String>,
    pub activity_url: Option<String>,
    pub token: String,
}

pub(super) const ACTIVITY_EVENTS: [&str; 6] = ["PostToolUse", "PostToolUseFailure", "PermissionDenied", "Stop", "SubagentStop", "UserPromptSubmit"];

pub(super) const APPROVAL_HOOK_TIMEOUT_SECONDS: i64 = 150;

pub(super) const APPROVAL_HOOK_MARKER_HEADER: &str = "X-Fuyu-Hook";

pub(super) fn install_claude_code_status_hooks(
    config_path: &Path,
    running_script_path: &Path,
    status_script_path: &Path,
    approval: Option<&ApprovalHook>,
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

    install_claude_code_hook_events(
        hooks,
        claude_code_installed_entries(running_script_path, status_script_path, approval),
    );

    let json = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Failed to serialize Claude Code settings.json: {error}"))?;
    write_text_file(config_path, &json)
}

pub(super) const CLAUDE_CODE_WAITING_NOTIFICATIONS: &str =
    "permission_prompt|elicitation_dialog|agent_needs_input";

pub(super) fn claude_code_hook_entries(
    running_script_path: &Path,
    status_script_path: &Path,
) -> Vec<(&'static str, Value)> {
    let mut notification = claude_code_running_hook_entry(running_script_path);
    if let Some(args) = notification["hooks"][0]["args"].as_array_mut() {
        args.push(Value::String(AGENT_RUNNING_NOTIFICATION_ARG.to_string()));
    }
    if let Value::Object(object) = &mut notification {
        object.insert(
            "matcher".to_string(),
            Value::String(CLAUDE_CODE_WAITING_NOTIFICATIONS.to_string()),
        );
    }

    let mut permission = claude_code_running_hook_entry(running_script_path);
    if let Some(args) = permission["hooks"][0]["args"].as_array_mut() {
        args.push(Value::String(AGENT_RUNNING_NOTIFICATION_ARG.to_string()));
    }

    let compaction = || {
        let mut entry = claude_code_running_hook_entry(running_script_path);
        if let Some(args) = entry["hooks"][0]["args"].as_array_mut() {
            args.push(Value::String(AGENT_RUNNING_NOTIFICATION_ARG.to_string()));
        }
        entry
    };

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
    if let Some(approval) = approval {
        entries.push(("PermissionRequest", claude_code_http_hook_entry(&approval.url, &approval.token, "approval")));
        if let Some(question_url) = &approval.question_url {
            let mut question = claude_code_http_hook_entry(question_url, &approval.token, "question");
            if let Value::Object(object) = &mut question {
                object.insert("matcher".to_string(), Value::String("AskUserQuestion".to_string()));
            }
            entries.push(("PreToolUse", question));
        }
        if let Some(activity_url) = &approval.activity_url {
            for event_name in ACTIVITY_EVENTS {
                entries.push((event_name, claude_code_activity_hook_entry(activity_url, &approval.token)));
            }
        }
    }
    entries
}

fn claude_code_activity_hook_entry(url: &str, token: &str) -> Value {
    let args = [
        "-s",
        "-o",
        "NUL",
        "--connect-timeout",
        "1",
        "-m",
        "5",
        "-H",
        &format!("Authorization: Bearer {token}"),
        "-H",
        "Content-Type: application/json",
        "-H",
        &format!("{APPROVAL_HOOK_MARKER_HEADER}: {AGENT_HOOK_SIGNATURE}activity"),
        "--data-binary",
        "@-",
        url,
    ];
    let mut entry = claude_code_hook_entry("curl.exe", args.iter().map(|arg| arg.to_string()).collect(), 10);
    if let Some(hook) = entry["hooks"][0].as_object_mut() {
        hook.insert("async".to_string(), Value::Bool(true));
    }
    entry
}

fn claude_code_http_hook_entry(url: &str, token: &str, marker: &str) -> Value {
    json!({
        "hooks": [
            {
                "type": "http",
                "url": url,
                "headers": {
                    "Authorization": format!("Bearer {token}"),
                    APPROVAL_HOOK_MARKER_HEADER: format!("{AGENT_HOOK_SIGNATURE}{marker}"),
                },
                "timeout": APPROVAL_HOOK_TIMEOUT_SECONDS
            }
        ]
    })
}

pub(super) fn install_claude_code_hook_events(
    hooks: &mut Map<String, Value>,
    entries: Vec<(&'static str, Value)>,
) {
    let mut cleared: Vec<&str> = Vec::new();
    for (event_name, entry) in entries {
        if !cleared.contains(&event_name) {
            cleared.push(event_name);
            let kept = unmanaged_entries(hooks, event_name);
            hooks.insert(event_name.to_string(), Value::Array(kept));
        }
        if let Some(Value::Array(list)) = hooks.get_mut(event_name) {
            list.push(entry);
        }
    }
    let others: Vec<String> = hooks.keys().filter(|name| !cleared.contains(&name.as_str())).cloned().collect();
    for event_name in others {
        if !matches!(hooks.get(&event_name), Some(Value::Array(list)) if list.iter().any(value_contains_focusd_hook_signature)) {
            continue;
        }
        let kept = unmanaged_entries(hooks, &event_name);
        if !kept.is_empty() {
            hooks.insert(event_name, Value::Array(kept));
        }
    }
}

fn unmanaged_entries(hooks: &mut Map<String, Value>, event_name: &str) -> Vec<Value> {
    hooks
        .remove(event_name)
        .and_then(|value| match value {
            Value::Array(entries) => Some(entries),
            _ => None,
        })
        .unwrap_or_default()
        .into_iter()
        .filter_map(remove_managed_claude_code_hooks)
        .collect()
}

pub(super) fn remove_managed_claude_code_hooks(mut entry: Value) -> Option<Value> {
    let Value::Object(entry_object) = &mut entry else {
        return Some(entry);
    };

    let Some(hooks_value) = entry_object.get_mut("hooks") else {
        return Some(entry);
    };

    let Value::Array(hooks) = hooks_value else {
        return Some(entry);
    };

    hooks.retain(|hook| !value_contains_focusd_hook_signature(hook));
    if hooks.is_empty() {
        None
    } else {
        Some(entry)
    }
}

pub(super) fn value_contains_focusd_hook_signature(value: &Value) -> bool {
    match value {
        Value::String(text) => super::is_island_hook_text(text),
        Value::Array(values) => values.iter().any(value_contains_focusd_hook_signature),
        Value::Object(values) => values.values().any(value_contains_focusd_hook_signature),
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
    let args = vec![
        "/d".to_string(),
        "/c".to_string(),
        script_path.to_string_lossy().to_string(),
        "claudeCode".to_string(),
    ];
    claude_code_hook_entry("cmd.exe", args, 1)
}

pub(super) fn claude_code_status_hook_entry(script_path: &Path, phase: &str) -> Value {
    claude_code_hook_entry(
        "powershell.exe",
        vec![
            "-NoProfile".to_string(),
            "-ExecutionPolicy".to_string(),
            "Bypass".to_string(),
            "-File".to_string(),
            script_path.to_string_lossy().to_string(),
            "claudeCode".to_string(),
            phase.to_string(),
        ],
        5,
    )
}

pub(super) fn claude_code_session_hook_entry(script_path: &Path, event: &str) -> Value {
    claude_code_hook_entry(
        "powershell.exe",
        vec![
            "-NoProfile".to_string(),
            "-ExecutionPolicy".to_string(),
            "Bypass".to_string(),
            "-File".to_string(),
            script_path.to_string_lossy().to_string(),
            "claudeCode".to_string(),
            event.to_string(),
        ],
        15,
    )
}

pub(super) fn claude_code_hook_entry(command: &str, args: Vec<String>, timeout: i64) -> Value {
    json!({
        "hooks": [
            {
                "type": "command",
                "command": command,
                "args": args,
                "timeout": timeout
            }
        ]
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn running_hook_passes_script_path_as_unquoted_argument() {
        let path = Path::new(r"C:\Users\a b\focusd-agent-running.cmd");
        let entry = claude_code_running_hook_entry(path);
        let args = entry["hooks"][0]["args"].as_array().unwrap();

        assert_eq!(
            args,
            &vec![
                json!("/d"),
                json!("/c"),
                json!(r"C:\Users\a b\focusd-agent-running.cmd"),
                json!("claudeCode"),
            ]
        );
        assert!(args.iter().all(|arg| !arg.as_str().unwrap().contains('"')));
    }

    #[test]
    fn only_waiting_notifications_save_their_input() {
        let running = Path::new(r"C:\focusd-agent-running.cmd");
        let status = Path::new(r"C:\focusd-agent-status.ps1");
        let mut hooks = Map::new();
        install_claude_code_hook_events(&mut hooks, claude_code_hook_entries(running, status));

        let last_arg = |event: &str| {
            hooks[event][0]["hooks"][0]["args"]
                .as_array()
                .unwrap()
                .last()
                .cloned()
        };
        assert_eq!(last_arg("UserPromptSubmit"), Some(json!("claudeCode")));
        assert_eq!(last_arg("PreToolUse"), Some(json!("claudeCode")));
        assert_eq!(last_arg("Notification"), Some(json!("notification")));
        assert_eq!(
            hooks["Notification"][0]["matcher"],
            json!("permission_prompt|elicitation_dialog|agent_needs_input")
        );
        assert_eq!(last_arg("Stop"), Some(json!("completed")));
        assert_eq!(last_arg("SessionStart"), Some(json!("start")));
        assert_eq!(hooks["SessionStart"][0]["hooks"][0]["async"], json!(true));
        assert_eq!(last_arg("SessionEnd"), Some(json!("end")));
        assert!(hooks["SessionEnd"][0]["hooks"][0].get("async").is_none());
        assert!(hooks["SessionStart"][0]["hooks"][0]["args"][4]
            .as_str()
            .is_some_and(|path| path.ends_with("fuyu-agent-session.ps1")));
        assert_eq!(last_arg("PermissionRequest"), Some(json!("notification")));
        assert!(hooks["PermissionRequest"][0].get("matcher").is_none());
    }

    #[test]
    fn approval_hook_sits_beside_the_status_hook_and_repair_replaces_it() {
        let running = Path::new(r"C:\focusd-agent-running.cmd");
        let status = Path::new(r"C:\focusd-agent-status.ps1");
        let approval = |port: u16| ApprovalHook {
            url: format!("http://127.0.0.1:{port}/claude/permission-request"),
            question_url: Some(format!("http://127.0.0.1:{port}/claude/ask-user-question")),
            activity_url: Some(format!("http://127.0.0.1:{port}/claude/activity")),
            token: "t".to_string(),
        };
        let mine = json!({ "hooks": [{ "type": "command", "command": "my-own-hook" }] });
        let mut hooks = Map::new();
        hooks.insert("PermissionRequest".to_string(), json!([mine]));

        install_claude_code_hook_events(&mut hooks, claude_code_installed_entries(running, status, Some(&approval(47830))));
        install_claude_code_hook_events(&mut hooks, claude_code_installed_entries(running, status, Some(&approval(51000))));

        let entries = hooks["PermissionRequest"].as_array().unwrap();
        assert_eq!(entries.len(), 3, "the user's hook, the status hook and the approval hook");
        assert_eq!(entries[0], mine);
        assert_eq!(entries[1]["hooks"][0]["type"], json!("command"));
        let hook = &entries[2]["hooks"][0];
        assert_eq!(hook["type"], json!("http"));
        assert_eq!(hook["url"], json!("http://127.0.0.1:51000/claude/permission-request"));
        assert_eq!(hook["headers"]["Authorization"], json!("Bearer t"));
        assert_eq!(hook["timeout"], json!(APPROVAL_HOOK_TIMEOUT_SECONDS));
        assert!(value_contains_focusd_hook_signature(hook));

        let pre_tool = hooks["PreToolUse"].as_array().unwrap();
        assert_eq!(pre_tool.len(), 2, "the status hook and the question hook");
        assert_eq!(pre_tool[0]["matcher"], json!("*"));
        assert_eq!(pre_tool[1]["matcher"], json!("AskUserQuestion"));
        let question = &pre_tool[1]["hooks"][0];
        assert_eq!(question["url"], json!("http://127.0.0.1:51000/claude/ask-user-question"));
        assert_eq!(question["timeout"], json!(APPROVAL_HOOK_TIMEOUT_SECONDS));
        assert!(value_contains_focusd_hook_signature(question));

        for event in ACTIVITY_EVENTS {
            let activity = &hooks[event].as_array().unwrap().last().unwrap()["hooks"][0];
            assert_eq!((activity["command"].as_str(), activity["async"].as_bool()), (Some("curl.exe"), Some(true)), "{event}");
            assert_eq!(activity["args"].as_array().unwrap().last(), Some(&json!("http://127.0.0.1:51000/claude/activity")));
            assert!(activity["args"].as_array().unwrap().contains(&json!("@-")) && value_contains_focusd_hook_signature(activity));
        }
        assert_eq!(hooks["Stop"].as_array().unwrap().len(), 2, "the status hook and one activity hook");
        assert_eq!(hooks["PostToolUse"].as_array().unwrap().len(), 1);

        install_claude_code_hook_events(&mut hooks, claude_code_installed_entries(running, status, None));
        assert_eq!(hooks["PermissionRequest"].as_array().unwrap().len(), 2);
        assert_eq!(hooks["PreToolUse"].as_array().unwrap().len(), 1);
        assert_eq!(hooks["Stop"].as_array().unwrap().len(), 1);
        assert!(hooks.get("PostToolUse").is_none() && hooks.get("PermissionDenied").is_none(), "emptied events are dropped");
    }
}
