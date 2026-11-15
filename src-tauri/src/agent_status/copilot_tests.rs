use super::*;
use serde_json::json;

const START: &str = r#"{"type":"session.start","id":"e1","parentId":null,"timestamp":"2026-11-15T05:00:00.000Z","data":{"sessionId":"c1","version":1,"producer":"copilot-agent","copilotVersion":"1.0.67","startTime":"2026-11-15T05:00:00.000Z","selectedModel":"claude-sonnet-4.5","reasoningEffort":"medium","context":{"cwd":"/work/app","branch":"main"}}}"#;
const SYSTEM_PROMPT: &str = r#"{"type":"user.message","id":"e2","parentId":"e1","timestamp":"2026-11-15T05:00:00.500Z","data":{"content":"<current_datetime>2026-11-15</current_datetime>"}}"#;
const PROMPT: &str = r#"{"type":"user.message","id":"e3","parentId":"e2","timestamp":"2026-11-15T05:00:01.000Z","data":{"content":"修一下登录页的样式"}}"#;
const TURN: &str = r#"{"type":"assistant.turn_start","id":"e4","parentId":"e3","timestamp":"2026-11-15T05:00:01.100Z","data":{"turnId":"0"}}"#;
const CALL: &str = r#"{"type":"assistant.message","id":"e5","parentId":"e4","timestamp":"2026-11-15T05:00:02.000Z","data":{"messageId":"m1","content":"先看看文件。","model":"claude-sonnet-4.5","toolRequests":[{"toolCallId":"t1","name":"bash","arguments":{"command":"ls src","description":"列出文件"}}]}}"#;
const SUB: &str = r#"{"type":"assistant.message","id":"e6","parentId":"e5","timestamp":"2026-11-15T05:00:02.500Z","data":{"messageId":"m2","content":"子代理的话","parentToolCallId":"t9","toolRequests":[]}}"#;
const RUN: &str = r#"{"type":"tool.execution_start","id":"e7","parentId":"e5","timestamp":"2026-11-15T05:00:03.000Z","data":{"toolCallId":"t1","toolName":"bash","arguments":{"command":"ls src"}}}"#;
const DONE_TOOL: &str = r#"{"type":"tool.execution_complete","id":"e8","parentId":"e7","timestamp":"2026-11-15T05:00:03.500Z","data":{"toolCallId":"t1","success":true}}"#;
const REPLY: &str = r#"{"type":"assistant.message","id":"e9","parentId":"e8","timestamp":"2026-11-15T05:00:04.000Z","data":{"messageId":"m3","content":"改好了。\n✓","model":"gpt-5.1","toolRequests":[]}}"#;
const TURN_END: &str = r#"{"type":"assistant.turn_end","id":"e10","parentId":"e9","timestamp":"2026-11-15T05:00:04.100Z","data":{"turnId":"0"}}"#;
const SHUTDOWN: &str = r#"{"type":"session.shutdown","id":"e11","parentId":"e10","timestamp":"2026-11-15T05:01:00.000Z","data":{"shutdownType":"routine","sessionStartTime":1,"totalApiDurationMs":1,"codeChanges":{},"modelMetrics":{}}}"#;

fn lines(events: &[&str]) -> String {
    events.join("\n")
}

#[test]
fn reads_a_finished_turn() {
    let parsed = parse_events_tail(&lines(&[START, SYSTEM_PROMPT, PROMPT, TURN, CALL, RUN, DONE_TOOL, REPLY, TURN_END]));
    assert_eq!(parsed.state, TurnState::Done);
    assert!(!parsed.closed);
    assert_eq!(parsed.model.as_deref(), Some("gpt-5.1"));
    assert_eq!(parsed.inner.last_prompt.as_deref(), Some("修一下登录页的样式"));
    assert!(parsed.inner.turn_started_at.is_some());
    assert_eq!(parsed.inner.last_message.as_deref(), Some("改好了。"));
    assert_eq!(parsed.inner.reply_marker, Some("done"));
    assert!(parsed.inner.current_tool.is_none());
}

