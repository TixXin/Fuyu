use super::*;
use crate::agent_status::hooks_state::HookInstallState;
use crate::agent_status::kimi_hooks::{block_state, hook_block, install_into, with_block};
use serde_json::json;

const META: &str = r#"{"type":"metadata","protocol_version":"1.5","min_protocol_version":"1.5","created_at":1763182800000}"#;
const PROMPT: &str = r#"{"type":"turn.prompt","agentId":"main","input":[{"type":"text","text":"修一下登录页的样式"}],"origin":"user","turnId":1,"time":1763182801000}"#;
const CALL: &str = r#"{"type":"context.append_message","agentId":"main","message":{"role":"assistant","content":[{"type":"think","think":"看看"},{"type":"text","text":"先看看文件。"}],"toolCalls":[{"type":"function","id":"c1","name":"Bash","arguments":"{\"command\":\"ls src\"}"}]},"time":1763182802000}"#;
const SUB: &str = r#"{"type":"context.append_message","agentId":"agent-0","message":{"role":"assistant","content":[{"type":"text","text":"子代理的话"}],"toolCalls":[]},"time":1763182802500}"#;
const RESULT: &str = r#"{"type":"context.append_message","agentId":"main","message":{"role":"tool","content":[{"type":"text","text":"a.ts"}],"toolCalls":[],"toolCallId":"c1"},"time":1763182803000}"#;
const USAGE: &str = r#"{"type":"usage.record","agentId":"main","model":"kimi-k2-turbo","usage":{"inputOther":10},"time":1763182803500}"#;
const REPLY: &str = r#"{"type":"context.append_message","agentId":"main","message":{"role":"assistant","content":[{"type":"text","text":"改好了。\n✓"}],"toolCalls":[]},"time":1763182804000}"#;
const ENDED: &str = r#"{"type":"turn.ended","agentId":"main","turnId":1,"reason":"completed","time":1763182805000}"#;

#[test]
fn reads_a_finished_turn() {
    let parsed = parse_wire_tail(&[META, PROMPT, CALL, RESULT, USAGE, REPLY, ENDED].join("\n"));
    assert_eq!(parsed.state, TurnState::Done);
    assert_eq!(parsed.last_prompt.as_deref(), Some("修一下登录页的样式"));
    assert_eq!(parsed.turn_started_at, Some(1763182801000));
    assert_eq!(parsed.model.as_deref(), Some("kimi-k2-turbo"));
    assert_eq!(parsed.last_message.as_deref(), Some("改好了。"));
    assert_eq!(parsed.reply_marker, Some("done"));
    assert!(parsed.current_tool.is_none());
}

#[test]
fn reads_a_running_turn_and_skips_subagents() {
    let parsed = parse_wire_tail(&[META, PROMPT, CALL, SUB].join("\n"));
    assert_eq!(parsed.state, TurnState::Working);
    let tool = parsed.current_tool.expect("tool");
    assert_eq!((tool.name.as_str(), tool.detail.as_deref()), ("Bash", Some("ls src")));
    assert_eq!(parsed.last_message.as_deref(), Some("先看看文件。"));

    let without_prompt = parse_wire_tail(&[CALL, RESULT].join("\n"));
    assert_eq!(without_prompt.state, TurnState::Working);
}

#[test]
fn failed_and_cancelled_turns() {
    let failed = ENDED.replace("completed", "failed");
    assert_eq!(parse_wire_tail(&[PROMPT, CALL, &failed].join("\n")).state, TurnState::Failed);
    let cancel = r#"{"type":"turn.cancel","agentId":"main","turnId":1,"reason":"user_cancelled","time":1}"#;
    assert_eq!(parse_wire_tail(&[PROMPT, CALL, cancel].join("\n")).state, TurnState::Done);
    let queued = r#"{"type":"turn.cancel","agentId":"main","target":"queued","time":1}"#;
    assert_eq!(parse_wire_tail(&[PROMPT, CALL, queued].join("\n")).state, TurnState::Working);
}

fn state(extra: Value) -> Value {
    let mut state = json!({
        "id": "s1",
        "version": 1,
        "title": "登录页样式",
        "titleKind": "generated",
        "lastPrompt": "修一下登录页的样式",
        "createdAt": 1763182800000_i64,
        "updatedAt": 1763182805000_i64,
        "archived": false,
        "cwd": "/work/app",
        "isCustomTitle": false
    });
    if let (Some(state), Value::Object(extra)) = (state.as_object_mut(), extra) {
        state.extend(extra);
    }
    state
}

#[test]
fn summary_uses_state_json() {
    let now = 1763182806000;
    let summary = summary("s1".into(), &state(json!({"lastTurnReason": "failed"})), SessionTail::default(), now - 1000, now);
    assert_eq!(summary.provider, "kimiCode");
    assert_eq!(summary.title.as_deref(), Some("登录页样式"));
    assert_eq!(summary.title_source, Some("agent"));
    assert_eq!(summary.cwd.as_deref(), Some("/work/app"));
    assert_eq!(summary.last_prompt.as_deref(), Some("修一下登录页的样式"));
    assert_eq!(summary.phase, "failed");

    let renamed = summary_of(json!({"title": "我起的名字", "titleKind": "custom", "lastTurnReason": "cancelled"}));
    assert_eq!((renamed.title.as_deref(), renamed.title_source), (Some("我起的名字"), Some("rename")));
    assert_eq!(renamed.phase, "completed");

    let untitled = summary_of(json!({"title": null, "lastPrompt": null}));
    assert_eq!((untitled.title.as_deref(), untitled.title_source), (Some("app"), Some("folder")));
}

