use std::{
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
};

use serde_json::{json, Value};

use super::harness::{Harness, HookEnv, Hooks, RemoteFiles, ScanRoots, StatusLight};
use super::hooks_state::HookInstallState;
use super::markers::{file_modified_unix_millis, AGENT_RUNNING_STALE_AFTER_MS};
use super::session_records;
use super::session_scan::{pick_title, read_tail};
use super::sessions::{claude_model_label, parse_claude_tail, session_phase, AgentSessionSummary, SessionTail, TurnState};
use super::title::{display_title, folder_title, user_prompt_in_record};
use super::window_focus::app_name;
use super::write_text_file;
use crate::platform;

pub(super) const PROVIDER: &str = "pi";
const HOME_ENV: &str = "PI_CODING_AGENT_DIR";
const EXTENSION_FILE_NAME: &str = "fuyu-island.js";
const EXTENSION_TEMPLATE: &str = include_str!("hooks/fuyu-pi-extension.js");
const DIR_PLACEHOLDER: &str = "\"__FUYU_DIR__\"";
const SESSIONS_DIR: &str = "sessions";
const HEAD_LINES: usize = 50;
const DESKTOP_EXES: [&str; 4] = ["PiDeck.exe", "PiDeck", "PiCove.exe", "PiCove"];

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks { install: install_hooks, check: hooks_state }),
    status_light: Some(StatusLight {
        running_marker: "agent-pi-running.flag",
        running_hold: "agent-pi-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: Some(sessions),
    remote: Some(RemoteFiles {
        find: &["find .pi/agent/sessions -mindepth 2 -maxdepth 2 -type f -name '*.jsonl' -mmin -\"$W\" 2>/dev/null"],
        session_dirs: &[".pi/agent/sessions/"],
        files: &[],
        checkpoint_dirs: &[],
    }),
};

fn process_env(name: &str) -> Option<OsString> {
    std::env::var_os(name)
}

pub(super) fn home_with(home_dir: &Path, env: &impl Fn(&str) -> Option<OsString>) -> PathBuf {
    env(HOME_ENV)
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
        .unwrap_or_else(|| home_dir.join(".pi").join("agent"))
}

pub(super) fn home(home_dir: &Path) -> PathBuf {
    home_with(home_dir, &process_env)
}

pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
    vec![home(home_dir).join("AGENTS.md")]
}

pub(super) fn running_app() -> Option<String> {
    platform::process::running_executable(&DESKTOP_EXES).map(|exe| app_name(&exe))
}

fn extension_path(home_dir: &Path, env: &impl Fn(&str) -> Option<OsString>) -> PathBuf {
    home_with(home_dir, env).join("extensions").join(EXTENSION_FILE_NAME)
}

fn present(home_dir: &Path, env: &impl Fn(&str) -> Option<OsString>) -> bool {
    home_with(home_dir, env).is_dir() || home_dir.join(".pi").is_dir()
}

fn app_dir<'a>(env: &HookEnv<'a>) -> &'a Path {
    env.status_script.parent().unwrap_or(env.status_script)
}

pub(super) fn extension_text(app_dir: &Path) -> String {
    let dir = serde_json::to_string(&app_dir.to_string_lossy()).unwrap_or_else(|_| "\"\"".to_string());
    EXTENSION_TEMPLATE.replace(DIR_PLACEHOLDER, &dir)
}

fn install_hooks(env: &HookEnv) -> Result<(), String> {
    install_with(env, &process_env)
}

fn hooks_state(env: &HookEnv) -> HookInstallState {
    state_with(env, &process_env)
}

pub(super) fn install_with(env: &HookEnv, vars: &impl Fn(&str) -> Option<OsString>) -> Result<(), String> {
    if !present(env.home_dir, vars) {
        return Ok(());
    }
    write_text_file(&extension_path(env.home_dir, vars), &extension_text(app_dir(env)))
}

