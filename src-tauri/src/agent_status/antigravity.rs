use std::{
    collections::HashMap,
    fs::{self, File},
    io::{BufRead, BufReader, Read},
    path::{Path, PathBuf},
};

use serde_json::{json, Value};

use super::claude_hooks::APPROVAL_HOOK_TIMEOUT_SECONDS;
use super::codex_hooks::{agent_running_command_with, agent_status_command};
use super::harness::{Harness, HookEnv, Hooks, StatusLight};
use super::hooks_state::HookInstallState;
use super::markers::AGENT_RUNNING_STALE_AFTER_MS;
use super::reply_text::reply_ending;
use super::session_scan::{pick_title, read_tail};
use super::sessions::{session_phase, AgentSessionSummary, TurnState};
use super::snapshot::system_time_to_unix_millis;
use super::title::{display_title, folder_title, prompt_title, tag_content};
use super::tool_call::{antigravity_tool_call, ToolCall};
use super::{write_text_file, AGENT_APPROVAL_SCRIPT_FILE_NAME};

pub(super) const PROVIDER: &str = "antigravity";
const SAVED_DIR: &str = "agent-antigravity";
const DATA_DIRS: [&str; 3] = ["antigravity", "antigravity-ide", "antigravity-cli"];
const HOOK_NAME: &str = "fuyu";
pub(super) const APPROVED_TOOLS: &str = "run_command";
const MAX_AGE_MS: i64 = 24 * 60 * 60 * 1000;
const HEAD_READ_BYTES: u64 = 512 * 1024;
const HEAD_READ_LINES: usize = 16;
const EFFORTS: [&str; 6] = ["minimal", "low", "medium", "high", "xhigh", "max"];

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks {
        install: install_hooks,
        check: hooks_state,
        uninstall: uninstall_hooks,
    }),
    status_light: Some(StatusLight {
        running_marker: "agent-antigravity-running.flag",
        running_hold: "agent-antigravity-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: Some(super::antigravity_remote::read_sessions),
    remote: Some(super::antigravity_remote::REMOTE_FILES),
};

struct Saved {
    at: i64,
    running: bool,
    input: Value,
    path: PathBuf,
}

#[cfg(test)]
pub(super) fn sessions(app_dir: &Path, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    sessions_at(app_dir, None, true, now, window_ms)
}

pub(super) fn sessions_at(
    app_dir: &Path,
    home_dir: Option<&Path>,
    local: bool,
    now: i64,
    window_ms: i64,
) -> Vec<AgentSessionSummary> {
    let mut newest: HashMap<String, Saved> = HashMap::new();
    let discard = |path: &Path| {
        if super::may_change_hook_files() {
            let _ = fs::remove_file(path);
        }
    };
    for entry in fs::read_dir(app_dir.join(SAVED_DIR)).into_iter().flatten().flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let running = match name.split_once('-') {
            Some(("running", rest)) if rest.ends_with(".json") => true,
            Some(("stop", rest)) if rest.ends_with(".json") => false,
            _ => continue,
        };
        let Some(at) = entry.metadata().ok().and_then(|meta| meta.modified().ok()).and_then(system_time_to_unix_millis) else {
            continue;
        };
        if now - at > MAX_AGE_MS {
            discard(&path);
            continue;
        }
        let Some(input) = fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}').trim()).ok())
        else {
            continue;
        };
        let Some(id) = text(&input["conversationId"]) else {
            continue;
        };
        match newest.get(&id) {
            Some(known) if known.at > at => discard(&path),
            _ => {
                if let Some(older) = newest.insert(id, Saved { at, running, input, path }) {
                    discard(&older.path);
                }
            }
        }
    }
    newest
        .into_iter()
        .filter(|(_, saved)| now - saved.at <= window_ms)
        .filter_map(|(id, saved)| summary(id, &saved, home_dir, local, now))
        .collect()
}

