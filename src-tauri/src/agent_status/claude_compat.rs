use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
    time::SystemTime,
};

use serde_json::{json, Value};

use super::claude_hooks::{
    claude_code_match_all_hook_entry, command_hook_entry, install_claude_code_hook_events, turn_hook_entries,
    uninstall_nested_json_hooks, APPROVAL_HOOK_TIMEOUT_SECONDS,
};
use super::codex_hooks::{agent_running_command_with, agent_status_command};
use super::harness::{HookEnv, ScanRoots};
use super::hooks_state::{hook_entries_state, HookInstallState};
use super::markers::AGENT_RUNNING_STALE_AFTER_MS;
use super::session_records;
use super::session_scan::{pick_title, read_tail};
use super::sessions::{parse_claude_tail, parse_timestamp_ms, session_phase, AgentSessionSummary, SessionTail, TurnState};
use super::snapshot::system_time_to_unix_millis;
use super::title::{display_title, folder_title, prompt_title, tag_content, user_prompt_in_record};
use super::tool_call::ToolCall;
use super::{workbuddy, write_text_file, AGENT_APPROVAL_SCRIPT_FILE_NAME, AGENT_RUNNING_NOTIFICATION_ARG};

const HEAD_LINES: usize = 400;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Records {
    Claude,
    CodeBuddy,
    Qwen,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Waiting {
    PermissionRequest,
    PermissionPrompt,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Reply {
    PermissionRequest,
    PreToolUse(&'static str),
    Behavior,
    None,
}

pub(super) struct Home {
    pub(super) dir: &'static str,
    pub(super) env: &'static str,
}

pub(super) struct Compat {
    pub(super) provider: &'static str,
    pub(super) label: &'static str,
    pub(super) homes: &'static [Home],
    pub(super) chats: Option<&'static str>,
    pub(super) records: Records,
    pub(super) prompt_file: &'static str,
    pub(super) waiting: Waiting,
    pub(super) hooks_file: &'static str,
    pub(super) reply: Reply,
    pub(super) aliases: &'static [(&'static str, &'static str)],
}

const SPECS: [&Compat; 6] = [
    &super::qoder::SPEC,
    &super::codebuddy::SPEC,
    &super::qwen::SPEC,
    &super::grok::SPEC,
    &super::copilot::SPEC,
    &super::droid::SPEC,
];

fn spec(provider: &str) -> Option<&'static Compat> {
    SPECS.into_iter().find(|spec| spec.provider == provider)
}

pub(crate) fn compat_reply(provider: &str) -> Option<Reply> {
    spec(provider).map(|spec| spec.reply)
}

pub(crate) fn compat_input(provider: &str, input: &mut Value) {
    if let Some(spec) = spec(provider) {
        alias_input(spec, input);
    }
}

macro_rules! compat_harness {
    ($module:ident, $id:literal, $spec:expr) => {
        mod $module {
            use std::path::{Path, PathBuf};

            use super::claude_compat::{self, Compat};
            use super::harness::{Harness, HookEnv, Hooks, ScanRoots, StatusLight};
            use super::hooks_state::HookInstallState;
            use super::sessions::AgentSessionSummary;

            pub(super) const PROVIDER: &str = $id;

            pub(super) const SPEC: Compat = $spec;

            pub(super) const HARNESS: Harness = Harness {
                id: PROVIDER,
                hooks: Some(Hooks { install, check, uninstall }),
                status_light: Some(StatusLight {
                    running_marker: concat!("agent-", $id, "-running.flag"),
                    running_hold: concat!("agent-", $id, "-running-hold.flag"),
                    saved_inputs: &[],
                }),
                sessions: Some(sessions),
                remote: None,
            };

            fn install(env: &HookEnv) -> Result<(), String> {
                claude_compat::install_hooks(&SPEC, env)
            }

            fn check(env: &HookEnv) -> HookInstallState {
                claude_compat::hooks_state(&SPEC, env)
            }

            fn uninstall(env: &HookEnv) -> Result<(), String> {
                claude_compat::uninstall_hooks(&SPEC, env)
            }

            fn sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
                claude_compat::sessions(&SPEC, roots, now, window_ms)
            }

            pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
                claude_compat::prompt_files(&SPEC, home_dir)
            }
        }
    };
}

pub(super) use compat_harness;

