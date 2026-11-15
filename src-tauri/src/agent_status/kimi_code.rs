use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
};

use serde_json::Value;

use super::harness::{Harness, Hooks, ScanRoots, StatusLight};
use super::kimi_hooks;
use super::markers::{file_modified_unix_millis, AGENT_RUNNING_STALE_AFTER_MS};
use super::session_scan::{pick_title, read_tail};
use super::sessions::{session_phase, AgentSessionSummary, SessionTail, TurnState};
use super::title::{display_title, folder_title, prompt_title, shorten};
use super::tool_call::ToolCall;

pub(super) const PROVIDER: &str = "kimiCode";
const HOME_DIR: &str = ".kimi-code";
const HOME_ENV: &str = "KIMI_CODE_HOME";
const STATE_FILE: &str = "state.json";
const META_SCOPE: &str = "session-meta";
const SESSION_INDEX: &str = "session_index.jsonl";
const CHILD_KIND_KEY: &str = "child_session_kind";
const TOOL_DETAIL_MAX_CHARS: usize = 80;

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks { install: kimi_hooks::install, check: kimi_hooks::check }),
    status_light: Some(StatusLight {
        running_marker: "agent-kimiCode-running.flag",
        running_hold: "agent-kimiCode-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: Some(sessions),
    remote: None,
};

pub(super) fn home(home_dir: &Path) -> PathBuf {
    std::env::var_os(HOME_ENV)
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
        .unwrap_or_else(|| home_dir.join(HOME_DIR))
}

pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
    vec![home(home_dir).join("AGENTS.md")]
}

fn sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    session_dirs(&home(roots.home_dir))
        .into_iter()
        .filter_map(|dir| read_session(&dir, now, window_ms))
        .collect()
}

pub(super) fn session_dirs(home: &Path) -> BTreeSet<PathBuf> {
    let mut dirs: BTreeSet<PathBuf> = children(&home.join("sessions"))
        .into_iter()
        .flat_map(|workspace| children(&workspace))
        .collect();
    let index = fs::read_to_string(home.join(SESSION_INDEX)).unwrap_or_default();
    dirs.extend(
        index
            .lines()
            .filter_map(|line| serde_json::from_str::<Value>(line).ok())
            .filter_map(|entry| entry["sessionDir"].as_str().map(PathBuf::from))
            .filter(|dir| dir.is_absolute() && dir.is_dir()),
    );
    dirs
}

fn children(dir: &Path) -> Vec<PathBuf> {
    fs::read_dir(dir)
        .map(|entries| entries.flatten().map(|entry| entry.path()).filter(|path| path.is_dir()).collect())
        .unwrap_or_default()
}

fn state_path(dir: &Path) -> Option<PathBuf> {
    [dir.join(STATE_FILE), dir.join(META_SCOPE).join(STATE_FILE)]
        .into_iter()
        .find(|path| path.is_file())
}

pub(super) fn read_session(dir: &Path, now: i64, window_ms: i64) -> Option<AgentSessionSummary> {
    let state_file = state_path(dir)?;
    let wire = dir.join("agents").join("main").join("wire.jsonl");
    let updated_at = [file_modified_unix_millis(&state_file), file_modified_unix_millis(&wire)]
        .into_iter()
        .flatten()
        .max()?;
    if now - updated_at > window_ms {
        return None;
    }
    let state: Value = serde_json::from_str(&fs::read_to_string(&state_file).ok()?).ok()?;
    if state["archived"] == Value::Bool(true) || state["custom"][CHILD_KIND_KEY] == "child" {
        return None;
    }
    let session_id = text(&state["id"]).or_else(|| dir.file_name().map(|name| name.to_string_lossy().into_owned()))?;
    let tail = read_tail(&wire).map(|tail| parse_wire_tail(&tail)).unwrap_or_default();
    Some(summary(session_id, &state, tail, updated_at, now))
}

