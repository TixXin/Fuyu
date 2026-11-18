use super::*;
use crate::agent_status::{AGENT_RUNNING_SCRIPT_FILE_NAME, AGENT_STATUS_SCRIPT_FILE_NAME};
use std::time::{Duration, SystemTime};

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-trae-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn save(app_dir: &Path, edition: &Edition, name: &str, input: Value, ago_ms: u64) {
    let dir = app_dir.join(edition.saved_dir);
    fs::create_dir_all(&dir).unwrap();
    let path = dir.join(name);
    fs::write(&path, input.to_string()).unwrap();
    let file = fs::File::options().write(true).open(&path).unwrap();
    file.set_modified(SystemTime::now() - Duration::from_millis(ago_ms)).unwrap();
}

fn hook(event: &str, session: &str, extra: Value) -> Value {
    let mut input = json!({
        "hook_event_name": event,
        "session_id": session,
        "cwd": "/Users/dev/shop",
        "workspace_roots": ["/Users/dev/shop"],
        "agent_id": "solo_agent",
        "agent_type": "agent",
    });
    if let (Some(input), Some(extra)) = (input.as_object_mut(), extra.as_object()) {
        input.extend(extra.clone());
    }
    input
}

fn now() -> i64 {
    system_time_to_unix_millis(SystemTime::now()).unwrap()
}

#[test]
fn a_session_is_pieced_together_from_its_hook_inputs() {
    let app_dir = temp_dir("sessions");
    let roots = ScanRoots { home_dir: &app_dir, local_app_dir: Some(&app_dir) };
    save(&app_dir, &TRAE_CN, "running-1.json", hook("UserPromptSubmit", "s1", json!({ "prompt": "把购物车改成深色" })), 9_000);
    save(&app_dir, &TRAE_CN, "running-2.json", hook("PreToolUse", "s1", json!({ "tool_name": "RunCommand", "tool_input": { "command": "npm test" } })), 8_000);
    save(&app_dir, &TRAE_CN, "stop-3.json", hook("Stop", "s1", json!({ "last_assistant_message": "改好了。\n\n✓" })), 7_000);
    save(&app_dir, &TRAE_CN, "running-4.json", hook("UserPromptSubmit", "s1", json!({ "prompt": "再加个按钮" })), 3_000);
    save(&app_dir, &TRAE_CN, "running-5.json", hook("PreToolUse", "s1", json!({ "tool_name": "Edit", "tool_input": { "file_path": "/Users/dev/shop/src/cart.tsx" } })), 2_000);
    save(&app_dir, &TRAE, "running-1.json", hook("UserPromptSubmit", "other", json!({ "prompt": "intl" })), 1_000);

    let listed = sessions(&TRAE_CN, &roots, now(), 60 * 60 * 1000);
    assert_eq!(listed.len(), 1);
    let session = &listed[0];
    assert_eq!((session.provider, session.session_id.as_str()), ("traeCn", "s1"));
    assert_eq!(session.title.as_deref(), Some("把购物车改成深色"));
    assert_eq!(session.last_prompt.as_deref(), Some("再加个按钮"));
    assert_eq!(session.cwd.as_deref(), Some("/Users/dev/shop"));
    assert_eq!(session.phase, "running");
    assert_eq!(session.last_message, None);
    let tool = session.current_tool.as_ref().unwrap();
    assert_eq!((tool.name.as_str(), tool.detail.as_deref()), ("Edit", Some("cart.tsx")));
    let saved = app_dir.join(TRAE_CN.saved_dir);
    assert!(!saved.join("running-2.json").exists() && !saved.join("stop-3.json").exists());
    assert!(saved.join("running-1.json").exists() && saved.join("running-4.json").exists());

    save(&app_dir, &TRAE_CN, "stop-6.json", hook("Stop", "s1", json!({ "last_assistant_message": "按钮加好了，要不要改颜色？\n\n↩" })), 1_000);
    let session = sessions(&TRAE_CN, &roots, now(), 60 * 60 * 1000).remove(0);
    assert_eq!(session.phase, "completed");
    assert_eq!(session.current_tool, None);
    assert_eq!(session.reply_marker, Some("yourTurn"));
    assert_eq!(session.title.as_deref(), Some("把购物车改成深色"));
    assert_eq!(sessions(&TRAE, &roots, now(), 60 * 60 * 1000).len(), 1);

    let mirror = ScanRoots { home_dir: &app_dir, local_app_dir: None };
    assert!(sessions(&TRAE_CN, &mirror, now(), 60 * 60 * 1000).is_empty());
    fs::remove_dir_all(&app_dir).unwrap();
}

