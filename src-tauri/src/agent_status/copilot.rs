use std::{
    fs,
    path::{Path, PathBuf},
};

use serde_json::Value;

use super::claude_compat::{Compat, Home, Records, Reply, Waiting};
use super::copilot_hooks;
use super::harness::{Harness, Hooks, ScanRoots, StatusLight};
use super::markers::{file_modified_unix_millis, AGENT_RUNNING_STALE_AFTER_MS};
use super::session_scan::{pick_title, read_tail};
use super::sessions::{parse_timestamp_ms, session_phase, AgentSessionSummary, SessionTail, TurnState};
use super::title::{display_title, folder_title, prompt_title, shorten};
use super::tool_call::ToolCall;

pub(super) const PROVIDER: &str = "copilot";
const HOME_DIR: &str = ".copilot";
const HOME_ENV: &str = "COPILOT_HOME";
const SESSIONS_DIR: &str = "session-state";
const EVENTS_FILE: &str = "events.jsonl";
const WORKSPACE_FILE: &str = "workspace.yaml";
const HEAD_LINES: usize = 200;
const TOOL_DETAIL_MAX_CHARS: usize = 80;

pub(super) const SPEC: Compat = Compat {
    provider: PROVIDER,
    label: "GitHub Copilot CLI",
    homes: &[Home { dir: HOME_DIR, env: HOME_ENV }],
    chats: None,
    records: Records::Claude,
    prompt_file: "copilot-instructions.md",
    waiting: Waiting::PermissionRequest,
    hooks_file: copilot_hooks::HOOKS_FILE,
    reply: Reply::Behavior,
    aliases: &[("sessionId", "session_id"), ("toolName", "tool_name"), ("toolArgs", "tool_input")],
};

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks { install: copilot_hooks::install, check: copilot_hooks::check }),
    status_light: Some(StatusLight {
        running_marker: "agent-copilot-running.flag",
        running_hold: "agent-copilot-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: Some(sessions),
    remote: None,
};

fn sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    sessions_in(&home(roots.home_dir), now, window_ms)
}

pub(super) fn home(home_dir: &Path) -> PathBuf {
    std::env::var_os(HOME_ENV)
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
        .unwrap_or_else(|| home_dir.join(HOME_DIR))
}

pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
    vec![home(home_dir).join(SPEC.prompt_file)]
}

pub(super) fn sessions_in(home: &Path, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    fs::read_dir(home.join(SESSIONS_DIR))
        .map(|entries| {
            entries
                .flatten()
                .map(|entry| entry.path())
                .filter(|path| path.is_dir() && !path.file_name().is_some_and(|name| name.to_string_lossy().starts_with('.')))
                .filter_map(|dir| read_session(&dir, now, window_ms))
                .collect()
        })
        .unwrap_or_default()
}

pub(super) fn read_session(dir: &Path, now: i64, window_ms: i64) -> Option<AgentSessionSummary> {
    let events = dir.join(EVENTS_FILE);
    let workspace_file = dir.join(WORKSPACE_FILE);
    let updated_at = [file_modified_unix_millis(&events), file_modified_unix_millis(&workspace_file)]
        .into_iter()
        .flatten()
        .max()?;
    if now - updated_at > window_ms {
        return None;
    }
    let workspace = fs::read_to_string(&workspace_file).unwrap_or_default();
    let head = read_head(&events);
    let start = head.lines().filter_map(record).find(|event| event["type"] == "session.start");
    let first_prompt = head.lines().filter_map(record).find_map(|event| user_prompt(&event));
    let tail = read_tail(&events).map(|tail| parse_events_tail(&tail)).unwrap_or_default();
    if first_prompt.is_none() && tail.inner.last_prompt.is_none() && yaml_value(&workspace, "summary").is_none() {
        return None;
    }
    let session_id = start
        .as_ref()
        .and_then(|event| text(&event["data"]["sessionId"]))
        .or_else(|| yaml_value(&workspace, "id"))
        .or_else(|| dir.file_name().map(|name| name.to_string_lossy().into_owned()))?;
    Some(summary(session_id, &workspace, start.as_ref(), first_prompt, tail, updated_at, now))
}

pub(super) fn summary(
    session_id: String,
    workspace: &str,
    start: Option<&Value>,
    first_prompt: Option<String>,
    mut tail: EventsTail,
    updated_at: i64,
    now: i64,
) -> AgentSessionSummary {
    let start = start.map(|event| &event["data"]);
    let cwd = yaml_value(workspace, "cwd").or_else(|| start.and_then(|data| text(&data["context"]["cwd"])));
    let named = yaml_value(workspace, "summary").as_deref().and_then(display_title);
    let (title, title_source) = pick_title(None, named, first_prompt, cwd.as_deref().and_then(folder_title));
    let model = tail.model.take().or_else(|| start.and_then(|data| text(&data["selectedModel"])));
    let effort = start.and_then(|data| text(&data["reasoningEffort"]));
    let turn = tail.state;
    let closed = tail.closed;
    tail.inner.state = turn;
    let tail = tail.inner.settle();
    AgentSessionSummary {
        provider: PROVIDER,
        session_id,
        cwd,
        title,
        title_source,
        model,
        effort,
        phase: if closed && turn == TurnState::Working {
            "completed"
        } else {
            session_phase(turn, now - updated_at, AGENT_RUNNING_STALE_AFTER_MS)
        },
        last_message: tail.last_message,
        reply_marker: tail.reply_marker,
        reply_asks: tail.reply_asks,
        updated_at,
        host: None,
        turn_started_at: tail.turn_started_at,
        last_prompt: tail.last_prompt,
        current_tool: tail.current_tool,
        permission_mode: None,
        subagents: 0,
        background_tasks: 0,
        compacting: false,
        todos: None,
        closed,
        remote_host: None,
        context_tokens: tail.context_tokens,
    }
}