fn summary(
    session_id: String,
    saved: &Saved,
    home_dir: Option<&Path>,
    local: bool,
    now: i64,
) -> Option<AgentSessionSummary> {
    let input = &saved.input;
    let annotation = read_annotation(input, &session_id, home_dir, local);
    if annotation.archived {
        return None;
    }
    let cwd = text(&input["cwd"]).or_else(|| {
        input["workspacePaths"]
            .as_array()
            .and_then(|paths| paths.iter().find_map(text))
            .map(|path| path.strip_prefix("file:///").map(str::to_string).unwrap_or(path))
    });
    let prompt = input["lastUserInput"].as_str().and_then(prompt_title);
    let first_prompt = match (&annotation.title, local.then(|| read_transcript_head(input)).flatten()) {
        (Some(_), _) => None,
        (None, Some(HeadKind::Subagent)) => return None,
        (None, Some(HeadKind::Prompt(first))) => first,
        (None, None) => prompt.clone(),
    };
    let (title, title_source) = pick_title(None, annotation.title, first_prompt, cwd.as_deref().and_then(folder_title));
    let state = if saved.running { TurnState::Working } else { TurnState::Done };
    let transcript = local.then(|| transcript(input)).flatten();
    let reply = transcript.as_deref().and_then(last_reply).map(|reply| reply_ending(&reply)).unwrap_or_default();
    let (model, effort) = text(&input["modelName"]).map(|name| model_and_effort(&name)).unzip();
    Some(AgentSessionSummary {
        provider: PROVIDER,
        session_id,
        cwd,
        title,
        title_source,
        model,
        effort: effort.flatten(),
        phase: session_phase(state, now - saved.at, AGENT_RUNNING_STALE_AFTER_MS),
        last_message: reply.message,
        reply_marker: reply.marker,
        reply_asks: reply.asks,
        updated_at: saved.at,
        host: None,
        turn_started_at: None,
        last_prompt: prompt,
        current_tool: transcript.as_deref().filter(|_| saved.running).and_then(running_tool),
        permission_mode: None,
        subagents: 0,
        background_tasks: 0,
        compacting: false,
        todos: None,
        closed: false,
        remote_host: None,
        parent_id: None,
        context_tokens: transcript.as_deref().and_then(context_tokens),
    })
}

#[derive(Default)]
struct Annotation {
    title: Option<String>,
    archived: bool,
}

enum HeadKind {
    Subagent,
    Prompt(Option<String>),
}

fn brain_root(path: &str) -> Option<PathBuf> {
    Path::new(path)
        .ancestors()
        .find(|ancestor| ancestor.file_name().is_some_and(|name| name == "brain"))
        .and_then(Path::parent)
        .map(Path::to_path_buf)
}

fn read_annotation(input: &Value, session_id: &str, home_dir: Option<&Path>, local: bool) -> Annotation {
    if session_id.is_empty() || session_id == "." || session_id == ".." || session_id.contains(['/', '\\', ':']) {
        return Annotation::default();
    }
    let file_name = format!("{session_id}.pbtxt");
    let mut dirs = Vec::new();
    if local {
        if let Some(dir) = text(&input["artifactDirectoryPath"])
            .as_deref()
            .and_then(brain_root)
            .or_else(|| text(&input["transcriptPath"]).as_deref().and_then(brain_root))
        {
            dirs.push(dir);
        }
    }
    if let Some(home) = home_dir {
        let gemini = home.join(".gemini");
        for name in DATA_DIRS {
            let dir = gemini.join(name);
            if !dirs.contains(&dir) {
                dirs.push(dir);
            }
        }
    }
    dirs.into_iter()
        .find_map(|dir| fs::read_to_string(dir.join("annotations").join(&file_name)).ok())
        .map(|content| parse_annotation(&content))
        .unwrap_or_default()
}

fn parse_annotation(text: &str) -> Annotation {
    let bytes = text.as_bytes();
    let mut out = Annotation::default();
    let mut index = 0;
    let mut depth = 0usize;
    while let Some(&byte) = bytes.get(index) {
        if byte.is_ascii_whitespace() {
            index += 1;
        } else if byte == b'{' {
            depth += 1;
            index += 1;
        } else if byte == b'}' {
            depth = depth.saturating_sub(1);
            index += 1;
        } else if byte == b'"' || byte == b'\'' {
            let _ = read_pbtxt_string(bytes, &mut index);
        } else if depth == 0 && (byte.is_ascii_alphabetic() || byte == b'_') {
            let key = read_ident(bytes, &mut index);
            skip_ws(bytes, &mut index);
            if bytes.get(index) == Some(&b':') {
                index += 1;
                skip_ws(bytes, &mut index);
            }
            if key == "title" && matches!(bytes.get(index), Some(b'"' | b'\'')) {
                let raw = read_pbtxt_string(bytes, &mut index);
                out.title = display_title(&raw);
            } else if key == "archived" && read_ident(bytes, &mut index) == "true" {
                out.archived = true;
            }
        } else {
            index += 1;
        }
    }
    out
}

fn skip_ws(bytes: &[u8], index: &mut usize) {
    while bytes.get(*index).is_some_and(u8::is_ascii_whitespace) {
        *index += 1;
    }
}