#[test]
fn reads_a_running_turn_and_skips_subagents() {
    let parsed = parse_events_tail(&lines(&[PROMPT, TURN, CALL, SUB]));
    assert_eq!(parsed.state, TurnState::Working);
    let tool = parsed.inner.current_tool.expect("tool");
    assert_eq!((tool.name.as_str(), tool.detail.as_deref()), ("bash", Some("ls src")));
    assert_eq!(parsed.inner.last_message.as_deref(), Some("先看看文件。"));
    assert_eq!(parse_events_tail(&lines(&[CALL, RUN])).state, TurnState::Working);
    assert_eq!(parse_events_tail(&lines(&[REPLY, PROMPT])).state, TurnState::Working);
}

#[test]
fn aborts_errors_and_shutdowns() {
    let abort = r#"{"type":"abort","id":"a","parentId":null,"timestamp":"2026-11-15T05:00:05.000Z","data":{"reason":"user_initiated"}}"#;
    assert_eq!(parse_events_tail(&lines(&[PROMPT, CALL, abort])).state, TurnState::Done);
    let error = r#"{"type":"session.error","id":"b","parentId":null,"timestamp":"2026-11-15T05:00:05.000Z","data":{"errorType":"model","message":"boom"}}"#;
    assert_eq!(parse_events_tail(&lines(&[PROMPT, CALL, error])).state, TurnState::Failed);
    let closed = parse_events_tail(&lines(&[PROMPT, CALL, SHUTDOWN]));
    assert!(closed.closed);
    assert_eq!(closed.state, TurnState::Working);
    let summary = summary("c1".into(), "", None, None, closed, 1, 2);
    assert_eq!((summary.phase, summary.closed), ("completed", true));
}

#[test]
fn reads_workspace_yaml() {
    let yaml = "id: c1\ncwd: /work/app\nsummary: \"Fix the \\\"login\\\" page\"\ncreated_at: 2026-11-15T05:00:00.000Z\nsummary_count: 1\n";
    assert_eq!(yaml_value(yaml, "summary").as_deref(), Some("Fix the \"login\" page"));
    assert_eq!(yaml_value(yaml, "cwd").as_deref(), Some("/work/app"));
    assert_eq!(yaml_value("summary: |\n  long\n", "summary"), None);
    assert_eq!(yaml_value("summary: 'it''s'\n", "summary").as_deref(), Some("it's"));
}

#[test]
fn summary_prefers_the_workspace_title() {
    let start: Value = serde_json::from_str(START).unwrap();
    let tail = parse_events_tail(&lines(&[PROMPT, CALL]));
    let summary = summary("c1".into(), "summary: 登录页样式\n", Some(&start), Some("修一下登录页的样式".into()), tail, 10, 20);
    assert_eq!(summary.provider, "copilot");
    assert_eq!((summary.title.as_deref(), summary.title_source), (Some("登录页样式"), Some("agent")));
    assert_eq!(summary.cwd.as_deref(), Some("/work/app"));
    assert_eq!(summary.model.as_deref(), Some("claude-sonnet-4.5"));
    assert_eq!(summary.effort.as_deref(), Some("medium"));
    assert_eq!(summary.phase, "running");

    let untitled = super::summary("c1".into(), "", Some(&start), None, EventsTail::default(), 10, 20);
    assert_eq!((untitled.title.as_deref(), untitled.title_source), (Some("app"), Some("folder")));
}

