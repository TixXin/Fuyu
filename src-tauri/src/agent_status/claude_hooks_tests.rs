use super::*;

fn approval(port: u16) -> ApprovalHook {
    ApprovalHook {
        url: format!("http://127.0.0.1:{port}/claude/permission-request"),
        question_url: Some(format!("http://127.0.0.1:{port}/claude/ask-user-question")),
        activity_url: Some(format!("http://127.0.0.1:{port}/claude/activity")),
        token: "t".to_string(),
    }
}

fn paths() -> (&'static Path, &'static Path) {
    if cfg!(windows) {
        (Path::new(r"C:\Users\a b\fuyu-agent-running.cmd"), Path::new(r"C:\Users\a b\fuyu-agent-status.ps1"))
    } else {
        (Path::new("/Users/a b/.fuyu/fuyu-agent-running.sh"), Path::new("/Users/a b/.fuyu/fuyu-agent-status.sh"))
    }
}

#[test]
fn every_hook_is_one_command_string_without_args() {
    let (running, status) = paths();
    for (event, entry) in claude_code_installed_entries(running, status, Some(&approval(51000))) {
        for hook in entry["hooks"].as_array().unwrap() {
            assert!(hook.get("args").is_none(), "{event}: {hook}");
            if hook["type"] == json!("command") {
                let command = hook["command"].as_str().unwrap();
                assert!(command.contains("fuyu-agent-") && command.contains("claudeCode"), "{event}: {command}");
                assert!(!command.contains("curl"), "{event}: {command}");
            }
        }
    }
}

#[test]
fn hooks_pass_the_waiting_notifications_and_phases() {
    let (running, status) = paths();
    let mut hooks = Map::new();
    install_claude_code_hook_events(&mut hooks, claude_code_hook_entries(running, status));
    let command = |event: &str| hooks[event][0]["hooks"][0]["command"].as_str().unwrap().replace('\'', "");
    assert!(command("UserPromptSubmit").ends_with("claudeCode") || command("UserPromptSubmit").ends_with("claudeCode || exit 0"));
    for event in ["Notification", "PermissionRequest", "PreCompact", "PostCompact"] {
        assert!(command(event).contains("claudeCode notification"), "{event}");
    }
    assert!(command("Stop").contains("fuyu-agent-status") && command("Stop").contains("claudeCode completed"));
    assert!(command("StopFailure").contains("claudeCode failed"));
    assert!(command("SessionStart").contains("fuyu-agent-session") && command("SessionStart").contains("claudeCode start"));
    assert_eq!(hooks["SessionStart"][0]["hooks"][0]["async"], json!(true));
    assert!(hooks["SessionEnd"][0]["hooks"][0].get("async").is_none());
    assert_eq!(hooks["Notification"][0]["matcher"], json!(CLAUDE_CODE_WAITING_NOTIFICATIONS));
    assert_eq!(hooks["PreToolUse"][0]["matcher"], json!("*"));
    assert!(hooks["PermissionRequest"][0].get("matcher").is_none());
}