pub(super) fn summary(session_id: String, state: &Value, mut tail: SessionTail, updated_at: i64, now: i64) -> AgentSessionSummary {
    let cwd = text(&state["cwd"]).or_else(|| text(&state["workDir"]));
    let last_prompt = state["lastPrompt"].as_str().and_then(prompt_title).or(tail.last_prompt.take());
    let named = state["title"].as_str().and_then(display_title);
    let (renamed, generated) = match state["titleKind"].as_str() {
        Some("custom") => (named, None),
        _ => (None, named),
    };
    let (title, title_source) = pick_title(renamed, generated, last_prompt.clone(), cwd.as_deref().and_then(folder_title));
    if tail.state == TurnState::Unknown {
        tail.state = match state["lastTurnReason"].as_str() {
            Some("failed") => TurnState::Failed,
            _ => TurnState::Done,
        };
    }
    let turn = tail.state;
    let tail = tail.settle();
    AgentSessionSummary {
        provider: PROVIDER,
        session_id,
        cwd,
        title,
        title_source,
        model: tail.model,
        effort: None,
        phase: session_phase(turn, now - updated_at, AGENT_RUNNING_STALE_AFTER_MS),
        last_message: tail.last_message,
        reply_marker: tail.reply_marker,
        reply_asks: tail.reply_asks,
        updated_at,
        host: None,
        turn_started_at: tail.turn_started_at,
        last_prompt,
        current_tool: tail.current_tool,
        permission_mode: None,
        subagents: 0,
        background_tasks: 0,
        compacting: false,
        todos: None,
        closed: false,
        remote_host: None,
        parent_id: None,
        context_tokens: tail.context_tokens,
    }
}

pub(super) fn parse_wire_tail(tail: &str) -> SessionTail {
    let mut result = SessionTail::default();
    let mut in_turn = false;
    for record in tail.lines().rev().filter_map(|line| serde_json::from_str::<Value>(line).ok()) {
        if record["agentId"].as_str().is_some_and(|agent| agent != "main") {
            continue;
        }
        in_turn |= record["type"] == "context.append_message";
        match record["type"].as_str().unwrap_or_default() {
            "turn.ended" if result.state == TurnState::Unknown => {
                result.state = match record["reason"].as_str() {
                    Some("failed") => TurnState::Failed,
                    _ => TurnState::Done,
                };
            }
            "turn.cancel" if result.state == TurnState::Unknown && record["target"] != "queued" => {
                result.state = TurnState::Done;
            }
            "turn.prompt" if result.last_prompt.is_none() => {
                if result.state == TurnState::Unknown {
                    result.state = TurnState::Working;
                }
                result.turn_started_at = record["time"].as_i64();
                result.last_prompt = prompt_text(&record["input"]).as_deref().and_then(prompt_title);
            }
            "usage.record" if result.model.is_none() => {
                result.model = text(&record["model"]);
            }
            "context.append_message" => read_message(&mut result, &record["message"]),
            _ => {}
        }
    }
    if result.state == TurnState::Unknown && in_turn {
        result.state = TurnState::Working;
    }
    result
}

fn read_message(result: &mut SessionTail, message: &Value) {
    if message["role"] != "assistant" || message["partial"] == Value::Bool(true) {
        return;
    }
    if result.current_tool.is_none() && result.last_prompt.is_none() && result.state == TurnState::Unknown {
        result.current_tool = tool_call(message);
    }
    if result.last_message.is_none() {
        if let Some(reply) = text_parts(&message["content"]) {
            result.take_reply(&reply);
        }
    }
}

fn text_parts(content: &Value) -> Option<String> {
    let texts: Vec<&str> = content
        .as_array()?
        .iter()
        .filter(|part| part["type"] == "text")
        .filter_map(|part| part["text"].as_str())
        .filter(|text| !text.trim().is_empty())
        .collect();
    (!texts.is_empty()).then(|| texts.join("\n"))
}

fn prompt_text(input: &Value) -> Option<String> {
    match input {
        Value::String(text) => Some(text.clone()),
        other => text_parts(other),
    }
}

fn tool_call(message: &Value) -> Option<ToolCall> {
    let call = message["toolCalls"].as_array()?.last()?;
    let name = text(&call["name"]).or_else(|| text(&call["function"]["name"]))?;
    let arguments = call["arguments"]
        .as_str()
        .or_else(|| call["function"]["arguments"].as_str())
        .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .unwrap_or(Value::Null);
    let detail = ["command", "file_path", "path", "pattern", "url", "query", "description"]
        .iter()
        .find_map(|key| arguments[*key].as_str())
        .and_then(|value| shorten(value, TOOL_DETAIL_MAX_CHARS));
    Some(ToolCall { name, detail })
}

fn text(value: &Value) -> Option<String> {
    value.as_str().filter(|text| !text.is_empty()).map(str::to_string)
}

#[cfg(test)]
#[path = "kimi_code_tests.rs"]
mod tests;