pub(super) fn state_with(env: &HookEnv, vars: &impl Fn(&str) -> Option<OsString>) -> HookInstallState {
    if !present(env.home_dir, vars) {
        return HookInstallState::Absent;
    }
    match fs::read_to_string(extension_path(env.home_dir, vars)) {
        Err(_) => HookInstallState::NotInstalled,
        Ok(text) if text.replace("\r\n", "\n") == extension_text(app_dir(env)).replace("\r\n", "\n") => HookInstallState::Current,
        Ok(_) => HookInstallState::Outdated,
    }
}

fn sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    let dir = match roots.local_app_dir {
        Some(_) => home(roots.home_dir).join(SESSIONS_DIR),
        None => roots.home_dir.join(".pi").join("agent").join(SESSIONS_DIR),
    };
    sessions_in_dir(PROVIDER, &dir, roots.local_app_dir, now, window_ms)
}

pub(super) fn jsonl_files_in(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    for entry in children(dir) {
        if entry.is_dir() {
            files.extend(
                children(&entry)
                    .into_iter()
                    .filter(|path| path.extension().is_some_and(|ext| ext == "jsonl")),
            );
        } else if entry.extension().is_some_and(|ext| ext == "jsonl") {
            files.push(entry);
        }
    }
    files
}

fn children(dir: &Path) -> Vec<PathBuf> {
    fs::read_dir(dir)
        .map(|entries| entries.flatten().map(|entry| entry.path()).collect())
        .unwrap_or_default()
}

pub(super) fn sessions_in_dir(
    provider: &'static str,
    sessions_dir: &Path,
    app_dir: Option<&Path>,
    now: i64,
    window_ms: i64,
) -> Vec<AgentSessionSummary> {
    jsonl_files_in(sessions_dir)
        .into_iter()
        .filter_map(|path| read_session_for(provider, &path, app_dir, now, window_ms))
        .collect()
}

pub(super) fn read_session_for(
    provider: &'static str,
    path: &Path,
    app_dir: Option<&Path>,
    now: i64,
    window_ms: i64,
) -> Option<AgentSessionSummary> {
    let updated_at = file_modified_unix_millis(path)?;
    if now - updated_at > window_ms {
        return None;
    }
    let head: Vec<Value> = read_head(path).lines().filter_map(|line| serde_json::from_str(line).ok()).collect();
    let header = head.iter().find(|record| matches!(record["type"].as_str(), Some("session" | "session_start")));
    let first_prompt = head
        .iter()
        .map(claude_shaped)
        .find_map(|record| user_prompt_in_record(&record.to_string()));
    let head_meta = scan_meta(&head);
    let mut tail = read_tail(path).map(|raw| parse_pi_tail(&raw)).unwrap_or_default();
    if first_prompt.is_none() && tail.last_prompt.is_none() {
        return None;
    }
    if tail.custom_title.is_none() {
        tail.custom_title = head_meta.custom_title;
    }
    if tail.model.is_none() {
        tail.model = head_meta.model;
    }
    if tail.effort.is_none() {
        tail.effort = head_meta.effort;
    }
    let session_id = header
        .and_then(|record| text(&record["id"]))
        .or_else(|| tail.session_id.clone())
        .or_else(|| stem_session_id(path))?;
    let closed = has_ended(app_dir, &session_id);
    Some(summary(provider, session_id, header, first_prompt, tail, closed, updated_at, now))
}

fn stem_session_id(path: &Path) -> Option<String> {
    let stem = path.file_stem()?.to_string_lossy();
    let id = stem.rsplit_once('_').map(|(_, rest)| rest).unwrap_or(&stem).trim();
    (!id.is_empty()).then(|| id.to_string())
}

fn has_ended(app_dir: Option<&Path>, session_id: &str) -> bool {
    let Some(record) = app_dir.and_then(|dir| session_records::read(dir, session_id)) else {
        return false;
    };
    if record.has_ended() {
        return true;
    }
    record.live_pid().is_none()
}