#[cfg(windows)]
#[test]
fn windows_hooks_start_with_the_quoted_script_or_powershell() {
    let (running, status) = paths();
    let entries = claude_code_installed_entries(running, status, Some(&approval(51000)));
    let command = |event: &str| entries.iter().find(|(name, _)| *name == event).unwrap().1["hooks"][0]["command"].as_str().unwrap().to_string();
    assert_eq!(command("UserPromptSubmit"), r#""C:/Users/a b/fuyu-agent-running.cmd" claudeCode"#);
    assert_eq!(command("Stop"), r#"powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:/Users/a b/fuyu-agent-status.ps1" claudeCode completed"#);
    let activity = entries.iter().rev().find(|(name, _)| *name == "Stop").unwrap().1["hooks"][0].clone();
    assert_eq!(activity["command"], json!(r#""C:/Users/a b/fuyu-agent-running.cmd" claudeCode activity http://127.0.0.1:51000/claude/activity t"#));
    assert_eq!(activity["async"], json!(true));
    assert_eq!(claude_code_running_command(Path::new(r"C:\a$b\r.cmd"), &["claudeCode"]), "'C:/a$b/r.cmd' claudeCode");
}

#[test]
fn approval_hook_sits_beside_the_status_hook_and_repair_replaces_it() {
    let (running, status) = paths();
    let mine = json!({ "hooks": [{ "type": "command", "command": "my-own-hook" }] });
    let mut hooks = Map::new();
    hooks.insert("PermissionRequest".to_string(), json!([mine]));

    install_claude_code_hook_events(&mut hooks, claude_code_installed_entries(running, status, Some(&approval(47830))));
    install_claude_code_hook_events(&mut hooks, claude_code_installed_entries(running, status, Some(&approval(51000))));

    let entries = hooks["PermissionRequest"].as_array().unwrap();
    assert_eq!(entries.len(), 3, "the user's hook, the status hook and the approval hook");
    assert_eq!(entries[0], mine);
    let hook = &entries[2]["hooks"][0];
    assert_eq!((hook["type"].clone(), hook["url"].clone()), (json!("http"), json!("http://127.0.0.1:51000/claude/permission-request")));
    assert_eq!(hook["headers"]["Authorization"], json!("Bearer t"));
    let pre_tool = hooks["PreToolUse"].as_array().unwrap();
    assert_eq!(pre_tool[1]["matcher"], json!("AskUserQuestion"));

    for event in ACTIVITY_EVENTS {
        let activity = &hooks[event].as_array().unwrap().last().unwrap()["hooks"][0];
        let command = activity["command"].as_str().unwrap().replace('\'', "");
        assert!(command.contains("claudeCode activity http://127.0.0.1:51000/claude/activity t"), "{event}: {command}");
        assert_eq!(activity["async"], json!(true));
        assert!(is_approval_hook(activity) && value_contains_island_hook_signature(activity));
    }
    assert_eq!(hooks["Stop"].as_array().unwrap().len(), 2, "the status hook and one activity hook");

    install_claude_code_hook_events(&mut hooks, claude_code_installed_entries(running, status, None));
    assert_eq!(hooks["PermissionRequest"].as_array().unwrap().len(), 2);
    assert_eq!(hooks["Stop"].as_array().unwrap().len(), 1);
    assert!(hooks.get("PostToolUse").is_none() && hooks.get("PermissionDenied").is_none(), "emptied events are dropped");
}

#[test]
fn exec_form_hooks_from_older_versions_are_found_and_replaced() {
    let (running, status) = paths();
    let legacy = json!({ "type": "command", "command": "curl.exe", "args": ["-H", "X-Fuyu-Hook: fuyu-agent-activity", "--data-binary", "@-"], "async": true });
    let user_exec = json!({ "type": "command", "command": "node", "args": ["mine.js"] });
    let mut hooks = Map::new();
    hooks.insert("PostToolUse".to_string(), json!([{ "hooks": [legacy] }, { "hooks": [user_exec.clone()] }]));
    assert!(has_exec_form_hooks(&Value::Object(hooks.clone())));

    install_claude_code_hook_events(&mut hooks, claude_code_installed_entries(running, status, None));
    let after = Value::Object(hooks);
    assert!(!has_exec_form_hooks(&after));
    assert_eq!(after["PostToolUse"], json!([{ "hooks": [user_exec] }]), "the user's own exec hook stays");
}

#[cfg(not(windows))]
#[test]
fn mac_commands_run_the_script_and_fail_open_when_it_is_missing() {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let dir = std::env::temp_dir().join(format!("fuyu-claude-hooks-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(dir.join("a b")).unwrap();
    let script = dir.join("a b/fuyu-agent-running.sh");
    let run = |command: &str| {
        let mut child = Command::new("/bin/sh").arg("-c").arg(command).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();
        child.stdin.take().unwrap().write_all(b"{\"x\":\"$(echo injected)\"}\n").unwrap();
        child.wait_with_output().unwrap()
    };
    let command = claude_code_running_command(&script, &["claudeCode", "activity", "http://127.0.0.1:1/claude/activity", "t'k"]);

    let out = run(&command);
    assert!(out.status.success() && out.stdout.is_empty() && out.stderr.is_empty(), "{out:?}");

    fs::write(&script, "read line\nprintf '%s|' \"$@\" \"$line\"\n").unwrap();
    let out = run(&command);
    assert_eq!(String::from_utf8_lossy(&out.stdout), "claudeCode|activity|http://127.0.0.1:1/claude/activity|t'k|{\"x\":\"$(echo injected)\"}|");
    fs::remove_dir_all(&dir).unwrap();
}

#[cfg(not(windows))]
#[test]
fn mac_scripts_never_block_and_skip_claude_code_under_cursor() {
    use std::process::{Command, Stdio};

    let dir = std::env::temp_dir().join(format!("fuyu-claude-scripts-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    super::super::install_agent_hook_scripts(&dir).unwrap();
    let run = |script: &str, args: &[&str], cursor: bool| {
        let mut command = Command::new("/bin/sh");
        command.arg(dir.join(script)).args(args).env_remove("CURSOR_VERSION").env_remove("FOCUSD_AGENT_STATUS_DIR").env_remove("FOCUSD_AGENT_STATUS_PATH").stdin(Stdio::null());
        if cursor {
            command.env("CURSOR_VERSION", "3.1.0");
        }
        command.output().unwrap().status.code()
    };
    let running = super::super::AGENT_RUNNING_SCRIPT_FILE_NAME;
    let status = super::super::AGENT_STATUS_SCRIPT_FILE_NAME;
    let session = super::super::AGENT_SESSION_SCRIPT_FILE_NAME;

    for (script, args) in [(running, vec![]), (running, vec!["bad!"]), (running, vec!["antigravity", "x"]), (status, vec!["claudeCode", "x"]), (status, vec![""])] {
        assert_ne!(run(script, &args, false), Some(2), "{script} {args:?}");
    }

    assert_eq!(run(running, &["claudeCode"], true), Some(0));
    assert_eq!(run(status, &["claudeCode", "completed"], true), Some(0));
    assert_eq!(run(session, &["claudeCode", "start"], true), Some(0));
    assert!(!dir.join("agent-claudeCode-running.flag").exists() && !dir.join("agent-status.json").exists());

    assert_eq!(run(running, &["claudeCode", "activity", "http://127.0.0.1:1/claude/activity", "t"], false), Some(0));
    assert!(!dir.join("agent-claudeCode-running.flag").exists(), "activity does not mark the turn running");
    assert_eq!(run(running, &["claudeCode"], false), Some(0));
    assert!(dir.join("agent-claudeCode-running.flag").exists());
    fs::remove_dir_all(&dir).unwrap();
}
