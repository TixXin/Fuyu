use super::*;
use crate::agent_status::sessions::TurnState;

const START: &str = r#"{"type":"session_start","id":"d1","title":"登录页样式","cwd":"/work/app"}"#;
const HIDDEN: &str = r#"{"type":"message","id":"m0","timestamp":"2026-11-15T05:00:00.500Z","message":{"role":"user","visibility":"hidden","content":[{"type":"text","text":"<system-reminder>x</system-reminder>"}]}}"#;
const PROMPT: &str = r#"{"type":"message","id":"m1","timestamp":"2026-11-15T05:00:01.000Z","message":{"role":"user","content":[{"type":"text","text":"修一下登录页的样式"}]}}"#;
const CALL: &str = r#"{"type":"message","id":"m2","timestamp":"2026-11-15T05:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"先看看文件。"},{"type":"tool_use","id":"t1","name":"Execute","input":{"command":"ls src"}}]}}"#;
const RESULT: &str = r#"{"type":"message","id":"m3","timestamp":"2026-11-15T05:00:03.000Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"a.ts"}]}}"#;
const REPLY: &str = r#"{"type":"message","id":"m4","timestamp":"2026-11-15T05:00:04.000Z","message":{"role":"assistant","content":[{"type":"text","text":"改好了。\n✓"}]}}"#;
const TODOS: &str = r#"{"type":"todo_state","id":"x","todos":[]}"#;

fn lines(records: &[&str]) -> String {
    records.join("\n")
}

#[test]
fn reads_a_finished_turn() {
    let parsed = parse_droid_tail(&lines(&[START, HIDDEN, PROMPT, CALL, RESULT, REPLY, TODOS]));
    assert_eq!(parsed.state, TurnState::Done);
    assert_eq!(parsed.last_prompt.as_deref(), Some("修一下登录页的样式"));
    assert!(parsed.turn_started_at.is_some());
    assert_eq!(parsed.last_message.as_deref(), Some("改好了。"));
    assert_eq!(parsed.reply_marker, Some("done"));
}

#[test]
fn reads_a_running_turn() {
    let parsed = parse_droid_tail(&lines(&[PROMPT, CALL])).settle();
    assert_eq!(parsed.state, TurnState::Working);
    let tool = parsed.current_tool.expect("tool");
    assert_eq!(tool.name, "Execute");
    assert_eq!(parse_droid_tail(&lines(&[REPLY, HIDDEN])).state, TurnState::Done);
}

#[test]
fn summary_uses_the_session_start_title_and_settings() {
    let start: Value = serde_json::from_str(START).unwrap();
    let settings = serde_json::json!({"model": "claude-sonnet-4-5", "reasoningEffort": "high"});
    let tail = parse_droid_tail(&lines(&[PROMPT, CALL]));
    let summary = summary("d1".into(), Some(&start), &settings, None, Some("修一下登录页的样式".into()), tail, 10, 20);
    assert_eq!(summary.provider, "droid");
    assert_eq!((summary.title.as_deref(), summary.title_source), (Some("登录页样式"), Some("agent")));
    assert_eq!(summary.cwd.as_deref(), Some("/work/app"));
    assert_eq!(summary.model.as_deref(), Some("claude-sonnet-4-5"));
    assert_eq!(summary.effort.as_deref(), Some("high"));
    assert_eq!(summary.phase, "running");

    let untitled = super::summary("d1".into(), None, &Value::Null, Some("/work/app".into()), None, SessionTail::default(), 10, 20);
    assert_eq!((untitled.title.as_deref(), untitled.title_source), (Some("app"), Some("folder")));
}