fn alias_input(spec: &Compat, input: &mut Value) {
    let Some(fields) = input.as_object_mut() else {
        return;
    };
    for (from, to) in spec.aliases {
        if fields.get(*to).is_none_or(Value::is_null) {
            if let Some(value) = fields.get(*from).cloned() {
                fields.insert((*to).to_string(), value);
            }
        }
    }
}

pub(crate) fn claimed_elsewhere(body: &[u8], home_dir: Option<&Path>) -> Option<&'static str> {
    let input: Value = serde_json::from_slice(body).ok()?;
    SPECS.into_iter().find(|spec| claims(spec, &input, home_dir)).map(|spec| spec.provider)
}

fn claims(spec: &Compat, input: &Value, home_dir: Option<&Path>) -> bool {
    let transcript = input["transcript_path"].as_str().filter(|path| !path.is_empty()).map(Path::new);
    spec.aliases.iter().any(|(from, _)| input.get(*from).is_some())
        || transcript.zip(home_dir).is_some_and(|(path, home)| home_dirs(spec, home).iter().any(|dir| path.starts_with(dir)))
}

pub(super) fn home_dirs(spec: &Compat, home_dir: &Path) -> Vec<PathBuf> {
    spec.homes
        .iter()
        .map(|home| {
            std::env::var_os(home.env)
                .map(PathBuf::from)
                .filter(|dir| dir.is_absolute())
                .unwrap_or_else(|| home_dir.join(home.dir))
        })
        .collect()
}

fn present_homes(spec: &Compat, home_dir: &Path) -> Vec<PathBuf> {
    home_dirs(spec, home_dir).into_iter().filter(|dir| dir.is_dir()).collect()
}

pub(super) fn prompt_files(spec: &Compat, home_dir: &Path) -> Vec<PathBuf> {
    home_dirs(spec, home_dir).into_iter().map(|dir| dir.join(spec.prompt_file)).collect()
}

pub(super) fn hook_entries(spec: &Compat, env: &HookEnv) -> Vec<(&'static str, Value)> {
    let approval_script = env.status_script.with_file_name(AGENT_APPROVAL_SCRIPT_FILE_NAME);
    let notify = || command_hook_entry(agent_running_command_with(env.running_script, spec.provider, AGENT_RUNNING_NOTIFICATION_ARG), 5);
    let mut entries = turn_hook_entries(env.running_script, env.status_script, spec.provider);
    entries.push((
        "StopFailure",
        command_hook_entry(agent_status_command(env.status_script, spec.provider, "failed"), 10),
    ));
    entries.push(match spec.waiting {
        Waiting::PermissionRequest => ("PermissionRequest", notify()),
        Waiting::PermissionPrompt => {
            let mut entry = claude_code_match_all_hook_entry(notify());
            entry["matcher"] = json!("permission_prompt");
            ("Notification", entry)
        }
    });
    let approval = || command_hook_entry(agent_status_command(&approval_script, spec.provider, "permission"), APPROVAL_HOOK_TIMEOUT_SECONDS);
    match spec.reply {
        Reply::PermissionRequest | Reply::Behavior => entries.push(("PermissionRequest", approval())),
        Reply::PreToolUse(tools) => {
            let mut entry = approval();
            entry["matcher"] = json!(tools);
            entries.push(("PreToolUse", entry));
        }
        Reply::None => {}
    }
    entries
}

pub(super) fn hooks_state(spec: &Compat, env: &HookEnv) -> HookInstallState {
    hooks_state_with(spec, env, &hook_entries(spec, env))
}

