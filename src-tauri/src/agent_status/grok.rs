use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
    time::SystemTime,
};

use serde_json::{json, Value};

use super::claude_compat::{self, Compat, Home, Records, Reply, Waiting};
use super::claude_hooks::command_hook_entry;
use super::codex_hooks::agent_status_command;
use super::harness::{Harness, HookEnv, Hooks, ScanRoots, StatusLight};
use super::hooks_state::HookInstallState;
use super::markers::AGENT_RUNNING_STALE_AFTER_MS;
use super::session_scan::{pick_title, read_tail};
use super::sessions::{parse_timestamp_ms, session_phase, AgentSessionSummary, SessionTail, TurnState};
use super::snapshot::system_time_to_unix_millis;
use super::title::{display_title, folder_title, prompt_title, shorten};
use super::tool_call::ToolCall;

pub(super) const PROVIDER: &str = "grok";
const RULES_DIR: &str = "rules";
const HEAD_LINES: usize = 200;
const DETAIL_MAX_CHARS: usize = 80;
const DETAIL_KEYS: [&str; 7] = ["command", "file_path", "target_file", "path", "pattern", "query", "url"];

pub(super) const SPEC: Compat = Compat {
    provider: PROVIDER,
    label: "Grok CLI",
    homes: &[Home { dir: ".grok", env: "GROK_HOME" }],
    chats: None,
    records: Records::Claude,
    prompt_file: "rules/fuyu-island.md",
    waiting: Waiting::PermissionPrompt,
    hooks_file: "hooks/fuyu-island.json",
    reply: Reply::None,
    aliases: &[
        ("sessionId", "session_id"),
        ("toolName", "tool_name"),
        ("toolInput", "tool_input"),
        ("notificationType", "notification_type"),
    ],
};

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks { install, check }),
    status_light: Some(StatusLight {
        running_marker: "agent-grok-running.flag",
        running_hold: "agent-grok-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: Some(sessions),
    remote: None,
};

fn hook_entries(env: &HookEnv) -> Vec<(&'static str, Value)> {
    let mut entries = claude_compat::hook_entries(&SPEC, env);
    entries.push(("StopCancelled", command_hook_entry(agent_status_command(env.status_script, PROVIDER, "completed"), 10)));
    entries
}

fn install(env: &HookEnv) -> Result<(), String> {
    claude_compat::install_hooks_with(&SPEC, env, &hook_entries(env))?;
    for home in claude_compat::home_dirs(&SPEC, env.home_dir).into_iter().filter(|home| home.is_dir()) {
        fs::create_dir_all(home.join(RULES_DIR)).map_err(|error| format!("Failed to create Grok rules folder: {error}"))?;
    }
    Ok(())
}

fn check(env: &HookEnv) -> HookInstallState {
    claude_compat::hooks_state_with(&SPEC, env, &hook_entries(env))
}

pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
    claude_compat::prompt_files(&SPEC, home_dir)
}

fn sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    if roots.local_app_dir.is_none() {
        return Vec::new();
    }
    let mut seen = HashSet::new();
    let listed = claude_compat::home_dirs(&SPEC, roots.home_dir)
        .iter()
        .flat_map(|home| session_dirs(home))
        .filter_map(|dir| cached_session(&dir, now, window_ms, &mut seen))
        .collect();
    if let Some(cache) = CACHE.lock().unwrap_or_else(PoisonError::into_inner).as_mut() {
        cache.retain(|dir, _| seen.contains(dir));
    }
    listed
}

fn session_dirs(home: &Path) -> Vec<PathBuf> {
    child_dirs(&home.join("sessions")).iter().flat_map(|project| child_dirs(project)).collect()
}

fn child_dirs(dir: &Path) -> Vec<PathBuf> {
    fs::read_dir(dir)
        .map(|entries| entries.flatten().map(|entry| entry.path()).filter(|path| path.is_dir()).collect())
        .unwrap_or_default()
}