fn temp_home(name: &str) -> PathBuf {
    let home = std::env::temp_dir().join(format!("fuyu-droid-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&home);
    fs::create_dir_all(&home).unwrap();
    home
}

#[test]
fn lists_sessions_from_the_project_folders() {
    let home = temp_home("list");
    let project = home.join("sessions").join("-work-app");
    fs::create_dir_all(&project).unwrap();
    fs::write(project.join("d1.jsonl"), lines(&[START, HIDDEN, PROMPT, CALL])).unwrap();
    fs::write(project.join("d1.settings.json"), r#"{"model":"claude-sonnet-4-5"}"#).unwrap();
    fs::write(project.join("d2.jsonl"), lines(&[r#"{"type":"session_start","id":"d2"}"#, HIDDEN])).unwrap();
    fs::write(project.join("d3.jsonl"), lines(&[PROMPT, REPLY])).unwrap();

    let now = crate::agent_status::snapshot::current_unix_millis();
    let mut listed = sessions_in(&home, now, 60_000);
    listed.sort_by(|a, b| a.session_id.cmp(&b.session_id));
    let ids: Vec<_> = listed.iter().map(|summary| (summary.session_id.as_str(), summary.phase)).collect();
    assert_eq!(ids, [("d1", "running"), ("d3", "completed")]);
    assert_eq!(listed[0].model.as_deref(), Some("claude-sonnet-4-5"));
    assert_eq!(listed[1].cwd.as_deref(), Some("/work/app"));
    assert_eq!(listed[1].title.as_deref(), Some("修一下登录页的样式"));
    assert!(sessions_in(&home, now + 120_000, 60_000).is_empty());
    let _ = fs::remove_dir_all(&home);
}

#[test]
fn hooks_go_into_settings_unless_hooks_json_exists() {
    use crate::agent_status::droid_hooks::{hook_entries, install_into, state_in};
    use crate::agent_status::harness::HookEnv;
    use crate::agent_status::hooks_state::HookInstallState;
    let home = temp_home("hooks");
    let env = HookEnv { home_dir: &home, running_script: Path::new("/data/fuyu-agent-running.sh"), status_script: Path::new("/data/fuyu-agent-status.sh") };
    let entries = hook_entries(&env);
    let events: Vec<&str> = entries.iter().map(|(event, _)| *event).collect();
    assert_eq!(events, ["UserPromptSubmit", "PreToolUse", "Stop", "Notification", "PreToolUse"]);
    assert_eq!(entries[3].1["matcher"], "permission_prompt");
    assert_eq!(entries[4].1["matcher"], APPROVED_TOOLS);
    assert!(entries[4].1["hooks"][0]["command"].as_str().unwrap().contains("droid permission"));

    fs::write(home.join("settings.json"), r#"{"model":"x","hooks":{"Stop":[{"hooks":[{"type":"command","command":"mine"}]}]}}"#).unwrap();
    assert_eq!(state_in(&home, &entries), HookInstallState::NotInstalled);
    install_into(&home, entries.clone()).unwrap();
    let settings: Value = serde_json::from_str(&fs::read_to_string(home.join("settings.json")).unwrap()).unwrap();
    assert_eq!(settings["model"], "x");
    assert_eq!(settings["hooks"]["Stop"].as_array().unwrap().len(), 2);
    assert_eq!(settings["hooks"]["PreToolUse"].as_array().unwrap().len(), 2);
    assert_eq!(state_in(&home, &entries), HookInstallState::Current);

    fs::write(home.join("hooks.json"), r#"{"PreToolUse":[{"matcher":"Execute","hooks":[{"type":"command","command":"audit"}]}]}"#).unwrap();
    assert_eq!(state_in(&home, &entries), HookInstallState::NotInstalled);
    install_into(&home, entries.clone()).unwrap();
    let hooks: Value = serde_json::from_str(&fs::read_to_string(home.join("hooks.json")).unwrap()).unwrap();
    assert!(hooks.get("hooks").is_none());
    assert_eq!(hooks["PreToolUse"].as_array().unwrap().len(), 3);
    assert_eq!(state_in(&home, &entries), HookInstallState::Current);

    fs::write(home.join("hooks.json"), "{broken").unwrap();
    assert!(install_into(&home, entries).is_err());
    assert_eq!(fs::read_to_string(home.join("hooks.json")).unwrap(), "{broken");
    let _ = fs::remove_dir_all(&home);
}