#[derive(Default)]
struct Meta {
    custom_title: Option<String>,
    model: Option<String>,
    effort: Option<String>,
    context_tokens: Option<u64>,
}

fn scan_meta(records: &[Value]) -> Meta {
    let mut meta = Meta::default();
    for record in records {
        match record["type"].as_str().unwrap_or_default() {
            "session_info" => {
                if let Some(title) = record["name"].as_str().and_then(display_title) {
                    meta.custom_title = Some(title);
                }
            }
            "model_change" => {
                if let Some(model) = text(&record["modelId"]).or_else(|| text(&record["model"])) {
                    meta.model = Some(claude_model_label(&model));
                }
            }
            "thinking_level_change" => {
                if let Some(level) = text(&record["thinkingLevel"]).or_else(|| text(&record["level"])) {
                    meta.effort = Some(level);
                }
            }
            "message" | "message_update" => {
                if let Some(tokens) = usage_tokens(record.get("usage").or_else(|| record["message"].get("usage"))) {
                    meta.context_tokens = Some(tokens);
                }
            }
            _ => {}
        }
    }
    meta
}

#[allow(clippy::too_many_arguments)]
pub(super) fn summary(
    provider: &'static str,
    session_id: String,
    header: Option<&Value>,
    first_prompt: Option<String>,
    tail: SessionTail,
    closed: bool,
    updated_at: i64,
    now: i64,
) -> AgentSessionSummary {
    let cwd = header.and_then(|record| text(&record["cwd"])).or(tail.cwd.clone());
    let named = header
        .and_then(|record| text(&record["sessionTitle"]).or_else(|| text(&record["title"])).or_else(|| text(&record["name"])))
        .as_deref()
        .and_then(display_title)
        .or(tail.title.clone());
    let (title, title_source) = pick_title(
        tail.custom_title.clone(),
        named,
        first_prompt,
        cwd.as_deref().and_then(folder_title),
    );
    let state = if closed && matches!(tail.state, TurnState::Working | TurnState::AwaitingUser) {
        TurnState::Done
    } else {
        tail.state
    };
    let tail = tail.settle();
    AgentSessionSummary {
        provider,
        session_id,
        cwd,
        title,
        title_source,
        model: tail.model,
        effort: tail.effort,
        phase: session_phase(state, now - updated_at, AGENT_RUNNING_STALE_AFTER_MS),
        last_message: tail.last_message,
        reply_marker: tail.reply_marker,
        reply_asks: tail.reply_asks,
        updated_at,
        host: None,
        turn_started_at: tail.turn_started_at,
        last_prompt: tail.last_prompt,
        current_tool: tail.current_tool,
        permission_mode: tail.permission_mode,
        subagents: tail.subagents,
        background_tasks: tail.background_tasks,
        compacting: false,
        todos: tail.todos,
        closed,
        remote_host: None,
        parent_id: None,
        context_tokens: tail.context_tokens,
    }
}

pub(super) fn parse_pi_tail(tail: &str) -> SessionTail {
    let records: Vec<Value> = tail.lines().filter_map(|line| serde_json::from_str::<Value>(line).ok()).collect();
    let meta = scan_meta(&records);
    let lines: Vec<String> = records
        .iter()
        .map(claude_shaped)
        .filter(|value| !value.is_null())
        .map(|value| value.to_string())
        .collect();
    let mut parsed = parse_claude_tail(&lines.join("\n"));
    if parsed.custom_title.is_none() {
        parsed.custom_title = meta.custom_title;
    }
    if parsed.model.is_none() {
        parsed.model = meta.model;
    }
    if parsed.effort.is_none() {
        parsed.effort = meta.effort;
    }
    if parsed.context_tokens.is_none() {
        parsed.context_tokens = meta.context_tokens;
    }
    parsed
}