type Stamp = [(u64, Option<SystemTime>); 3];

struct Cached {
    stamp: Stamp,
    summary: Option<(AgentSessionSummary, TurnState)>,
}

static CACHE: Mutex<Option<HashMap<PathBuf, Cached>>> = Mutex::new(None);

fn stamp_of(path: &Path) -> (u64, Option<SystemTime>) {
    fs::metadata(path).map(|meta| (meta.len(), meta.modified().ok())).unwrap_or((0, None))
}

fn cached_session(dir: &Path, now: i64, window_ms: i64, seen: &mut HashSet<PathBuf>) -> Option<AgentSessionSummary> {
    let files = [dir.join("events.jsonl"), dir.join("chat_history.jsonl"), dir.join("summary.json")];
    let stamp: Stamp = [stamp_of(&files[0]), stamp_of(&files[1]), stamp_of(&files[2])];
    let updated_at = stamp.iter().filter_map(|(_, modified)| modified.and_then(system_time_to_unix_millis)).max()?;
    if now - updated_at > window_ms {
        return None;
    }
    seen.insert(dir.to_path_buf());
    let mut cache = CACHE.lock().unwrap_or_else(PoisonError::into_inner);
    let cache = cache.get_or_insert_with(HashMap::new);
    if cache.get(dir).is_none_or(|cached| cached.stamp != stamp) {
        let summary = read_session(dir, updated_at);
        cache.insert(dir.to_path_buf(), Cached { stamp, summary });
    }
    let (summary, state) = cache.get(dir)?.summary.clone()?;
    let mut summary = summary;
    summary.phase = session_phase(state, now - summary.updated_at, AGENT_RUNNING_STALE_AFTER_MS);
    Some(summary)
}

fn read_session(dir: &Path, updated_at: i64) -> Option<(AgentSessionSummary, TurnState)> {
    let meta: Value = fs::read_to_string(dir.join("summary.json")).ok().and_then(|text| serde_json::from_str(&text).ok()).unwrap_or_default();
    let events = read_tail(&dir.join("events.jsonl")).unwrap_or_default();
    let progress = parse_events(&events);
    if progress.child {
        return None;
    }
    let mut tail = parse_chat(&read_tail(&dir.join("chat_history.jsonl")).unwrap_or_default());
    tail.state = progress.state;
    tail.turn_started_at = progress.turn_started_at;
    if progress.state == TurnState::Working || progress.state == TurnState::AwaitingUser {
        if let Some(tool) = progress.tool {
            tail.current_tool = Some(tail.current_tool.filter(|known| known.name == tool).unwrap_or(ToolCall { name: tool, detail: None }));
        }
    }
    let tail = tail.settle();
    let session_id = text(&meta["info"]["id"]).or_else(|| dir.file_name().map(|name| name.to_string_lossy().to_string()))?;
    let cwd = text(&meta["info"]["cwd"]);
    let generated = meta["generated_title"].as_str().and_then(display_title);
    let (renamed, generated) = if meta["title_is_manual"] == true { (generated, None) } else { (None, generated) };
    let first_prompt = first_prompt(&dir.join("chat_history.jsonl"));
    let (title, title_source) = pick_title(renamed, generated, first_prompt, cwd.as_deref().and_then(folder_title));
    let summary = AgentSessionSummary {
        provider: PROVIDER,
        session_id,
        cwd,
        title,
        title_source,
        model: text(&meta["current_model_id"]).or(progress.model),
        effort: text(&meta["reasoning_effort"]),
        phase: "completed",
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
        closed: false,
        context_tokens: None,
        remote_host: None,
    };
    Some((summary, tail.state))
}

#[derive(Debug, Default)]
pub(super) struct Progress {
    pub(super) state: TurnState,
    pub(super) turn_started_at: Option<i64>,
    pub(super) tool: Option<String>,
    pub(super) model: Option<String>,
    pub(super) child: bool,
}

