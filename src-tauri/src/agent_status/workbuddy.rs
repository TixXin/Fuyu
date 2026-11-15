use std::{fs, path::Path};

use serde_json::{json, Value};

use super::claude_hooks::{
    command_hook_entry, install_claude_code_hook_events, turn_hook_entries, APPROVAL_HOOK_TIMEOUT_SECONDS,
};
use super::codex_hooks::{agent_running_command_with, agent_status_command};
use super::harness::{Harness, HookEnv, Hooks, StatusLight};
use super::hooks_state::{hook_entries_state, HookInstallState};
use super::reply_text::{asks_user, plain_reply};
use super::sessions::{SessionTail, TurnState, LAST_MESSAGE_MAX_CHARS};
use super::title::{display_title, prompt_title, shorten, tag_content};
use super::tool_call::codex_tool_call;
use super::{write_text_file, AGENT_APPROVAL_SCRIPT_FILE_NAME, AGENT_RUNNING_NOTIFICATION_ARG};

pub(super) const PROVIDER: &str = "workbuddy";
pub(super) const DIR: &str = ".workbuddy";
pub(super) const APP: &str = "workbuddy";
const EXE: &str = "WorkBuddy.exe";
const INTERRUPTED: &str = "Interrupted by user";

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks {
        install: install_hooks,
        check: hooks_state,
    }),
    status_light: Some(StatusLight {
        running_marker: "agent-workbuddy-running.flag",
        running_hold: "agent-workbuddy-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: None,
    remote: None,
};

pub(super) fn user_query(line: &str) -> Option<String> {
    if !line.contains("<user_query>") {
        return None;
    }
    query_in(&serde_json::from_str(line).ok()?)
}

fn query_in(record: &Value) -> Option<String> {
    if record["type"] != "message" || record["role"] != "user" {
        return None;
    }
    record["content"]
        .as_array()?
        .iter()
        .filter_map(|part| part["text"].as_str())
        .find_map(|text| tag_content(text, "user_query").and_then(prompt_title))
}

pub(super) fn parse_tail(tail: &str) -> SessionTail {
    let mut result = SessionTail::default();
    for record in tail.lines().rev().filter_map(|line| serde_json::from_str::<Value>(line).ok()) {
        let kind = record["type"].as_str().unwrap_or_default();
        if result.session_id.is_none() {
            result.session_id = text(&record["sessionId"]);
        }
        if result.cwd.is_none() {
            result.cwd = text(&record["cwd"]);
        }
        if result.title.is_none() && kind == "ai-title" {
            result.title = record["aiTitle"].as_str().and_then(display_title);
        }
        if result.model.is_none() {
            result.model = text(&record["providerData"]["requestModelName"]);
        }
        if result.last_message.is_none() && kind == "message" && record["role"] == "assistant" {
            if let Some(reply) = output_text(&record["content"]) {
                let plain = plain_reply(&reply);
                result.reply_asks = asks_user(&plain);
                result.last_message = shorten(&plain, LAST_MESSAGE_MAX_CHARS);
            }
        }
        if result.current_tool.is_none() && result.last_prompt.is_none() {
            result.current_tool = codex_tool_call(&record);
        }
        if result.state == TurnState::Unknown {
            result.state = turn_state(kind, &record);
        }
        if result.last_prompt.is_none() {
            if let Some(prompt) = query_in(&record) {
                result.last_prompt = Some(prompt);
                result.turn_started_at = record["timestamp"].as_i64();
            }
        }
    }
    result.settle()
}

fn turn_state(kind: &str, record: &Value) -> TurnState {
    match kind {
        "message" if record["role"] == "assistant" => match record["status"].as_str() {
            Some("incomplete") if record["providerData"]["error"]["message"] == INTERRUPTED => TurnState::Done,
            Some("incomplete") => TurnState::Failed,
            _ => TurnState::Done,
        },
        "message" | "function_call" | "function_call_result" | "reasoning" => TurnState::Working,
        _ => TurnState::Unknown,
    }
}

fn text(value: &Value) -> Option<String> {
    value.as_str().filter(|text| !text.is_empty()).map(str::to_string)
}

fn output_text(content: &Value) -> Option<String> {
    let parts: Vec<&str> = content
        .as_array()?
        .iter()
        .filter(|part| part["type"] == "output_text")
        .filter_map(|part| part["text"].as_str())
        .collect();
    (!parts.is_empty()).then(|| parts.join("\n"))
}

pub(super) fn app_running() -> bool {
    crate::platform::process::running_executable(&[EXE]).is_some()
}

fn settings_path(home_dir: &Path) -> std::path::PathBuf {
    home_dir.join(DIR).join("settings.json")
}

pub(super) fn hook_entries(env: &HookEnv) -> Vec<(&'static str, Value)> {
    let approval_script = env.status_script.with_file_name(AGENT_APPROVAL_SCRIPT_FILE_NAME);
    let mut entries = turn_hook_entries(env.running_script, env.status_script, PROVIDER);
    entries.push((
        "PermissionRequest",
        command_hook_entry(agent_running_command_with(env.running_script, PROVIDER, AGENT_RUNNING_NOTIFICATION_ARG), 5),
    ));
    entries.push((
        "PermissionRequest",
        command_hook_entry(agent_status_command(&approval_script, PROVIDER, "permission"), APPROVAL_HOOK_TIMEOUT_SECONDS),
    ));
    entries
}

fn hooks_state(env: &HookEnv) -> HookInstallState {
    if !env.home_dir.join(DIR).is_dir() {
        return HookInstallState::Absent;
    }
    let Some(config) = fs::read_to_string(settings_path(env.home_dir))
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
    else {
        return HookInstallState::NotInstalled;
    };
    hook_entries_state(&config["hooks"], &hook_entries(env))
}

pub(super) fn install_hooks(env: &HookEnv) -> Result<(), String> {
    if !env.home_dir.join(DIR).is_dir() {
        return Ok(());
    }
    let path = settings_path(env.home_dir);
    let mut config = match fs::read_to_string(&path) {
        Ok(content) if !content.trim().is_empty() => serde_json::from_str::<Value>(&content)
            .map_err(|error| format!("Failed to parse WorkBuddy settings.json: {error}"))?,
        _ => json!({}),
    };
    let root = config
        .as_object_mut()
        .ok_or_else(|| "WorkBuddy settings.json must contain a JSON object.".to_string())?;
    let hooks = root.entry("hooks").or_insert_with(|| json!({}));
    if !hooks.is_object() {
        *hooks = json!({});
    }
    let hooks = hooks
        .as_object_mut()
        .ok_or_else(|| "Failed to prepare WorkBuddy hooks object.".to_string())?;
    install_claude_code_hook_events(hooks, hook_entries(env));
    let content = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Failed to serialize WorkBuddy settings.json: {error}"))?;
    write_text_file(&path, &content)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PROMPT: &str = r#"{"id":"u1","timestamp":1785595820479,"type":"message","role":"user","content":[{"type":"input_text","text":"<system-reminder data-role=\"user-context\">\n<user_info>OS</user_info>\n</system-reminder>\n<user_query>找一下图片中的村落</user_query>"}],"sessionId":"s1","cwd":"D:\\work\\a"}"#;
    const TITLE: &str = r#"{"timestamp":1785595823964,"type":"ai-title","aiTitle":"识别图片中的建筑","sessionId":"s1","cwd":"D:\\work\\a"}"#;
    const SAYS: &str = r#"{"id":"m1","timestamp":1785595831035,"type":"message","role":"assistant","status":"completed","content":[{"type":"output_text","text":"我看看这张图片。"}],"providerData":{"requestModelName":"Kimi-K3"},"sessionId":"s1","cwd":"D:\\work\\a"}"#;
    const CALLS: &str = r#"{"id":"m1","timestamp":1785595831035,"type":"function_call","name":"Bash","callId":"Bash_0","arguments":"{\"command\":\"ls -la\"}","providerData":{"requestModelName":"Kimi-K3"},"sessionId":"s1","cwd":"D:\\work\\a"}"#;
    const RESULT: &str = r#"{"id":"r1","timestamp":1785595832000,"type":"function_call_result","name":"Bash","callId":"Bash_0","status":"completed","output":{"type":"text","text":"ok"},"sessionId":"s1","cwd":"D:\\work\\a"}"#;
    const INTERRUPTED_REPLY: &str = r#"{"id":"m2","timestamp":1785595840000,"type":"message","role":"assistant","status":"incomplete","content":[{"type":"output_text","text":"stopped"}],"providerData":{"skipRun":true,"error":{"message":"Interrupted by user"}},"sessionId":"s1"}"#;
    const FAILED_REPLY: &str = r#"{"id":"m3","timestamp":1785595840000,"type":"message","role":"assistant","status":"incomplete","content":[{"type":"output_text","text":"400 input length too long"}],"providerData":{"skipRun":true,"error":{"code":400,"message":"400 input length too long"}},"sessionId":"s1"}"#;

    fn tail(lines: &[&str]) -> SessionTail {
        parse_tail(&lines.join("\n"))
    }

    #[test]
    fn reads_title_prompt_model_and_reply() {
        let parsed = tail(&[PROMPT, TITLE, CALLS, RESULT, SAYS]);
        assert_eq!(parsed.session_id.as_deref(), Some("s1"));
        assert_eq!(parsed.cwd.as_deref(), Some(r"D:\work\a"));
        assert_eq!(parsed.title.as_deref(), Some("识别图片中的建筑"));
        assert_eq!(parsed.model.as_deref(), Some("Kimi-K3"));
        assert_eq!(parsed.last_prompt.as_deref(), Some("找一下图片中的村落"));
        assert_eq!(parsed.turn_started_at, Some(1_785_595_820_479));
        assert_eq!(parsed.last_message.as_deref(), Some("我看看这张图片。"));
        assert_eq!(parsed.state, TurnState::Done);
        assert_eq!(parsed.current_tool, None);
    }

    #[test]
    fn a_tool_call_or_its_result_keeps_the_turn_running() {
        let calling = tail(&[PROMPT, SAYS, CALLS]);
        assert_eq!(calling.state, TurnState::Working);
        assert_eq!(calling.current_tool.map(|tool| (tool.name, tool.detail)), Some(("Bash".into(), Some("ls -la".into()))));
        assert_eq!(tail(&[PROMPT, CALLS, RESULT]).state, TurnState::Working);
        assert_eq!(tail(&[PROMPT]).state, TurnState::Working);
    }

    #[test]
    fn an_interrupted_turn_is_done_and_an_error_fails() {
        assert_eq!(tail(&[PROMPT, CALLS, INTERRUPTED_REPLY]).state, TurnState::Done);
        assert_eq!(tail(&[PROMPT, FAILED_REPLY]).state, TurnState::Failed);
    }

    #[test]
    fn user_query_skips_messages_without_one() {
        assert_eq!(user_query(PROMPT).as_deref(), Some("找一下图片中的村落"));
        assert_eq!(user_query(SAYS), None);
        let summary = r#"{"type":"message","role":"user","content":[{"type":"input_text","text":"Please continue with the conversation"}]}"#;
        assert_eq!(user_query(summary), None);
    }

    #[test]
    fn installs_the_turn_and_approval_hooks_only_where_workbuddy_lives() {
        let home = std::env::temp_dir().join(format!("fuyu-workbuddy-{}", std::process::id()));
        let _ = fs::remove_dir_all(&home);
        let running = home.join(".fuyu").join(crate::agent_status::AGENT_RUNNING_SCRIPT_FILE_NAME);
        let status = home.join(".fuyu").join(crate::agent_status::AGENT_STATUS_SCRIPT_FILE_NAME);
        let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
        install_hooks(&env).unwrap();
        assert!(!home.join(DIR).exists());
        assert_eq!(hooks_state(&env), HookInstallState::Absent);

        fs::create_dir_all(home.join(DIR)).unwrap();
        assert_eq!(hooks_state(&env), HookInstallState::NotInstalled);
        let settings = settings_path(&home);
        fs::write(&settings, r#"{"sandbox":{"on":true},"hooks":{"Stop":[{"hooks":[{"type":"command","command":"mine"}]}]}}"#).unwrap();
        install_hooks(&env).unwrap();
        install_hooks(&env).unwrap();
        assert_eq!(hooks_state(&env), HookInstallState::Current);
        let config: Value = serde_json::from_str(&fs::read_to_string(&settings).unwrap()).unwrap();
        assert_eq!(config["sandbox"]["on"], true);
        assert_eq!(config["hooks"]["Stop"][0]["hooks"][0]["command"], "mine");
        assert_eq!(config["hooks"]["Stop"].as_array().unwrap().len(), 2);
        let permission = config["hooks"]["PermissionRequest"].as_array().unwrap();
        assert_eq!(permission.len(), 2);
        let command = |entry: &Value| entry["hooks"][0]["command"].as_str().unwrap().to_string();
        assert!(command(&permission[0]).contains("workbuddy notification"));
        assert!(command(&permission[1]).contains("fuyu-agent-approval"));
        assert!(command(&permission[1]).contains("workbuddy permission"));
        assert_eq!(permission[1]["hooks"][0]["timeout"], APPROVAL_HOOK_TIMEOUT_SECONDS);
        assert_eq!(config["hooks"]["PreToolUse"][0]["matcher"], "*");
        assert!(command(&config["hooks"]["Stop"][1]).contains("workbuddy completed"));

        let mut stale = config.clone();
        stale["hooks"]["Stop"].as_array_mut().unwrap().pop();
        fs::write(&settings, stale.to_string()).unwrap();
        assert_eq!(hooks_state(&env), HookInstallState::Outdated);
        fs::remove_dir_all(&home).unwrap();
    }
}