pub(super) fn claude_shaped(record: &Value) -> Value {
    match record["type"].as_str().unwrap_or_default() {
        "user" | "assistant" | "custom-title" | "ai-title" => record.clone(),
        "session_info" => json!({
            "type": "custom-title",
            "customTitle": record["name"],
        }),
        "message" => shape_message(record),
        _ => Value::Null,
    }
}

fn shape_message(record: &Value) -> Value {
    let message = &record["message"];
    let role = message["role"].as_str().unwrap_or_default();
    if role == "toolResult" {
        let call_id = message["toolCallId"]
            .as_str()
            .or_else(|| message["tool_use_id"].as_str())
            .unwrap_or("call");
        return json!({
            "type": "user",
            "timestamp": record["timestamp"],
            "message": {
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": call_id,
                    "content": message["content"],
                }],
            },
        });
    }
    if !matches!(role, "user" | "assistant") {
        return Value::Null;
    }
    let content = shape_content(&message["content"]);
    let mut shaped_msg = json!({
        "role": role,
        "content": content,
        "model": message["model"].as_str().or_else(|| record["model"].as_str()),
    });
    if let Some(usage) = shape_usage(record.get("usage").or_else(|| message.get("usage"))) {
        shaped_msg["usage"] = usage;
    }
    let mut shaped = json!({
        "type": role,
        "timestamp": record["timestamp"],
        "message": shaped_msg,
    });
    if message["visibility"] == "hidden" || record["isMeta"] == Value::Bool(true) {
        shaped["isMeta"] = Value::Bool(true);
    }
    if role == "assistant" {
        let stop = record["stopReason"]
            .as_str()
            .or_else(|| message["stopReason"].as_str())
            .or_else(|| message["stop_reason"].as_str());
        if stop == Some("error") || record["isError"] == Value::Bool(true) || message["isError"] == Value::Bool(true) {
            shaped["isApiErrorMessage"] = Value::Bool(true);
        }
        let calls_tool = content
            .as_array()
            .is_some_and(|blocks| blocks.iter().any(|block| block["type"] == "tool_use"));
        shaped["message"]["stop_reason"] = match stop {
            Some("toolUse" | "tool_use") => Value::Null,
            Some(reason) if !reason.is_empty() => Value::String("end_turn".to_string()),
            _ if calls_tool => Value::Null,
            _ => Value::String("end_turn".to_string()),
        };
    }
    shaped
}

fn shape_content(content: &Value) -> Value {
    let Some(blocks) = content.as_array() else {
        return content.clone();
    };
    Value::Array(
        blocks
            .iter()
            .map(|block| match block["type"].as_str() {
                Some("toolCall") => json!({
                    "type": "tool_use",
                    "id": block["id"].as_str().unwrap_or("call"),
                    "name": block["name"],
                    "input": block.get("arguments").or_else(|| block.get("input")).cloned().unwrap_or(Value::Null),
                }),
                _ => block.clone(),
            })
            .collect(),
    )
}

fn usage_tokens(usage: Option<&Value>) -> Option<u64> {
    let usage = usage?.as_object()?;
    let num = |key: &str| usage.get(key).and_then(Value::as_u64);
    if let Some(total) = num("totalTokens").or_else(|| num("total_tokens")) {
        return (total > 0).then_some(total);
    }
    let input = num("input").or_else(|| num("input_tokens"))?;
    let output = num("output").or_else(|| num("output_tokens")).unwrap_or(0);
    let cache_read = num("cacheRead").or_else(|| num("cache_read_input_tokens")).unwrap_or(0);
    let cache_write = num("cacheWrite").or_else(|| num("cache_creation_input_tokens")).unwrap_or(0);
    let total = input + output + cache_read + cache_write;
    (total > 0).then_some(total)
}

fn shape_usage(usage: Option<&Value>) -> Option<Value> {
    let total = usage_tokens(usage)?;
    Some(json!({ "input_tokens": total, "output_tokens": 0 }))
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
#[path = "pi_tests.rs"]
mod tests;