pub(super) fn hooks_state_with(spec: &Compat, env: &HookEnv, entries: &[(&'static str, Value)]) -> HookInstallState {
    let homes = present_homes(spec, env.home_dir);
    if homes.is_empty() {
        return HookInstallState::Absent;
    }
    let states: Vec<_> = homes
        .iter()
        .map(|home| match read_settings(&home.join(spec.hooks_file)) {
            Some(config) => hook_entries_state(&config["hooks"], entries),
            None => HookInstallState::NotInstalled,
        })
        .collect();
    worst(&states)
}

fn worst(states: &[HookInstallState]) -> HookInstallState {
    [HookInstallState::NotInstalled, HookInstallState::Outdated]
        .into_iter()
        .find(|bad| states.contains(bad))
        .unwrap_or(HookInstallState::Current)
}

fn read_settings(path: &Path) -> Option<Value> {
    serde_json::from_str(&fs::read_to_string(path).ok()?).ok()
}

pub(super) fn install_hooks(spec: &Compat, env: &HookEnv) -> Result<(), String> {
    install_hooks_with(spec, env, &hook_entries(spec, env))
}

pub(super) fn install_hooks_with(spec: &Compat, env: &HookEnv, entries: &[(&'static str, Value)]) -> Result<(), String> {
    for home in present_homes(spec, env.home_dir) {
        install_into(spec, &home, entries.to_vec())?;
    }
    Ok(())
}

pub(super) fn uninstall_hooks(spec: &Compat, env: &HookEnv) -> Result<(), String> {
    for home in home_dirs(spec, env.home_dir) {
        uninstall_nested_json_hooks(&home.join(spec.hooks_file), spec.label, spec.hooks_file)?;
    }
    Ok(())
}

fn install_into(spec: &Compat, home: &Path, entries: Vec<(&'static str, Value)>) -> Result<(), String> {
    let path = home.join(spec.hooks_file);
    let label = spec.label;
    let file = spec.hooks_file;
    let mut config = match fs::read_to_string(&path) {
        Ok(content) if !content.trim().is_empty() => serde_json::from_str::<Value>(&content)
            .map_err(|error| format!("Failed to parse {label} {file}: {error}"))?,
        _ => json!({}),
    };
    let root = config
        .as_object_mut()
        .ok_or_else(|| format!("{label} {file} must contain a JSON object."))?;
    let hooks = root.entry("hooks").or_insert_with(|| json!({}));
    if !hooks.is_object() {
        *hooks = json!({});
    }
    let hooks = hooks
        .as_object_mut()
        .ok_or_else(|| format!("Failed to prepare {label} hooks object."))?;
    install_claude_code_hook_events(hooks, entries);
    let content = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Failed to serialize {label} {file}: {error}"))?;
    write_text_file(&path, &content)
}

type Stamp = (u64, Option<SystemTime>);

struct Cached {
    stamp: Stamp,
    summary: AgentSessionSummary,
    state: TurnState,
}

static CACHE: Mutex<Option<HashMap<PathBuf, Cached>>> = Mutex::new(None);

pub(super) fn sessions(spec: &Compat, roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    let Some(app_dir) = roots.local_app_dir else {
        return Vec::new();
    };
    let mut cache = CACHE.lock().unwrap_or_else(PoisonError::into_inner);
    let cache = cache.get_or_insert_with(HashMap::new);
    let files = session_files(spec, roots.home_dir);
    cache.retain(|path, cached| cached.summary.provider != spec.provider || files.contains(path));
    let mut listed = Vec::new();
    for path in files {
        let Ok(metadata) = fs::metadata(&path) else { continue };
        let Some(modified) = metadata.modified().ok().and_then(system_time_to_unix_millis) else { continue };
        if now - modified > window_ms {
            continue;
        }
        let stamp = (metadata.len(), metadata.modified().ok());
        if cache.get(&path).is_none_or(|cached| cached.stamp != stamp) {
            let Some((summary, state)) = read_session(spec, &path, modified) else { continue };
            cache.insert(path.clone(), Cached { stamp, summary, state });
        }
        let Some(cached) = cache.get(&path) else { continue };
        let mut summary = cached.summary.clone();
        summary.closed = session_records::read(app_dir, &summary.session_id).is_some_and(|record| record.has_ended());
        summary.phase = if summary.closed && cached.state == TurnState::Working {
            "completed"
        } else {
            session_phase(cached.state, now - summary.updated_at, AGENT_RUNNING_STALE_AFTER_MS)
        };
        listed.push(summary);
    }
    listed
}

pub(super) fn session_files(spec: &Compat, home_dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    for home in present_homes(spec, home_dir) {
        for project in dir_paths(&home.join("projects")) {
            let dir = match spec.chats {
                Some(chats) => project.join(chats),
                None => project,
            };
            files.extend(dir_paths(&dir).into_iter().filter(|path| is_session_file(path)));
        }
    }
    files
}

fn is_session_file(path: &Path) -> bool {
    path.extension().is_some_and(|extension| extension == "jsonl")
        && path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .is_some_and(|stem| !stem.starts_with("agent-"))
}

fn dir_paths(dir: &Path) -> Vec<PathBuf> {
    fs::read_dir(dir)
        .map(|entries| entries.flatten().map(|entry| entry.path()).collect())
        .unwrap_or_default()
}

fn read_session(spec: &Compat, path: &Path, modified: i64) -> Option<(AgentSessionSummary, TurnState)> {
    let tail = read_tail(path)?;
    let head = read_head(path);
    let mut parsed = parse_tail(spec.records, &tail);
    let first_prompt = head.lines().find_map(|line| first_prompt(spec.records, line));
    let session_id = parsed
        .session_id
        .take()
        .or_else(|| path.file_stem().map(|stem| stem.to_string_lossy().to_string()))?;
    let cwd = head
        .lines()
        .find_map(|line| serde_json::from_str::<Value>(line).ok().and_then(|record| text(&record_body(spec.records, &record)["cwd"])))
        .or_else(|| parsed.cwd.take());
    let agent_title = parsed.title.take().or_else(|| sidecar_title(path));
    let (title, title_source) = pick_title(
        parsed.custom_title.take(),
        agent_title,
        first_prompt,
        cwd.as_deref().and_then(folder_title),
    );
    let state = parsed.state;
    let summary = AgentSessionSummary {
        provider: spec.provider,
        session_id,
        cwd,
        title,
        title_source,
        model: parsed.model,
        effort: parsed.effort,
        phase: "completed",
        last_message: parsed.last_message,
        reply_marker: parsed.reply_marker,
        reply_asks: parsed.reply_asks,
        updated_at: modified,
        host: None,
        turn_started_at: parsed.turn_started_at,
        last_prompt: parsed.last_prompt,
        current_tool: parsed.current_tool,
        permission_mode: parsed.permission_mode,
        subagents: parsed.subagents,
        background_tasks: parsed.background_tasks,
        compacting: false,
        todos: parsed.todos,
        closed: false,
        context_tokens: parsed.context_tokens,
        remote_host: None,
        parent_id: None,
    };
    Some((summary, state))
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

fn sidecar_title(path: &Path) -> Option<String> {
    let stem = path.file_stem()?.to_str()?;
    let meta: Value = serde_json::from_str(&fs::read_to_string(path.with_file_name(format!("{stem}-session.json"))).ok()?).ok()?;
    meta["title"].as_str().and_then(display_title)
}

pub(super) fn parse_tail(records: Records, tail: &str) -> SessionTail {
    match records {
        Records::Claude => parse_claude_tail(tail),
        Records::CodeBuddy => parse_codebuddy_tail(tail),
        Records::Qwen => parse_qwen_tail(tail),
    }
}

fn first_prompt(records: Records, line: &str) -> Option<String> {
    match records {
        Records::Claude => user_prompt_in_record(line),
        Records::CodeBuddy => codebuddy_prompt(&unwrap_envelope(serde_json::from_str(line).ok()?)),
        Records::Qwen => qwen_prompt(&serde_json::from_str(line).ok()?),
    }
}

fn record_body(records: Records, record: &Value) -> Value {
    match records {
        Records::CodeBuddy => unwrap_envelope(record.clone()),
        _ => record.clone(),
    }
}

pub(super) fn unwrap_envelope(record: Value) -> Value {
    let Value::Object(mut outer) = record else {
        return record;
    };
    let Some(Value::Object(mut inner)) = outer.remove("payload") else {
        return Value::Object(outer);
    };
    for (key, value) in outer {
        if key == "timestamp" {
            let millis = value.as_i64().or_else(|| value.as_str().and_then(parse_timestamp_ms));
            if let Some(millis) = millis {
                inner.entry(key).or_insert(json!(millis));
            }
        } else if key != "type" {
            inner.entry(key).or_insert(value);
        }
    }
    Value::Object(inner)
}

fn parse_codebuddy_tail(tail: &str) -> SessionTail {
    let records: Vec<Value> = tail
        .lines()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .map(unwrap_envelope)
        .collect();
    let lines: Vec<String> = records.iter().map(Value::to_string).collect();
    let mut parsed = workbuddy::parse_tail(&lines.join("\n"));
    for record in records.iter().rev() {
        if parsed.custom_title.is_none() && matches!(record["type"].as_str(), Some("custom-title" | "customTitle")) {
            parsed.custom_title = record["customTitle"].as_str().and_then(display_title);
        }
        if parsed.last_prompt.is_none() {
            if let Some(prompt) = codebuddy_prompt(record) {
                parsed.last_prompt = Some(prompt);
                parsed.turn_started_at = record["timestamp"].as_i64();
            }
        }
    }
    parsed
}

fn codebuddy_prompt(record: &Value) -> Option<String> {
    if record["type"] != "message" || record["role"] != "user" {
        return None;
    }
    let texts: Vec<&str> = record["content"]
        .as_array()?
        .iter()
        .filter_map(|part| part["text"].as_str())
        .collect();
    if let Some(query) = texts.iter().find_map(|text| tag_content(text, "user_query")) {
        return prompt_title(query);
    }
    let typed: Vec<&str> = texts.into_iter().filter(|text| !text.trim_start().starts_with('<')).collect();
    prompt_title(&typed.join("\n"))
}

fn parse_qwen_tail(tail: &str) -> SessionTail {
    let mut result = SessionTail::default();
    for record in tail.lines().rev().filter_map(|line| serde_json::from_str::<Value>(line).ok()) {
        let kind = record["type"].as_str().unwrap_or_default();
        let subtype = record["subtype"].as_str();
        if result.session_id.is_none() {
            result.session_id = text(&record["sessionId"]);
        }
        if result.cwd.is_none() {
            result.cwd = text(&record["cwd"]);
        }
        if kind == "system" && subtype == Some("custom_title") && result.title.is_none() && result.custom_title.is_none() {
            let title = record["systemPayload"]["customTitle"].as_str().and_then(display_title);
            if record["systemPayload"]["titleSource"] == "manual" {
                result.custom_title = title;
            } else {
                result.title = title;
            }
        }
        if kind == "assistant" {
            if result.model.is_none() {
                result.model = text(&record["model"]);
            }
            if result.context_tokens.is_none() {
                result.context_tokens = record["usageMetadata"]["promptTokenCount"].as_u64();
            }
            if result.last_message.is_none() {
                if let Some(reply) = qwen_reply(&record["message"]) {
                    result.take_reply(&reply);
                }
            }
            if result.current_tool.is_none() && result.last_prompt.is_none() {
                result.current_tool = qwen_tool_call(&record["message"]);
            }
        }
        if result.state == TurnState::Unknown {
            result.state = qwen_turn_state(kind, subtype, &record);
        }
        if result.last_prompt.is_none() {
            if let Some(prompt) = qwen_prompt(&record) {
                result.last_prompt = Some(prompt);
                result.turn_started_at = record["timestamp"].as_str().and_then(parse_timestamp_ms);
            }
        }
    }
    result.settle()
}

fn qwen_turn_state(kind: &str, subtype: Option<&str>, record: &Value) -> TurnState {
    match (kind, subtype) {
        ("assistant", _) if qwen_tool_call(&record["message"]).is_some() => TurnState::Working,
        ("assistant", _) => TurnState::Done,
        ("tool_result", _) => TurnState::Working,
        ("user", None) => TurnState::Working,
        _ => TurnState::Unknown,
    }
}

fn parts(message: &Value) -> impl Iterator<Item = &Value> {
    message["parts"].as_array().into_iter().flatten()
}

fn qwen_reply(message: &Value) -> Option<String> {
    let texts: Vec<&str> = parts(message)
        .filter(|part| part["thought"] != Value::Bool(true))
        .filter_map(|part| part["text"].as_str())
        .filter(|text| !text.trim().is_empty())
        .collect();
    (!texts.is_empty()).then(|| texts.join("\n"))
}

fn qwen_tool_call(message: &Value) -> Option<ToolCall> {
    let call = parts(message).filter_map(|part| part.get("functionCall")).last()?;
    let name = call["name"].as_str().filter(|name| !name.is_empty())?.to_string();
    let args = &call["args"];
    let detail = ["command", "file_path", "absolute_path", "path", "pattern", "url", "query", "description"]
        .iter()
        .find_map(|key| args[*key].as_str())
        .and_then(|value| super::title::shorten(value, 80));
    Some(ToolCall { name, detail })
}

fn qwen_prompt(record: &Value) -> Option<String> {
    if record["type"] != "user" || record.get("subtype").is_some_and(|subtype| !subtype.is_null()) {
        return None;
    }
    let typed: Vec<&str> = parts(&record["message"])
        .filter(|part| part.get("functionResponse").is_none())
        .filter_map(|part| part["text"].as_str())
        .collect();
    prompt_title(&typed.join("\n"))
}

fn text(value: &Value) -> Option<String> {
    value.as_str().filter(|text| !text.is_empty()).map(str::to_string)
}

#[cfg(test)]
#[path = "claude_compat_tests.rs"]
mod tests;