#[test]
fn shows_the_command_and_short_file_names() {
    let call = |input: Value| tool_call(&hook("PreToolUse", "s", input)).unwrap();
    let run = call(json!({ "tool_name": "RunCommand", "tool_input": { "command": "cargo test --lib" } }));
    assert_eq!(run.detail.as_deref(), Some("cargo test --lib"));
    let read = call(json!({ "tool_name": "Read", "tool_input": { "path": "C:\\work\\a.rs" } }));
    assert_eq!(read.detail.as_deref(), Some("a.rs"));
    assert_eq!(call(json!({ "tool_name": "Todo", "tool_input": {} })).detail, None);
}

#[test]
fn installs_into_each_editions_hooks_json() {
    let home = temp_dir("hooks");
    let running = home.join(".fuyu").join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status = home.join(".fuyu").join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
    install_hooks(&TRAE, &env).unwrap();
    assert!(!hooks_path(&TRAE, &home).exists());
    assert_eq!(hooks_state(&TRAE, &env), HookInstallState::Absent);

    fs::create_dir_all(home.join(".trae-cn")).unwrap();
    assert_eq!(hooks_state(&TRAE_CN, &env), HookInstallState::NotInstalled);
    fs::write(
        hooks_path(&TRAE_CN, &home),
        r#"{"version":2,"hooks":{"Stop":[{"matcher":"*","hooks":[{"type":"command","command":"mine"}]}]}}"#,
    )
    .unwrap();
    install_hooks(&TRAE_CN, &env).unwrap();
    install_hooks(&TRAE_CN, &env).unwrap();
    assert_eq!(hooks_state(&TRAE_CN, &env), HookInstallState::Current);
    assert_eq!(hooks_state(&TRAE, &env), HookInstallState::Absent);

    let config = read_config(&hooks_path(&TRAE_CN, &home)).unwrap();
    assert_eq!(config["version"], 2);
    let hooks = &config["hooks"];
    assert_eq!(hooks["Stop"][0]["hooks"][0]["command"], "mine");
    let command = |entry: &Value| entry["hooks"][0]["command"].as_str().unwrap().to_string();
    assert!(command(&hooks["UserPromptSubmit"][0]).contains("traeCn running"));
    assert!(command(&hooks["Notification"][0]).contains("traeCn notification"));
    assert_eq!(hooks["Notification"][0]["matcher"], "*");
    let approval = hooks["PreToolUse"].as_array().unwrap().iter().find(|entry| entry["matcher"] == APPROVED_TOOLS).unwrap();
    assert!(APPROVED_TOOLS.contains("RunCommand") && APPROVED_TOOLS.contains("Edit") && APPROVED_TOOLS.contains("mcp__.*"));
    assert!(command(approval).contains("fuyu-agent-approval") && command(approval).contains("traeCn permission"));
    assert_eq!(approval["hooks"][0]["timeout"], APPROVAL_HOOK_TIMEOUT_SECONDS);
    assert!(hooks["Stop"].as_array().unwrap().iter().any(|entry| command(entry).contains("traeCn stop")));

    let mut legacy = config.clone();
    for entry in legacy["hooks"]["PreToolUse"].as_array_mut().unwrap() {
        if entry["matcher"] == APPROVED_TOOLS {
            entry["matcher"] = json!("RunCommand");
        }
    }
    fs::write(hooks_path(&TRAE_CN, &home), legacy.to_string()).unwrap();
    assert_eq!(hooks_state(&TRAE_CN, &env), HookInstallState::Outdated);
    install_hooks(&TRAE_CN, &env).unwrap();
    assert_eq!(hooks_state(&TRAE_CN, &env), HookInstallState::Current);

    fs::remove_file(hooks_path(&TRAE_CN, &home)).unwrap();
    install_hooks(&TRAE_CN, &env).unwrap();
    assert_eq!(read_config(&hooks_path(&TRAE_CN, &home)).unwrap()["version"], 1);

    let mut stale = read_config(&hooks_path(&TRAE_CN, &home)).unwrap();
    stale["hooks"]["Notification"] = json!([]);
    fs::write(hooks_path(&TRAE_CN, &home), stale.to_string()).unwrap();
    assert_eq!(hooks_state(&TRAE_CN, &env), HookInstallState::Outdated);
    fs::remove_dir_all(&home).unwrap();
}
