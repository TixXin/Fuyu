use std::{
    collections::HashMap,
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
    time::Duration,
};

use rusqlite::{Connection, OpenFlags};
use serde_json::{json, Value};

use super::codex_hooks::agent_status_command;
use super::claude_hooks::APPROVAL_HOOK_TIMEOUT_SECONDS;
use super::harness::{Harness, HookEnv, Hooks, ScanRoots, StatusLight};
use super::hooks_state::HookInstallState;
use super::markers::{file_modified_unix_millis, AGENT_RUNNING_STALE_AFTER_MS};
use super::session_host::SessionHost;
use super::session_scan::{pick_title, read_tail};
use super::sessions::{session_phase, AgentSessionSummary, TurnState};
use super::title::{display_title, folder_title, prompt_title, shorten};
use super::tool_call::ToolCall;
use super::{is_island_hook_text, write_text_file, AGENT_APPROVAL_SCRIPT_FILE_NAME};

pub(super) const PROVIDER: &str = "cursor";
const HOOKS_FILE: &str = "hooks.json";
const HOME_DIR: &str = ".cursor";
const STATUS_TIMEOUT: i64 = 10;
const HEAD_BYTES: usize = 64 * 1024;

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks { install, check, uninstall }),
    status_light: Some(StatusLight {
        running_marker: "agent-cursor-running.flag",
        running_hold: "agent-cursor-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: Some(sessions),
    remote: None,
};

pub(super) fn prompt_files(_home_dir: &Path) -> Vec<PathBuf> {
    Vec::new()
}

fn home(home_dir: &Path) -> PathBuf {
    home_dir.join(HOME_DIR)
}

fn entries(env: &HookEnv) -> Vec<(&'static str, Value)> {
    let approval = env.status_script.with_file_name(AGENT_APPROVAL_SCRIPT_FILE_NAME);
    let status = |phase| command_entry(agent_status_command(env.status_script, PROVIDER, phase), STATUS_TIMEOUT);
    vec![
        ("sessionStart", status("running")),
        ("beforeSubmitPrompt", status("running")),
        ("stop", status("completed")),
        ("sessionEnd", status("idle")),
        ("beforeShellExecution", command_entry(approval_command(&approval), APPROVAL_HOOK_TIMEOUT_SECONDS)),
        ("beforeMCPExecution", command_entry(approval_command(&approval), APPROVAL_HOOK_TIMEOUT_SECONDS)),
    ]
}

fn command_entry(command: String, timeout: i64) -> Value {
    json!({ "command": command, "timeout": timeout })
}

#[cfg(not(windows))]
fn approval_command(script: &Path) -> String {
    let quoted = format!("'{}'", script.to_string_lossy().replace('\'', "'\\''"));
    format!("[ -f {quoted} ] && exec /bin/sh {quoted} cursor || printf '%s' '{{\"permission\":\"ask\"}}'")
}

#[cfg(windows)]
fn approval_command(script: &Path) -> String {
    let script = script.to_string_lossy().replace('\'', "''");
    format!(
        "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"if (Test-Path -LiteralPath '{script}') {{ powershell.exe -NoProfile -ExecutionPolicy Bypass -File '{script}' cursor }} else {{ Write-Output ([char]123 + [char]34 + 'permission' + [char]34 + ':' + [char]34 + 'ask' + [char]34 + [char]125) }}\""
    )
}

fn install(env: &HookEnv) -> Result<(), String> {
    let dir = home(env.home_dir);
    if !dir.is_dir() {
        return Ok(());
    }
    install_into(&dir, &entries(env))
}

fn check(env: &HookEnv) -> HookInstallState {
    let dir = home(env.home_dir);
    if !dir.is_dir() {
        return HookInstallState::Absent;
    }
    state_in(&dir, &entries(env))
}

fn uninstall(env: &HookEnv) -> Result<(), String> {
    uninstall_from(&home(env.home_dir))
}

pub(super) fn install_into(dir: &Path, entries: &[(&'static str, Value)]) -> Result<(), String> {
    let path = dir.join(HOOKS_FILE);
    let original = read_config(&path)?;
    if original.is_none() && entries.is_empty() {
        return Ok(());
    }
    let mut config = original.clone().unwrap_or_else(|| json!({ "version": 1 }));
    merge_hooks(&mut config, entries)?;
    if original.as_ref() == Some(&config) {
        return Ok(());
    }
    let content = serde_json::to_string_pretty(&config).map_err(|error| format!("Failed to serialize Cursor hooks.json: {error}"))?;
    write_text_file(&path, &format!("{content}\n"))
}

pub(super) fn uninstall_from(dir: &Path) -> Result<(), String> {
    install_into(dir, &[])
}

pub(super) fn state_in(dir: &Path, entries: &[(&'static str, Value)]) -> HookInstallState {
    let Ok(content) = fs::read_to_string(dir.join(HOOKS_FILE)) else {
        return HookInstallState::NotInstalled;
    };
    let trimmed = content.trim_start_matches('\u{feff}').trim();
    match serde_json::from_str::<Value>(trimmed) {
        Ok(config) => hook_state(&config, entries),
        Err(_) if is_island_hook_text(trimmed) => HookInstallState::Outdated,
        Err(_) => HookInstallState::NotInstalled,
    }
}

fn read_config(path: &Path) -> Result<Option<Value>, String> {
    match fs::read_to_string(path) {
        Ok(content) => {
            let trimmed = content.trim_start_matches('\u{feff}').trim();
            if trimmed.is_empty() {
                return Ok(Some(json!({ "version": 1 })));
            }
            serde_json::from_str(trimmed)
                .map(Some)
                .map_err(|error| format!("Failed to parse Cursor hooks.json: {error}"))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Failed to read Cursor hooks.json: {error}")),
    }
}

fn merge_hooks(config: &mut Value, entries: &[(&'static str, Value)]) -> Result<(), String> {
    let remove_hooks = {
        let root = config.as_object_mut().ok_or_else(|| "Cursor hooks.json must contain a JSON object.".to_string())?;
        if !root.contains_key("version") {
            root.insert("version".into(), json!(1));
        }
        if root.get("hooks").is_some_and(|hooks| !hooks.is_null() && !hooks.is_object()) {
            return Err("Cursor hooks.json has a hooks value that is not an object.".into());
        }
        let hooks = root.entry("hooks").or_insert_with(|| json!({}));
        let Some(hooks) = hooks.as_object_mut() else {
            return Err("Cursor hooks.json has a hooks value that is not an object.".into());
        };
        let managed: Vec<String> = entries.iter().map(|(event, _)| (*event).to_string()).collect();
        for event in &managed {
            let kept = unmanaged(hooks.get(event));
            hooks.insert(event.clone(), Value::Array(kept));
        }
        let others: Vec<String> = hooks.keys().filter(|event| !managed.iter().any(|name| name == *event)).cloned().collect();
        for event in others {
            let Some(original) = hooks.get(&event).and_then(Value::as_array).map(Vec::len) else {
                continue;
            };
            let kept = unmanaged(hooks.get(&event));
            if kept.is_empty() {
                hooks.remove(&event);
            } else if kept.len() != original {
                hooks.insert(event, Value::Array(kept));
            }
        }
        for (event, entry) in entries {
            if let Some(Value::Array(list)) = hooks.get_mut(*event) {
                list.push(entry.clone());
            }
        }
        hooks.is_empty()
    };
    if remove_hooks {
        config.as_object_mut().map(|root| root.remove("hooks"));
    }
    Ok(())
}

fn unmanaged(value: Option<&Value>) -> Vec<Value> {
    value
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|entry| entry.get("command").and_then(Value::as_str).is_none_or(|command| !is_island_hook_text(command)))
        .collect()
}

fn hook_state(config: &Value, entries: &[(&'static str, Value)]) -> HookInstallState {
    let hooks = &config["hooks"];
    if !is_island_hook_text(&hooks.to_string()) {
        return HookInstallState::NotInstalled;
    }
    let current = entries.iter().all(|(event, entry)| {
        hooks[*event].as_array().is_some_and(|list| list.iter().any(|item| item == entry))
    });
    if current { HookInstallState::Current } else { HookInstallState::Outdated }
}

fn sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    if roots.local_app_dir.is_none() {
        return Vec::new();
    }
    let cursor_home = home(roots.home_dir);
    if !cursor_home.is_dir() {
        return Vec::new();
    }
    let titles = load_titles(&cursor_home, roots.home_dir);
    transcript_files(&cursor_home)
        .into_iter()
        .filter_map(|(project, file)| {
            let empty = TitleMeta::default();
            let meta = titles.get(&session_id_of(&file)).unwrap_or(&empty);
            read_session(&project, &file, meta, now, window_ms)
        })
        .collect()
}

fn session_id_of(file: &Path) -> String {
    file.file_stem().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default()
}

fn transcript_files(cursor_home: &Path) -> Vec<(String, PathBuf)> {
    let mut found = Vec::new();
    let Ok(projects) = fs::read_dir(cursor_home.join("projects")) else {
        return found;
    };
    for project in projects.flatten() {
        let project_name = project.file_name().to_string_lossy().into_owned();
        let Ok(sessions) = fs::read_dir(project.path().join("agent-transcripts")) else {
            continue;
        };
        for session in sessions.flatten() {
            let dir = session.path();
            if !dir.is_dir() {
                continue;
            }
            let name = session.file_name().to_string_lossy().into_owned();
            let file = dir.join(format!("{name}.jsonl"));
            if file.is_file() {
                found.push((project_name.clone(), file));
            }
        }
    }
    found
}

#[derive(Default)]
struct TitleMeta {
    title: Option<String>,
    model: Option<String>,
    effort: Option<String>,
    running: bool,
    started_at: Option<i64>,
    context_tokens: Option<u64>,
}

fn read_session(project: &str, file: &Path, meta: &TitleMeta, now: i64, window_ms: i64) -> Option<AgentSessionSummary> {
    let updated_at = file_modified_unix_millis(file)?;
    if now.saturating_sub(updated_at) > window_ms {
        return None;
    }
    let head = read_head(file);
    let first_prompt = first_user_text(&head).as_deref().and_then(prompt_title);
    let parsed = parse_transcript(&read_tail(file).unwrap_or_default());
    let state = if meta.running { TurnState::Working } else { parsed.state };
    if first_prompt.is_none() && parsed.last_prompt.is_none() && meta.title.is_none() {
        return None;
    }
    let cwd = workspace_path(project);
    let (title, title_source) = pick_title(None, meta.title.clone(), first_prompt, cwd.as_deref().and_then(folder_title));
    let session_id = session_id_of(file);
    if session_id.is_empty() {
        return None;
    }
    Some(AgentSessionSummary {
        provider: PROVIDER,
        session_id,
        cwd,
        title,
        title_source,
        model: meta.model.clone(),
        effort: meta.effort.clone(),
        phase: session_phase(state, now.saturating_sub(updated_at), AGENT_RUNNING_STALE_AFTER_MS),
        last_message: parsed.last_message,
        reply_marker: None,
        reply_asks: false,
        updated_at,
        host: Some(SessionHost { name: "Cursor".into(), exe: None, kind: "editor" }),
        turn_started_at: meta.running.then_some(meta.started_at).flatten(),
        last_prompt: parsed.last_prompt,
        current_tool: parsed.tool,
        permission_mode: None,
        subagents: 0,
        background_tasks: 0,
        compacting: false,
        todos: None,
        closed: false,
        context_tokens: meta.context_tokens,
        remote_host: None,
        parent_id: None,
    })
}

struct Parsed {
    state: TurnState,
    last_prompt: Option<String>,
    last_message: Option<String>,
    tool: Option<ToolCall>,
}

fn parse_transcript(tail: &str) -> Parsed {
    let mut parsed = Parsed { state: TurnState::Unknown, last_prompt: None, last_message: None, tool: None };
    for value in tail.lines().filter_map(|line| serde_json::from_str::<Value>(line).ok()) {
        if value["type"] == "turn_ended" {
            parsed.state = if value["status"] == "error" { TurnState::Failed } else { TurnState::Done };
            parsed.tool = None;
            continue;
        }
        match value["role"].as_str() {
            Some("user") => {
                if let Some(text) = message_text(&value) {
                    parsed.last_prompt = shorten(&text, 160);
                }
                parsed.state = TurnState::Working;
                parsed.tool = None;
            }
            Some("assistant") => {
                if let Some(text) = message_text(&value) {
                    parsed.last_message = shorten(&text, 240);
                }
                if let Some(tool) = tool_call(&value) {
                    parsed.tool = Some(tool);
                    parsed.state = TurnState::Working;
                } else if parsed.last_message.is_some() {
                    parsed.state = TurnState::Done;
                    parsed.tool = None;
                }
            }
            _ => {}
        }
    }
    parsed
}

fn message_text(value: &Value) -> Option<String> {
    let content = &value["message"]["content"];
    if let Some(text) = content.as_str() {
        let trimmed = text.trim();
        return (!trimmed.is_empty()).then(|| trimmed.to_string());
    }
    let text = content
        .as_array()?
        .iter()
        .filter(|part| part["type"] != "tool_use")
        .filter_map(|part| part["text"].as_str())
        .collect::<Vec<_>>()
        .join("\n");
    let trimmed = text.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn tool_call(value: &Value) -> Option<ToolCall> {
    let part = value["message"]["content"].as_array()?.iter().rev().find(|part| part["type"] == "tool_use")?;
    let name = part["name"].as_str().filter(|name| !name.is_empty())?;
    let input = &part["input"];
    let detail = ["command", "file_path", "path", "pattern", "query", "url"]
        .iter()
        .find_map(|key| input[*key].as_str())
        .and_then(|text| shorten(text, 80));
    Some(ToolCall { name: name.to_string(), detail })
}

fn first_user_text(head: &str) -> Option<String> {
    head.lines().filter_map(|line| serde_json::from_str::<Value>(line).ok()).find(|value| value["role"] == "user").and_then(|value| message_text(&value))
}

fn read_head(path: &Path) -> String {
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(_) => return String::new(),
    };
    let mut bytes = vec![0; HEAD_BYTES];
    let Ok(read) = file.read(&mut bytes) else {
        return String::new();
    };
    bytes.truncate(read);
    String::from_utf8_lossy(&bytes).into_owned()
}

fn load_titles(cursor_home: &Path, home_dir: &Path) -> HashMap<String, TitleMeta> {
    let mut titles = HashMap::new();
    read_search_db(&search_db(home_dir), &mut titles);
    read_summary_db(&cursor_home.join("ai-tracking").join("ai-code-tracking.db"), &mut titles);
    read_state_db(&state_db(home_dir), &mut titles);
    titles
}

fn state_db(home_dir: &Path) -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        home_dir.join("Library/Application Support/Cursor/User/globalStorage/state.vscdb")
    }
    #[cfg(windows)]
    {
        std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| home_dir.join("AppData").join("Roaming"))
            .join("Cursor")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb")
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        home_dir.join(".config/Cursor/User/globalStorage/state.vscdb")
    }
}

fn search_db(home_dir: &Path) -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        home_dir.join("Library/Application Support/Cursor/User/globalStorage/conversation-search.db")
    }
    #[cfg(windows)]
    {
        std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| home_dir.join("AppData").join("Roaming"))
            .join("Cursor")
            .join("User")
            .join("globalStorage")
            .join("conversation-search.db")
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        home_dir.join(".config/Cursor/User/globalStorage/conversation-search.db")
    }
}

fn read_search_db(path: &Path, titles: &mut HashMap<String, TitleMeta>) {
    let Some(conn) = open_read_only(path) else {
        return;
    };
    let Ok(mut statement) = conn.prepare("SELECT id, title FROM conversations WHERE ifnull(is_archived, 0) = 0") else {
        return;
    };
    let Ok(rows) = statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))) else {
        return;
    };
    for (id, title) in rows.flatten() {
        remember(titles, id, title, None);
    }
}

