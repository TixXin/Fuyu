use std::{collections::HashMap, fs, path::Path};

use serde_json::{json, Value};

use super::{current_tool, first_record_timestamp, parse_meta, running, subagents_dir};
use crate::agent_status::snapshot::current_unix_millis;

const RUNNING_META: &str = r#"{"agentType":"general-purpose","isBuiltIn":true,"launchedWithDefaults":true,"description":"摸底其余国内编程代理","toolUseId":"toolu_011XDNVknCVCEvdTAa5vcd1A","spawnDepth":1,"requestShape":"background","requestNonInteractive":true,"pickedEffortModel":"claude-opus-5-5"}"#;
const FINISHED_META: &str = r#"{"agentType":"general-purpose","isBuiltIn":true,"description":"调研 Kimi/Qwen/iFlow 代理","toolUseId":"toolu_013ggPm5o1iHhjjB8czVSGWa","spawnDepth":1,"requestShape":"background","requestNonInteractive":true,"pickedEffortModel":"claude-opus-5-5","finished":true}"#;
const STOPPED_META: &str = r#"{"agentType":"Explore","description":"找出调用点","toolUseId":"toolu_01x","spawnDepth":2,"requestShape":"foreground","stoppedByUser":true}"#;

fn prompt() -> Value {
    json!({
        "parentUuid": null, "isSidechain": true, "agentId": "ab303ab2ac73a8d7b", "type": "user",
        "message": {"role": "user", "content": "摸底：国内还有哪些常见的 AI 编程代理"},
        "uuid": "a1f0", "timestamp": "2026-11-15T13:19:59.487Z", "userType": "external",
        "entrypoint": "claude-desktop", "cwd": "/Users/someone/projects/demo", "sessionId": "9d28", "version": "2.1.325",
    })
}

fn thinking() -> Value {
    json!({
        "parentUuid": "8e62", "isSidechain": true, "agentId": "ab303ab2ac73a8d7b", "type": "assistant",
        "message": {"model": "claude-opus-5-5", "role": "assistant", "content": [{"type": "thinking", "thinking": "", "signature": "x"}]},
        "timestamp": "2026-11-15T13:20:06.226Z",
    })
}

fn tool_use(name: &str, input: Value) -> Value {
    json!({
        "parentUuid": "9b1b", "isSidechain": true, "agentId": "ab303ab2ac73a8d7b", "type": "assistant",
        "message": {"model": "claude-opus-5-5", "role": "assistant", "stop_reason": "tool_use",
            "content": [{"type": "tool_use", "id": "toolu_013e", "name": name, "input": input, "caller": {"type": "direct"}}]},
        "timestamp": "2026-11-15T13:20:07.000Z",
    })
}

fn tool_result() -> Value {
    json!({
        "parentUuid": "e7b9", "isSidechain": true, "agentId": "ab303ab2ac73a8d7b", "type": "user",
        "message": {"role": "user", "content": [{"tool_use_id": "toolu_013e", "type": "tool_result", "content": "ok"}]},
        "timestamp": "2026-11-15T13:20:09.000Z",
    })
}

fn api_request() -> Value {
    json!({"type": "api-request", "sessionId": "9d28", "agentId": "ab303ab2ac73a8d7b", "timestamp": "2026-11-15T13:20:10.000Z"})
}

fn lines(records: &[Value]) -> String {
    records.iter().map(Value::to_string).collect::<Vec<_>>().join("\n") + "\n"
}

fn write_agent(dir: &Path, id: &str, meta: &str, records: &[Value]) {
    fs::write(dir.join(format!("agent-{id}.meta.json")), meta).unwrap();
    fs::write(dir.join(format!("agent-{id}.jsonl")), lines(records)).unwrap();
    fs::write(dir.join(format!("agent-{id}.prefix.json")), r#"{"v":1}"#).unwrap();
}

#[test]
fn meta_tells_what_the_subagent_is_and_whether_it_ended() {
    let running = parse_meta(RUNNING_META).unwrap();
    assert_eq!(running.description.as_deref(), Some("摸底其余国内编程代理"));
    assert_eq!(running.agent_type.as_deref(), Some("general-purpose"));
    assert!(running.background);
    assert_eq!(running.depth, 1);
    assert!(!running.ended);
    assert!(parse_meta(FINISHED_META).unwrap().ended);
    let stopped = parse_meta(STOPPED_META).unwrap();
    assert!(stopped.ended && !stopped.background);
    assert_eq!(stopped.depth, 2);
    assert_eq!(parse_meta("{not json"), None);
}

#[test]
fn the_newest_tool_call_is_current_until_its_result_comes_back() {
    let calling = lines(&[prompt(), thinking(), tool_use("Bash", json!({"command": "rg -il workbuddy src"})), api_request()]);
    let tool = current_tool(&calling).unwrap();
    assert_eq!((tool.name.as_str(), tool.detail.as_deref()), ("Bash", Some("rg -il workbuddy src")));
    let answered = lines(&[prompt(), tool_use("Bash", json!({"command": "ls"})), tool_result()]);
    assert_eq!(current_tool(&answered), None);
    assert_eq!(current_tool(&lines(&[prompt(), thinking()])), None);
}

#[test]
fn start_time_comes_from_the_first_record() {
    assert_eq!(first_record_timestamp(&prompt().to_string()), Some(1_794_748_799_487));
    assert_eq!(first_record_timestamp("{\"type\":\"user\"}"), None);
}

#[test]
fn lists_only_subagents_that_are_still_running() {
    let root = std::env::temp_dir().join(format!("fuyu-subagents-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    let transcript = root.join("-Users-someone-projects-demo").join("9d28656a-260a-498a-a797-19fd44009ad0.jsonl");
    let dir = subagents_dir(&transcript);
    assert!(dir.ends_with("-Users-someone-projects-demo/9d28656a-260a-498a-a797-19fd44009ad0/subagents"));
    fs::create_dir_all(&dir).unwrap();
    write_agent(&dir, "ab303ab2ac73a8d7b", RUNNING_META, &[prompt(), tool_use("WebSearch", json!({"query": "文心快码 CLI"}))]);
    write_agent(&dir, "a68af05284f0bdeb5", FINISHED_META, &[prompt(), tool_result()]);
    write_agent(&dir, "a0000000000000001", STOPPED_META, &[prompt()]);
    fs::write(dir.join("agent-a0000000000000002.meta.json"), RUNNING_META).unwrap();

    let mut cache = HashMap::new();
    let mut kept = Vec::new();
    let now = current_unix_millis();
    let list = running(&dir, now, &mut cache, &mut kept);
    assert_eq!(list.len(), 1);
    let agent = &list[0];
    assert_eq!(agent.id, "ab303ab2ac73a8d7b");
    assert_eq!(agent.description.as_deref(), Some("摸底其余国内编程代理"));
    assert_eq!(agent.current_tool.as_ref().map(|tool| tool.name.as_str()), Some("WebSearch"));
    assert_eq!(agent.started_at, Some(1_794_748_799_487));
    assert!(agent.background);
    assert_eq!(kept.len(), 1);

    let later = now + 31 * 60 * 1000;
    assert!(running(&dir, later, &mut cache, &mut Vec::new()).is_empty());
    assert!(running(&root.join("missing"), now, &mut cache, &mut Vec::new()).is_empty());
    let _ = fs::remove_dir_all(&root);
}