fn summary_of(extra: Value) -> AgentSessionSummary {
    let mut state = state(Value::Null);
    if let (Some(state), Value::Object(extra)) = (state.as_object_mut(), extra) {
        for (key, value) in extra {
            if value.is_null() {
                state.remove(&key);
            } else {
                state.insert(key, value);
            }
        }
    }
    summary("s1".into(), &state, SessionTail::default(), 1, 2)
}

fn temp_home(name: &str) -> PathBuf {
    let home = std::env::temp_dir().join(format!("fuyu-kimi-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&home);
    fs::create_dir_all(&home).unwrap();
    home
}

#[test]
fn lists_sessions_from_the_session_folders() {
    let home = temp_home("list");
    let session = home.join("sessions").join("wd_app_0123456789ab").join("s1");
    fs::create_dir_all(session.join("agents/main")).unwrap();
    fs::write(session.join("state.json"), state(Value::Null).to_string()).unwrap();
    fs::write(session.join("agents/main/wire.jsonl"), [META, PROMPT, CALL].join("\n")).unwrap();
    let archived = home.join("sessions").join("wd_app_0123456789ab").join("s2");
    fs::create_dir_all(&archived).unwrap();
    fs::write(archived.join("state.json"), state(json!({"id": "s2", "archived": true})).to_string()).unwrap();
    let child = home.join("sessions").join("wm_1").join("s3");
    fs::create_dir_all(child.join("session-meta")).unwrap();
    fs::write(child.join("session-meta/state.json"), state(json!({"id": "s3", "custom": {"child_session_kind": "child"}})).to_string()).unwrap();
    let migrated = home.join("elsewhere").join("s4");
    fs::create_dir_all(migrated.join("session-meta")).unwrap();
    fs::write(migrated.join("session-meta/state.json"), state(json!({"id": "s4"})).to_string()).unwrap();
    let index = json!({"sessionId": "s4", "sessionDir": migrated, "workDir": "/work/app"});
    fs::write(home.join("session_index.jsonl"), format!("{index}\n{{broken\n")).unwrap();

    let now = crate::agent_status::snapshot::current_unix_millis();
    let mut listed: Vec<_> = session_dirs(&home)
        .into_iter()
        .filter_map(|dir| read_session(&dir, now, 60_000))
        .collect();
    listed.sort_by(|a, b| a.session_id.cmp(&b.session_id));
    let ids: Vec<_> = listed.iter().map(|summary| (summary.session_id.as_str(), summary.phase)).collect();
    assert_eq!(ids, [("s1", "running"), ("s4", "completed")]);
    assert_eq!(listed[0].current_tool.as_ref().map(|tool| tool.name.as_str()), Some("Bash"));
    assert!(read_session(&session, now + 120_000, 60_000).is_none());
    let _ = fs::remove_dir_all(&home);
}

#[test]
fn the_hook_block_is_flat_toml_with_four_fields() {
    let block = hook_block(Path::new("/data/fuyu-agent-running.sh"), Path::new("/data/fuyu-agent-status.sh"));
    let tables: Vec<&str> = block.split("[[hooks]]").skip(1).collect();
    assert_eq!(tables.len(), 5);
    for table in &tables {
        let keys: Vec<&str> = table
            .lines()
            .filter(|line| !line.trim().is_empty() && !line.starts_with('#'))
            .filter_map(|line| line.split(" = ").next())
            .collect();
        assert_eq!(keys, ["event", "command", "timeout"]);
    }
    for event in ["UserPromptSubmit", "PermissionRequest", "Stop", "Interrupt", "StopFailure"] {
        assert!(block.contains(&format!("event = \"{event}\"")), "{event}");
    }
    #[cfg(not(windows))]
    {
        assert!(block.contains(r#"command = "/bin/sh '/data/fuyu-agent-running.sh' kimiCode notification""#));
        assert!(block.contains(r#"command = "/bin/sh '/data/fuyu-agent-status.sh' kimiCode failed""#));
    }
}

#[test]
fn installing_keeps_the_rest_of_config_toml() {
    let block = hook_block(Path::new("/data/fuyu-agent-running.sh"), Path::new("/data/fuyu-agent-status.sh"));
    let user = "default_model = \"kimi\"\n\n[[hooks]]\nevent = \"Notification\"\ncommand = \"notify\"\n";
    assert_eq!(block_state(user, &block), HookInstallState::NotInstalled);
    let installed = with_block(user, &block).unwrap();
    assert!(installed.starts_with(user.trim_end()));
    assert!(installed.ends_with(&format!("{block}\n")));
    assert_eq!(block_state(&installed, &block), HookInstallState::Current);
    assert_eq!(with_block(&installed, &block).unwrap(), installed);

    let old = installed.replace("timeout = 5", "timeout = 3");
    assert_eq!(block_state(&old, &block), HookInstallState::Outdated);
    assert_eq!(with_block(&old, &block).unwrap(), installed);
    assert_eq!(block_state(&installed.replace('\n', "\r\n"), &block), HookInstallState::Current);

    assert!(with_block("hooks = []\n", &block).is_err());
    assert!(with_block("[tables]\nhooks = 1\n", &block).is_ok());
}

#[test]
fn installing_never_overwrites_a_config_it_cannot_read() {
    let home = temp_home("unreadable");
    let block = hook_block(Path::new("/data/fuyu-agent-running.sh"), Path::new("/data/fuyu-agent-status.sh"));
    let path = home.join("config.toml");
    let bytes = b"default_model = \"\xff\xfe\"\n";
    fs::write(&path, bytes).unwrap();
    assert!(install_into(&home, &block).is_err());
    assert_eq!(fs::read(&path).unwrap(), bytes);

    fs::remove_file(&path).unwrap();
    install_into(&home, &block).unwrap();
    assert_eq!(fs::read_to_string(&path).unwrap(), format!("{block}\n"));
    let _ = fs::remove_dir_all(&home);
}