fn read_summary_db(path: &Path, titles: &mut HashMap<String, TitleMeta>) {
    let Some(conn) = open_read_only(path) else {
        return;
    };
    let Ok(mut statement) = conn.prepare("SELECT conversationId, title, model FROM conversation_summaries") else {
        return;
    };
    let Ok(rows) = statement.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?, row.get::<_, Option<String>>(2)?))
    }) else {
        return;
    };
    for (id, title, model) in rows.flatten() {
        remember(titles, id, title, model);
    }
}

fn open_read_only(path: &Path) -> Option<Connection> {
    if !path.is_file() {
        return None;
    }
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX).ok()?;
    let _ = conn.busy_timeout(Duration::from_millis(200));
    let _ = conn.pragma_update(None, "query_only", "ON");
    Some(conn)
}

fn read_state_db(path: &Path, titles: &mut HashMap<String, TitleMeta>) {
    let Some(conn) = open_read_only(path) else {
        return;
    };
    if let Ok(mut statement) = conn.prepare("SELECT composerId, value FROM composerHeaders") {
        if let Ok(rows) = statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))) {
            for (id, value) in rows.flatten() {
                let Ok(parsed) = serde_json::from_str::<Value>(&value) else {
                    continue;
                };
                note_running(titles, &id, &parsed);
            }
        }
    }
    let Ok(mut statement) = conn.prepare(
        "SELECT substr(key, 14), value FROM cursorDiskKV WHERE key LIKE 'composerData:%' AND length(value) < 1000000",
    ) else {
        return;
    };
    let Ok(rows) = statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))) else {
        return;
    };
    for (id, value) in rows.flatten() {
        let Ok(parsed) = serde_json::from_str::<Value>(&value) else {
            continue;
        };
        apply_composer(titles, id, &parsed);
    }
}