fn read_ident<'a>(bytes: &'a [u8], index: &mut usize) -> &'a str {
    let start = *index;
    while bytes
        .get(*index)
        .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
    {
        *index += 1;
    }
    std::str::from_utf8(&bytes[start..*index]).unwrap_or_default()
}

fn read_pbtxt_string(bytes: &[u8], index: &mut usize) -> String {
    let Some(&quote) = bytes.get(*index) else {
        return String::new();
    };
    *index += 1;
    let mut out = Vec::new();
    while let Some(&byte) = bytes.get(*index) {
        *index += 1;
        if byte == quote {
            break;
        }
        if byte != b'\\' {
            out.push(byte);
            continue;
        }
        let Some(&esc) = bytes.get(*index) else {
            out.push(b'\\');
            break;
        };
        match esc {
            b'n' => {
                *index += 1;
                out.push(b'\n');
            }
            b'r' => {
                *index += 1;
                out.push(b'\r');
            }
            b't' => {
                *index += 1;
                out.push(b'\t');
            }
            b'\\' | b'"' | b'\'' => {
                *index += 1;
                out.push(esc);
            }
            b'x' | b'X' => {
                *index += 1;
                let decoded = bytes
                    .get(*index..*index + 2)
                    .and_then(|pair| std::str::from_utf8(pair).ok())
                    .and_then(|hex| u8::from_str_radix(hex, 16).ok());
                if let Some(hex) = decoded {
                    *index += 2;
                    out.push(hex);
                } else {
                    out.push(esc);
                }
            }
            b'0'..=b'7' => {
                let mut value = 0u32;
                let mut digits = 0;
                while digits < 3 {
                    let Some(&digit @ b'0'..=b'7') = bytes.get(*index) else {
                        break;
                    };
                    value = value * 8 + u32::from(digit - b'0');
                    *index += 1;
                    digits += 1;
                }
                if let Ok(decoded) = u8::try_from(value) {
                    out.push(decoded);
                }
            }
            _ => {
                *index += 1;
                out.push(esc);
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn read_transcript_head(input: &Value) -> Option<HeadKind> {
    let raw_path = text(&input["transcriptPath"])?;
    let path = Path::new(&raw_path);
    let file = File::open(path)
        .or_else(|_| File::open(path.with_file_name("transcript.jsonl")))
        .ok()?;
    let mut saw_record = false;
    for line in BufReader::new(file.take(HEAD_READ_BYTES))
        .lines()
        .take(HEAD_READ_LINES)
        .map_while(Result::ok)
    {
        let Ok(record) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        if !saw_record {
            saw_record = true;
            if record["type"] == "SYSTEM_MESSAGE" {
                return Some(HeadKind::Subagent);
            }
        }
        if record["type"] == "USER_INPUT" {
            let first = record["content"]
                .as_str()
                .map(|content| tag_content(content, "USER_REQUEST").unwrap_or(content))
                .and_then(prompt_title);
            return Some(HeadKind::Prompt(first));
        }
    }
    saw_record.then_some(HeadKind::Prompt(None))
}

fn transcript(input: &Value) -> Option<String> {
    text(&input["transcriptPath"]).and_then(|path| read_tail(Path::new(&path)))
}

fn model_and_effort(name: &str) -> (String, Option<String>) {
    let effort = |level: &str| EFFORTS.contains(&level.to_ascii_lowercase().as_str()).then(|| level.to_ascii_lowercase());
    if let Some((model, level)) = name.strip_suffix(')').and_then(|rest| rest.rsplit_once(" (")) {
        if let Some(level) = effort(level) {
            return (model.trim().to_string(), Some(level));
        }
    }
    match name.rsplit_once('-') {
        Some((model, level)) if !name.contains(' ') => match effort(level) {
            Some(level) => (model.to_string(), Some(level)),
            None => (name.to_string(), None),
        },
        _ => (name.to_string(), None),
    }
}

fn records(tail: &str) -> impl Iterator<Item = Value> + '_ {
    tail.lines().rev().filter_map(|line| serde_json::from_str::<Value>(line).ok())
}

fn running_tool(tail: &str) -> Option<ToolCall> {
    for record in records(tail) {
        match record["type"].as_str() {
            Some("USER_INPUT") => return None,
            Some("PLANNER_RESPONSE") => {
                if let Some(call) = record["tool_calls"].as_array().and_then(|calls| calls.last()) {
                    return antigravity_tool_call(call);
                }
            }
            _ => {}
        }
    }
    None
}

fn context_tokens(tail: &str) -> Option<u64> {
    let usage = records(tail).find(|record| record["type"] == "PLANNER_RESPONSE" && record["input_tokens"].is_u64())?;
    let total: u64 = ["input_tokens", "cache_read_tokens", "output_tokens"].iter().filter_map(|key| usage[*key].as_u64()).sum();
    (total > 0).then_some(total)
}

fn last_reply(tail: &str) -> Option<String> {
    for record in records(tail) {
        match record["type"].as_str() {
            Some("USER_INPUT") => return None,
            Some("PLANNER_RESPONSE") if record["content"].as_str().is_some_and(|content| !content.trim().is_empty()) => {
                return text(&record["content"]);
            }
            _ => {}
        }
    }
    None
}

fn text(value: &Value) -> Option<String> {
    value.as_str().filter(|text| !text.is_empty()).map(str::to_string)
}

fn hooks_path(home_dir: &Path) -> PathBuf {
    home_dir.join(".gemini").join("config").join("hooks.json")
}

pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
    if lives_here(home_dir) {
        vec![home_dir.join(".gemini").join("GEMINI.md")]
    } else {
        Vec::new()
    }
}

fn lives_here(home_dir: &Path) -> bool {
    let gemini = home_dir.join(".gemini");
    DATA_DIRS.iter().any(|dir| gemini.join(dir).is_dir())
}

fn hook_group(env: &HookEnv) -> Value {
    let handler = |command: String, timeout: i64| json!({ "type": "command", "command": command, "timeout": timeout });
    let running = |phase: &str| handler(agent_running_command_with(env.running_script, PROVIDER, phase), 5);
    let approval_script = env.status_script.with_file_name(AGENT_APPROVAL_SCRIPT_FILE_NAME);
    json!({
        "enabled": true,
        "SessionStart": [running("start")],
        "PreInvocation": [running("running")],
        "PreToolUse": [{
            "matcher": APPROVED_TOOLS,
            "hooks": [handler(agent_status_command(&approval_script, PROVIDER, "permission"), APPROVAL_HOOK_TIMEOUT_SECONDS)],
        }],
        "Stop": [running("stop"), handler(agent_status_command(env.status_script, PROVIDER, "completed"), 10)],
    })
}

fn read_config(path: &Path) -> Option<Value> {
    fs::read_to_string(path).ok().and_then(|text| serde_json::from_str::<Value>(&text).ok())
}

fn hooks_state(env: &HookEnv) -> HookInstallState {
    if !lives_here(env.home_dir) {
        return HookInstallState::Absent;
    }
    match read_config(&hooks_path(env.home_dir)) {
        Some(config) if config[HOOK_NAME] == hook_group(env) => HookInstallState::Current,
        Some(config) if super::is_island_hook_text(&config.to_string()) => HookInstallState::Outdated,
        _ => HookInstallState::NotInstalled,
    }
}

pub(super) fn install_hooks(env: &HookEnv) -> Result<(), String> {
    if !lives_here(env.home_dir) {
        return Ok(());
    }
    let path = hooks_path(env.home_dir);
    let mut config = match fs::read_to_string(&path) {
        Ok(content) if !content.trim().is_empty() => serde_json::from_str::<Value>(&content)
            .map_err(|error| format!("Failed to parse Antigravity hooks.json: {error}"))?,
        _ => json!({}),
    };
    let root = config
        .as_object_mut()
        .ok_or_else(|| "Antigravity hooks.json must contain a JSON object.".to_string())?;
    root.insert(HOOK_NAME.to_string(), hook_group(env));
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|error| format!("Failed to create {}: {error}", dir.display()))?;
    }
    let content = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Failed to serialize Antigravity hooks.json: {error}"))?;
    write_text_file(&path, &content)
}

pub(super) fn uninstall_hooks(env: &HookEnv) -> Result<(), String> {
    let path = hooks_path(env.home_dir);
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Failed to read Antigravity hooks.json: {error}")),
    };
    let trimmed = content.trim_start_matches('\u{feff}').trim();
    if trimmed.is_empty() {
        return Ok(());
    }
    let mut config: Value = serde_json::from_str(trimmed)
        .map_err(|error| format!("Failed to parse Antigravity hooks.json: {error}"))?;
    let root = config
        .as_object_mut()
        .ok_or_else(|| "Antigravity hooks.json must contain a JSON object.".to_string())?;
    if root.remove(HOOK_NAME).is_none() {
        return Ok(());
    }
    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Failed to serialize Antigravity hooks.json: {error}"))?;
    write_text_file(&path, &serialized)
}

#[cfg(test)]
#[path = "antigravity_tests.rs"]
mod tests;
