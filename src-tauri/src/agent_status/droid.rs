use std::{
    fs,
    path::{Path, PathBuf},
};

use serde_json::{json, Value};

use super::claude_compat::{Compat, Home, Records, Reply, Waiting};
use super::droid_hooks;
use super::harness::{Harness, Hooks, ScanRoots, StatusLight};
use super::markers::{file_modified_unix_millis, AGENT_RUNNING_STALE_AFTER_MS};
use super::session_scan::{pick_title, read_tail};
use super::sessions::{parse_claude_tail, session_phase, AgentSessionSummary, SessionTail};
use super::title::{display_title, folder_title, user_prompt_in_record};

pub(super) const PROVIDER: &str = "droid";
const HOME_DIR: &str = ".factory";
const HOME_ENV: &str = "FACTORY_HOME";
const SESSIONS_DIR: &str = "sessions";
const HEAD_LINES: usize = 50;

pub(super) const SPEC: Compat = Compat {
    provider: PROVIDER,
    label: "Droid",
    homes: &[Home { dir: HOME_DIR, env: HOME_ENV }],
    chats: None,
    records: Records::Claude,
    prompt_file: "AGENTS.md",
    waiting: Waiting::PermissionPrompt,
    hooks_file: "settings.json",
    reply: Reply::None,
    aliases: &[],
};

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks { install: droid_hooks::install, check: droid_hooks::check }),
    status_light: Some(StatusLight {
        running_marker: "agent-droid-running.flag",
        running_hold: "agent-droid-running-hold.flag",
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

pub(super) fn session_files(home: &Path) -> Vec<PathBuf> {
    children(&home.join(SESSIONS_DIR))
        .into_iter()
        .filter(|path| path.is_dir())
        .flat_map(|project| children(&project))
        .filter(|path| path.extension().is_some_and(|extension| extension == "jsonl"))
        .collect()
}

fn children(dir: &Path) -> Vec<PathBuf> {
    fs::read_dir(dir)
        .map(|entries| entries.flatten().map(|entry| entry.path()).collect())
        .unwrap_or_default()
}

pub(super) fn sessions_in(home: &Path, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    session_files(home)
        .into_iter()
        .filter_map(|path| read_session(&path, now, window_ms))
        .collect()
}

pub(super) fn read_session(path: &Path, now: i64, window_ms: i64) -> Option<AgentSessionSummary> {
    let updated_at = file_modified_unix_millis(path)?;
    if now - updated_at > window_ms {
        return None;
    }
    let head: Vec<Value> = read_head(path).lines().filter_map(|line| serde_json::from_str(line).ok()).collect();
    let start = head.iter().find(|record| record["type"] == "session_start");
    let first_prompt = head.iter().map(claude_shaped).find_map(|record| user_prompt_in_record(&record.to_string()));
    let tail = read_tail(path).map(|tail| parse_droid_tail(&tail)).unwrap_or_default();
    if first_prompt.is_none() && tail.last_prompt.is_none() {
        return None;
    }
    let session_id = start
        .and_then(|start| text(&start["id"]))
        .or_else(|| path.file_stem().map(|stem| stem.to_string_lossy().into_owned()))?;
    let settings = fs::read_to_string(path.with_extension("settings.json"))
        .ok()
        .and_then(|content| serde_json::from_str::<Value>(&content).ok())
        .unwrap_or(Value::Null);
    let project_cwd = path
        .parent()
        .and_then(|dir| dir.file_name())
        .map(|name| name.to_string_lossy().into_owned())
        .and_then(|name| name.strip_prefix('-').map(|rest| format!("/{}", rest.replace('-', "/"))));
    Some(summary(session_id, start, &settings, project_cwd, first_prompt, tail, updated_at, now))
}

#[allow(clippy::too_many_arguments)]
pub(super) fn summary(
    session_id: String,
    start: Option<&Value>,
    settings: &Value,
    project_cwd: Option<String>,
    first_prompt: Option<String>,
    tail: SessionTail,
    updated_at: i64,
    now: i64,
) -> AgentSessionSummary {
    let cwd = start.and_then(|start| text(&start["cwd"])).or(project_cwd);
    let named = start
        .and_then(|start| text(&start["sessionTitle"]).or_else(|| text(&start["title"])))
        .as_deref()
        .and_then(display_title);
    let (title, title_source) = pick_title(None, named, first_prompt, cwd.as_deref().and_then(folder_title));
    let model = text(&settings["model"]).or(tail.model.clone());
    let state = tail.state;
    let tail = tail.settle();
    AgentSessionSummary {
        provider: PROVIDER,
        session_id,
        cwd,
        title,
        title_source,
        model,
        effort: text(&settings["reasoningEffort"]),
        phase: session_phase(state, now - updated_at, AGENT_RUNNING_STALE_AFTER_MS),
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
        todos: tail.todos,
        closed: false,
        remote_host: None,
        context_tokens: None,
    }
}

pub(super) fn parse_droid_tail(tail: &str) -> SessionTail {
    let lines: Vec<String> = tail
        .lines()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter(|record| record["type"] == "message")
        .map(|record| claude_shaped(&record).to_string())
        .collect();
    parse_claude_tail(&lines.join("\n"))
}

fn claude_shaped(record: &Value) -> Value {
    if record["type"] != "message" {
        return Value::Null;
    }
    let message = &record["message"];
    let mut shaped = json!({
        "type": message["role"],
        "timestamp": record["timestamp"],
        "message": { "role": message["role"], "content": message["content"], "model": message["model"] },
    });
    if message["visibility"] == "hidden" {
        shaped["isMeta"] = Value::Bool(true);
    }
    if message["role"] == "assistant" {
        let calls_tool = message["content"]
            .as_array()
            .is_some_and(|blocks| blocks.iter().any(|block| block["type"] == "tool_use"));
        shaped["message"]["stop_reason"] = match &message["stop_reason"] {
            Value::String(reason) => Value::String(reason.clone()),
            _ if calls_tool => Value::Null,
            _ => Value::String("end_turn".to_string()),
        };
    }
    shaped
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
#[path = "droid_tests.rs"]
mod tests;