fn note_running(titles: &mut HashMap<String, TitleMeta>, id: &str, value: &Value) {
    let Some(started) = value.get("unfinishedRunAt").and_then(json_i64).filter(|started| *started > 0) else {
        return;
    };
    let entry = titles.entry(id.to_string()).or_default();
    entry.running = true;
    entry.started_at = Some(started);
}

fn apply_composer(titles: &mut HashMap<String, TitleMeta>, id: String, value: &Value) {
    note_running(titles, &id, value);
    let entry = titles.entry(id).or_default();
    if let Some(model) = composer_model(&value["modelConfig"]) {
        entry.model = Some(model);
    }
    if let Some(effort) = reasoning_effort(&value["modelConfig"]) {
        entry.effort = Some(effort);
    }
    if let Some(tokens) = json_u64(&value["contextTokensUsed"]) {
        entry.context_tokens = Some(tokens);
    }
}

fn composer_model(config: &Value) -> Option<String> {
    let name = config["modelName"].as_str().unwrap_or("").trim();
    if name.is_empty() || name == "default" { None } else { Some(name.to_string()) }
}

fn reasoning_effort(config: &Value) -> Option<String> {
    let parameters = config["selectedModels"].as_array()?.first()?["parameters"].as_array()?;
    let effort = parameters.iter().find(|item| item["id"] == "reasoning_effort")?["value"].as_str()?.trim();
    if effort.is_empty() { None } else { Some(effort.to_string()) }
}