fn temp_home(name: &str) -> PathBuf {
    let home = std::env::temp_dir().join(format!("fuyu-copilot-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&home);
    fs::create_dir_all(&home).unwrap();
    home
}

#[test]
fn lists_sessions_from_session_state() {
    let home = temp_home("list");
    let state = home.join("session-state");
    let session = state.join("c1");
    fs::create_dir_all(&session).unwrap();
    fs::write(session.join("events.jsonl"), lines(&[START, PROMPT, TURN, CALL])).unwrap();
    fs::write(session.join("workspace.yaml"), "id: c1\nsummary: 登录页样式\n").unwrap();
    let empty = state.join("c2");
    fs::create_dir_all(&empty).unwrap();
    fs::write(empty.join("events.jsonl"), START).unwrap();
    fs::create_dir_all(state.join(".session-operation-locks")).unwrap();

    let now = crate::agent_status::snapshot::current_unix_millis();
    let listed = sessions_in(&home, now, 60_000);
    let ids: Vec<_> = listed.iter().map(|summary| (summary.session_id.as_str(), summary.phase)).collect();
    assert_eq!(ids, [("c1", "running")]);
    assert_eq!(listed[0].title.as_deref(), Some("登录页样式"));
    assert!(sessions_in(&home, now + 120_000, 60_000).is_empty());
    assert_eq!(json!(listed[0].current_tool.as_ref().map(|tool| &tool.name)), json!("bash"));
    let _ = fs::remove_dir_all(&home);
}

fn hook_env<'a>(home: &'a Path, running: &'a Path, status: &'a Path) -> crate::agent_status::harness::HookEnv<'a> {
    crate::agent_status::harness::HookEnv { home_dir: home, running_script: running, status_script: status }
}

#[test]
fn the_hooks_file_uses_copilot_fields() {
    use crate::agent_status::copilot_hooks::hooks_config;
    let home = temp_home("config");
    let config = hooks_config(&hook_env(&home, Path::new("/data/it's/fuyu-agent-running.sh"), Path::new("/data/fuyu-agent-status.sh")));
    assert_eq!(config["version"], 1);
    let hooks = config["hooks"].as_object().unwrap();
    let events: Vec<&str> = hooks.keys().map(String::as_str).collect();
    assert_eq!(events, ["PermissionRequest", "PreToolUse", "Stop", "UserPromptSubmit"]);
    let permission = hooks["PermissionRequest"].as_array().unwrap();
    assert_eq!(permission.len(), 2);
    assert_eq!(permission[0]["bash"], r#"/bin/sh '/data/it'\''s/fuyu-agent-running.sh' copilot notification"#);
    assert_eq!(permission[0]["powershell"], "& '/data/it''s/fuyu-agent-running.sh' copilot notification");
    assert!(permission[1]["bash"].as_str().unwrap().ends_with(" copilot permission"));
    assert_eq!(permission[1]["timeoutSec"], crate::agent_status::claude_hooks::APPROVAL_HOOK_TIMEOUT_SECONDS);
    assert!(hooks["Stop"][0]["powershell"].as_str().unwrap().starts_with("powershell.exe -NoProfile -ExecutionPolicy Bypass -File '/data/fuyu-agent-status.sh' copilot completed"));
    for list in hooks.values() {
        for entry in list.as_array().unwrap() {
            let keys: Vec<&str> = entry.as_object().unwrap().keys().map(String::as_str).collect();
            assert_eq!(keys, ["bash", "powershell", "timeoutSec", "type"]);
        }
    }
    let _ = fs::remove_dir_all(&home);
}

#[test]
fn installing_writes_its_own_file_and_reports_state() {
    use crate::agent_status::copilot_hooks::{hooks_config, install_into, state_in, HOOKS_FILE};
    use crate::agent_status::hooks_state::HookInstallState;
    let home = temp_home("install");
    let config = hooks_config(&hook_env(&home, Path::new("/data/r.sh"), Path::new("/data/s.sh")));
    assert_eq!(state_in(&home, &config), HookInstallState::NotInstalled);
    fs::create_dir_all(home.join("hooks")).unwrap();
    fs::write(home.join("hooks/other.json"), "{\"version\":1}").unwrap();
    install_into(&home, &config).unwrap();
    assert_eq!(state_in(&home, &config), HookInstallState::Current);
    assert_eq!(fs::read_to_string(home.join("hooks/other.json")).unwrap(), "{\"version\":1}");
    let moved = hooks_config(&hook_env(&home, Path::new("/elsewhere/r.sh"), Path::new("/data/s.sh")));
    assert_eq!(state_in(&home, &moved), HookInstallState::Outdated);
    fs::write(home.join(HOOKS_FILE), "not json").unwrap();
    assert_eq!(state_in(&home, &config), HookInstallState::Outdated);
    let _ = fs::remove_dir_all(&home);
}