#[derive(Default)]
pub(super) struct EventsTail {
    pub(super) inner: SessionTail,
    pub(super) state: TurnState,
    pub(super) model: Option<String>,
    pub(super) closed: bool,
}

pub(super) fn parse_events_tail(tail: &str) -> EventsTail {
    let mut result = EventsTail::default();
    let mut seen_any = false;
    for event in tail.lines().rev().filter_map(record) {
        let data = &event["data"];
        if data.get("parentToolCallId").is_some_and(|id| !id.is_null()) {
            continue;
        }
        let kind = event["type"].as_str().unwrap_or_default();
        if !seen_any && kind == "session.shutdown" {
            result.closed = true;
        }
        seen_any = true;
        if result.model.is_none() {
            result.model = text(&data["newModel"]).or_else(|| text(&data["model"]));
        }
        match kind {
            "abort" | "session.task_complete" if result.state == TurnState::Unknown => {
                result.state = TurnState::Done;
                if result.inner.last_message.is_none() {
                    if let Some(summary) = data["summary"].as_str() {
                        result.inner.take_reply(summary);
                    }
                }
            }
            "session.error" if result.state == TurnState::Unknown => result.state = TurnState::Failed,
            "assistant.message" => read_message(&mut result, data),
            "tool.execution_start" | "tool.execution_complete" | "assistant.turn_start" if result.state == TurnState::Unknown => {
                result.state = TurnState::Working;
            }
            "user.message" if result.inner.last_prompt.is_none() => {
                if let Some(prompt) = user_prompt(&event) {
                    if result.state == TurnState::Unknown {
                        result.state = TurnState::Working;
                    }
                    result.inner.last_prompt = Some(prompt);
                    result.inner.turn_started_at = event["timestamp"].as_str().and_then(parse_timestamp_ms);
                }
            }
            _ => {}
        }
    }
    result
}

fn read_message(result: &mut EventsTail, data: &Value) {
    let tool = tool_call(data);
    if result.state == TurnState::Unknown {
        result.state = if tool.is_some() { TurnState::Working } else { TurnState::Done };
        if result.state == TurnState::Working {
            result.inner.current_tool = tool;
        }
    }
    if result.inner.last_message.is_none() {
        if let Some(content) = data["content"].as_str().filter(|content| !content.trim().is_empty()) {
            result.inner.take_reply(content);
        }
    }
}

fn tool_call(data: &Value) -> Option<ToolCall> {
    let request = data["toolRequests"].as_array()?.last()?;
    let name = text(&request["name"])?;
    let arguments = match &request["arguments"] {
        Value::String(raw) => serde_json::from_str(raw).unwrap_or(Value::Null),
        other => other.clone(),
    };
    let detail = ["command", "path", "file_path", "pattern", "url", "query", "description"]
        .iter()
        .find_map(|key| arguments[*key].as_str())
        .or_else(|| request["intentionSummary"].as_str())
        .and_then(|value| shorten(value, TOOL_DETAIL_MAX_CHARS));
    Some(ToolCall { name, detail })
}

fn user_prompt(event: &Value) -> Option<String> {
    if event["type"] != "user.message" {
        return None;
    }
    let content = event["data"]["content"].as_str()?.trim();
    if content.starts_with('<') {
        return None;
    }
    prompt_title(content)
}

fn record(line: &str) -> Option<Value> {
    serde_json::from_str(line).ok()
}

pub(super) fn yaml_value(yaml: &str, key: &str) -> Option<String> {
    yaml.lines().find_map(|line| {
        let value = line.strip_prefix(key)?.strip_prefix(':')?.trim();
        let value = value
            .strip_prefix('"')
            .and_then(|rest| rest.strip_suffix('"'))
            .map(|inner| inner.replace("\\\"", "\"").replace("\\\\", "\\"))
            .or_else(|| value.strip_prefix('\'').and_then(|rest| rest.strip_suffix('\'')).map(|inner| inner.replace("''", "'")))
            .unwrap_or_else(|| value.to_string());
        (!value.is_empty() && !matches!(value.as_str(), "|" | ">" | "|-" | ">-" | "null" | "~")).then_some(value)
    })
}

fn read_head(path: &Path) -> String {
    use std::io::{BufRead, BufReader};
    let Ok(file) = fs::File::open(path) else {
        return String::new();
    };
    BufReader::new(file)
        .split(b'\n')
        .map_while(Result::ok)
        .take(HEAD_LINES)
        .map(|line| String::from_utf8_lossy(&line).into_owned())
        .collect::<Vec<_>>()
        .join("\n")
}

fn text(value: &Value) -> Option<String> {
    value.as_str().filter(|text| !text.is_empty()).map(str::to_string)
}

#[cfg(test)]
#[path = "copilot_tests.rs"]
mod tests;