fn json_i64(value: &Value) -> Option<i64> {
    value.as_i64()
}

fn json_u64(value: &Value) -> Option<u64> {
    value.as_u64()
}

fn remember(titles: &mut HashMap<String, TitleMeta>, id: String, title: Option<String>, model: Option<String>) {
    let entry = titles.entry(id).or_default();
    if let Some(title) = title.as_deref().and_then(display_title) {
        entry.title = Some(title);
    }
    if let Some(model) = model.filter(|model| !model.trim().is_empty()) {
        entry.model = Some(model);
    }
}

pub(super) fn workspace_path(name: &str) -> Option<String> {
    let (root, rest) = workspace_root(name)?;
    resolve_workspace(&root, rest).map(|path| path.to_string_lossy().into_owned())
}

fn workspace_root(name: &str) -> Option<(PathBuf, &str)> {
    #[cfg(windows)]
    if let Some(rooted) = windows_drive(name) {
        return Some(rooted);
    }
    Some((PathBuf::from("/"), name))
}

#[cfg(windows)]
fn windows_drive(name: &str) -> Option<(PathBuf, &str)> {
    let mut chars = name.chars();
    let letter = chars.next()?;
    if !letter.is_ascii_alphabetic() || chars.next() != Some('-') {
        return None;
    }
    Some((PathBuf::from(format!("{letter}:\\")), name.get(2..)?))
}

pub(super) fn resolve_workspace(root: &Path, dashed: &str) -> Option<PathBuf> {
    if !root.is_dir() {
        return None;
    }
    let mut path = root.to_path_buf();
    let mut rest = dashed;
    while !rest.is_empty() {
        rest = rest.trim_start_matches('-');
        if rest.is_empty() {
            break;
        }
        let name = longest_child(&path, rest)?;
        if rest == name {
            rest = "";
        } else {
            rest = rest.get(name.len() + 1..).unwrap_or("");
        }
        path.push(&name);
    }
    path.is_dir().then_some(path)
}

fn longest_child(dir: &Path, rest: &str) -> Option<String> {
    let mut best: Option<String> = None;
    for entry in fs::read_dir(dir).ok()?.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.is_empty() {
            continue;
        }
        let matched = rest == name || rest.starts_with(&format!("{name}-"));
        if matched && best.as_ref().is_none_or(|current| name.len() > current.len()) {
            best = Some(name);
        }
    }
    best
}

#[cfg(test)]
#[path = "cursor_tests.rs"]
mod tests;