pub(super) fn parse_events(tail: &str) -> Progress {
    let mut progress = Progress::default();
    let mut tool_done = false;
    for event in tail.lines().rev().filter_map(|line| serde_json::from_str::<Value>(line).ok()) {
        let kind = event["type"].as_str().unwrap_or_default();
        if progress.state == TurnState::Unknown {
            progress.state = match (kind, event["phase"].as_str()) {
                ("turn_ended", _) if matches!(event["outcome"].as_str(), Some("completed" | "cancelled") | None) => TurnState::Done,
                ("turn_ended", _) => TurnState::Failed,
                ("phase_changed", Some("permission_prompt")) | ("permission_requested", _) => TurnState::AwaitingUser,
                ("phase_changed" | "permission_resolved" | "tool_started" | "tool_completed" | "turn_started" | "loop_started" | "first_token", _) => {
                    TurnState::Working
                }
                _ => TurnState::Unknown,
            };
        }
        match kind {
            "tool_completed" if progress.tool.is_none() => tool_done = true,
            "tool_started" | "permission_requested" if progress.tool.is_none() && !tool_done => progress.tool = text(&event["tool_name"]),
            "turn_started" => {
                progress.turn_started_at = event["ts"].as_str().and_then(parse_timestamp_ms);
                progress.model = text(&event["model_id"]);
                progress.child = event["session_relationship"].as_str().is_some_and(|relation| relation != "primary");
                break;
            }
            _ => {}
        }
    }
    progress
}

pub(super) fn parse_chat(tail: &str) -> SessionTail {
    let mut result = SessionTail::default();
    for record in tail.lines().rev().filter_map(|line| serde_json::from_str::<Value>(line).ok()) {
        match record["type"].as_str() {
            Some("assistant") => {
                if result.current_tool.is_none() && result.last_message.is_none() {
                    result.current_tool = record["tool_calls"].as_array().and_then(|calls| calls.last()).and_then(tool_call);
                }
                if result.last_message.is_none() {
                    if let Some(reply) = record["content"].as_str().filter(|text| !text.trim().is_empty()) {
                        result.take_reply(reply);
                    }
                }
            }
            Some("user") => {
                if let Some(prompt) = typed_prompt(&record) {
                    result.last_prompt = Some(prompt);
                    break;
                }
            }
            _ => {}
        }
    }
    result
}

fn typed_prompt(record: &Value) -> Option<String> {
    if record["type"] != "user" || record.get("synthetic_reason").is_some_and(|reason| !reason.is_null()) {
        return None;
    }
    let texts: Vec<&str> = match &record["content"] {
        Value::String(text) => vec![text.as_str()],
        Value::Array(parts) => parts.iter().filter(|part| part["type"] == "text").filter_map(|part| part["text"].as_str()).collect(),
        _ => Vec::new(),
    };
    prompt_title(&texts.join("\n"))
}

fn tool_call(call: &Value) -> Option<ToolCall> {
    let name = text(&call["name"])?;
    let arguments = match &call["arguments"] {
        Value::String(raw) => serde_json::from_str(raw).unwrap_or(json!({})),
        other => other.clone(),
    };
    let detail = DETAIL_KEYS.iter().find_map(|key| arguments[*key].as_str()).and_then(|value| shorten(value, DETAIL_MAX_CHARS));
    Some(ToolCall { name, detail })
}

fn first_prompt(path: &Path) -> Option<String> {
    use std::io::{BufRead, BufReader};
    let file = fs::File::open(path).ok()?;
    BufReader::new(file)
        .split(b'\n')
        .map_while(Result::ok)
        .take(HEAD_LINES)
        .filter_map(|line| serde_json::from_slice::<Value>(&line).ok())
        .find_map(|record| typed_prompt(&record))
}

fn text(value: &Value) -> Option<String> {
    value.as_str().filter(|text| !text.is_empty()).map(str::to_string)
}

#[cfg(test)]
#[path = "grok_tests.rs"]
mod tests;
