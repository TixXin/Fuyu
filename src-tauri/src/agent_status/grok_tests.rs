use super::*;
use crate::agent_status::{claimed_elsewhere, compat_input, AGENT_RUNNING_SCRIPT_FILE_NAME, AGENT_STATUS_SCRIPT_FILE_NAME};

fn temp_home(name: &str) -> PathBuf {
    let home = std::env::temp_dir().join(format!("fuyu-grok-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&home);
    fs::create_dir_all(&home).unwrap();
    home
}

fn lines(records: &[Value]) -> String {
    records.iter().map(Value::to_string).collect::<Vec<_>>().join("\n")
}

fn event(kind: &str, extra: Value) -> Value {
    let mut record = json!({ "type": kind, "ts": "2026-11-15T05:00:00.000Z" });
    record.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
    record
}

fn turn_started(relation: &str) -> Value {
    event("turn_started", json!({ "schema_version": "1.0", "session_id": "g1", "model_id": "grok-build", "session_relationship": relation, "turn_number": 1 }))
}

#[test]
fn reads_the_turn_state_from_events() {
    let working = parse_events(&lines(&[
        turn_started("primary"),
        event("phase_changed", json!({ "phase": "tool_execution" })),
        event("tool_started", json!({ "tool_name": "run_terminal_command" })),
    ]));
    assert_eq!(working.state, TurnState::Working);
    assert_eq!(working.tool.as_deref(), Some("run_terminal_command"));
    assert_eq!(working.model.as_deref(), Some("grok-build"));
    assert!(working.turn_started_at.is_some() && !working.child);

    let waiting = parse_events(&lines(&[
        turn_started("primary"),
        event("permission_requested", json!({ "tool_name": "run_terminal_command" })),
        event("phase_changed", json!({ "phase": "permission_prompt" })),
    ]));
    assert_eq!((waiting.state, waiting.tool.as_deref()), (TurnState::AwaitingUser, Some("run_terminal_command")));

    let done = parse_events(&lines(&[
        turn_started("primary"),
        event("tool_started", json!({ "tool_name": "read_file" })),
        event("tool_completed", json!({ "tool_name": "read_file", "outcome": "success" })),
        event("turn_ended", json!({ "outcome": "completed" })),
    ]));
    assert_eq!((done.state, done.tool), (TurnState::Done, None));
    let failed = parse_events(&lines(&[turn_started("primary"), event("turn_ended", json!({ "outcome": "error" }))]));
    assert_eq!(failed.state, TurnState::Failed);
    assert!(parse_events(&lines(&[turn_started("subagent")])).child);
}

#[test]
fn reads_prompts_replies_and_tools_from_the_chat() {
    let chat = lines(&[
        json!({ "type": "system", "content": "sys" }),
        json!({ "type": "user", "content": [{ "type": "text", "text": "修一下登录" }], "prompt_index": 0 }),
        json!({ "type": "assistant", "content": "", "tool_calls": [{ "id": "c1", "name": "run_terminal_command", "arguments": "{\"command\":\"npm test\"}" }] }),
        json!({ "type": "tool_result", "content": "ok", "tool_call_id": "c1" }),
        json!({ "type": "user", "content": [{ "type": "text", "text": "<reminder>" }], "synthetic_reason": "reminder" }),
        json!({ "type": "assistant", "content": "修好了。\n\n✓", "tool_calls": null }),
    ]);
    let parsed = parse_chat(&chat);
    assert_eq!(parsed.last_prompt.as_deref(), Some("修一下登录"));
    assert_eq!((parsed.last_message.as_deref(), parsed.reply_marker), (Some("修好了。"), Some("done")));
    assert!(parsed.current_tool.is_none());

    let running = parse_chat(&lines(&[
        json!({ "type": "user", "content": [{ "type": "text", "text": "跑测试" }] }),
        json!({ "type": "assistant", "content": "", "tool_calls": [{ "id": "c1", "name": "run_terminal_command", "arguments": "{\"command\":\"npm test\"}" }] }),
    ]));
    let tool = running.current_tool.unwrap();
    assert_eq!((tool.name.as_str(), tool.detail.as_deref()), ("run_terminal_command", Some("npm test")));
}

#[test]
fn lists_sessions_from_the_session_folders() {
    let home = temp_home("sessions");
    let dir = home.join(".grok/sessions/%2Fwork%2Fshop/0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001");
    fs::create_dir_all(&dir).unwrap();
    fs::write(
        dir.join("summary.json"),
        json!({ "info": { "id": "0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001", "cwd": "/work/shop" }, "generated_title": "登录修复", "current_model_id": "grok-build", "reasoning_effort": "high" }).to_string(),
    )
    .unwrap();
    fs::write(dir.join("events.jsonl"), lines(&[turn_started("primary"), event("turn_ended", json!({ "outcome": "completed" }))])).unwrap();
    fs::write(
        dir.join("chat_history.jsonl"),
        lines(&[json!({ "type": "user", "content": [{ "type": "text", "text": "修一下登录" }] }), json!({ "type": "assistant", "content": "好了。" })]),
    )
    .unwrap();
    let child = home.join(".grok/sessions/%2Fwork%2Fshop/0199aaaa-bbbb-7ccc-8ddd-eeeeffff0002");
    fs::create_dir_all(&child).unwrap();
    fs::write(child.join("events.jsonl"), lines(&[turn_started("subagent")])).unwrap();

    let app = home.join("app");
    let roots = ScanRoots { home_dir: &home, local_app_dir: Some(&app) };
    let now = system_time_to_unix_millis(SystemTime::now()).unwrap();
    let listed = sessions(&roots, now, 60 * 60 * 1000);
    assert_eq!(listed.len(), 1);
    let session = &listed[0];
    assert_eq!((session.provider, session.session_id.as_str()), (PROVIDER, "0199aaaa-bbbb-7ccc-8ddd-eeeeffff0001"));
    assert_eq!((session.title.as_deref(), session.cwd.as_deref()), (Some("登录修复"), Some("/work/shop")));
    assert_eq!((session.model.as_deref(), session.effort.as_deref(), session.phase), (Some("grok-build"), Some("high"), "completed"));
    assert_eq!((session.last_prompt.as_deref(), session.last_message.as_deref()), (Some("修一下登录"), Some("好了。")));
    fs::remove_dir_all(&home).unwrap();
}

#[test]
fn installs_its_own_hook_file_without_approval() {
    let home = temp_home("hooks");
    let running = home.join(".fuyu").join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status = home.join(".fuyu").join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
    install(&env).unwrap();
    assert_eq!(check(&env), HookInstallState::Absent);

    fs::create_dir_all(home.join(".grok/hooks")).unwrap();
    fs::write(home.join(".grok/hooks/other.json"), "{\"hooks\":{}}").unwrap();
    assert_eq!(check(&env), HookInstallState::NotInstalled);
    install(&env).unwrap();
    assert_eq!(check(&env), HookInstallState::Current);
    assert!(home.join(".grok/rules").is_dir());
    assert_eq!(fs::read_to_string(home.join(".grok/hooks/other.json")).unwrap(), "{\"hooks\":{}}");

    let config: Value = serde_json::from_str(&fs::read_to_string(home.join(".grok/hooks/fuyu-island.json")).unwrap()).unwrap();
    let hooks = &config["hooks"];
    let command = |event: &str| hooks[event][0]["hooks"][0]["command"].as_str().unwrap().to_string();
    assert!(command("UserPromptSubmit").contains("grok"));
    assert!(command("StopCancelled").contains("grok completed"));
    assert_eq!(hooks["Notification"][0]["matcher"], "permission_prompt");
    assert!(command("Notification").contains("grok notification"));
    assert!(hooks.get("PermissionRequest").is_none());
    assert!(!config.to_string().contains("fuyu-agent-approval"));
    fs::remove_dir_all(&home).unwrap();
}

#[test]
fn grok_payloads_on_claude_routes_are_claimed() {
    let body = json!({ "hookEventName": "post_tool_use", "hook_event_name": "PostToolUse", "sessionId": "g1", "session_id": "g1" }).to_string();
    assert_eq!(claimed_elsewhere(body.as_bytes(), None), Some(PROVIDER));
    let claude = json!({ "hook_event_name": "PostToolUse", "session_id": "c1", "transcript_path": "/home/dev/.claude/projects/p/c1.jsonl" }).to_string();
    assert_eq!(claimed_elsewhere(claude.as_bytes(), None), None);
    let mut camel = json!({ "sessionId": "g1", "notificationType": "permission_prompt" });
    compat_input(PROVIDER, &mut camel);
    assert_eq!((camel["session_id"].as_str(), camel["notification_type"].as_str()), (Some("g1"), Some("permission_prompt")));
}
