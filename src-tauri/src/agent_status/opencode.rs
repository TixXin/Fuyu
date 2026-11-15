use std::{
    collections::HashSet,
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
    time::Duration,
};

use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde_json::Value;

use super::harness::{Harness, ScanRoots};
use super::markers::AGENT_RUNNING_STALE_AFTER_MS;
use super::session_scan::pick_title;
use super::reply_text::reply_ending;
use super::sessions::{session_phase, AgentSessionSummary, TurnState};
use super::title::{display_title, folder_title, prompt_title};
use super::todo_list::{todo_items, unfinished, TodoProgress};
use super::tool_call::{opencode_tool_call, ToolCall};
use super::window_focus::app_name;
use crate::platform;

pub(super) const PROVIDER: &str = "opencode";

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: None,
    status_light: None,
    sessions: Some(|roots: &ScanRoots, now, window_ms| {
        if roots.local_app_dir.is_none() {
            return Vec::new();
        }
        sessions(roots.home_dir, now, window_ms)
    }),
    remote: None,
};

const DESKTOP_EXES: [&str; 2] = ["OpenCode.exe", "OpenCode"];
const UNTITLED: [&str; 2] = ["New session - ", "Child session - "];
const RECENT_MESSAGES: i64 = 40;
const ACTIVE_TOOL: [&str; 3] = ["pending", "streaming", "running"];
const TODO_TOOL: &str = "todowrite";

use crate::agent_approval::OpencodeService as Service;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Stored {
    pub(super) summary: AgentSessionSummary,
    pub(super) state: TurnState,
    pub(super) from_service: bool,
}

type Stamp = (u64, Option<std::time::SystemTime>, u64, Option<std::time::SystemTime>);
type Cached = (PathBuf, Stamp, i64, Vec<Stored>);

static CACHE: Mutex<Option<Cached>> = Mutex::new(None);

pub(super) fn running_app() -> Option<String> {
    platform::process::running_executable(&DESKTOP_EXES).map(|exe| app_name(&exe))
}

fn sessions(home_dir: &Path, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    let env = |name: &str| std::env::var_os(name);
    let Some(db) = database_path(home_dir, env) else {
        return Vec::new();
    };
    let since = now - window_ms;
    let stored = cached_rows(&db, since);
    let service = crate::agent_approval::opencode_service_state(home_dir, env);
    finish(stored, service, now)
}

fn cached_rows(db: &Path, since: i64) -> Vec<Stored> {
    let Some(stamp) = stamp(db) else {
        return Vec::new();
    };
    let mut cache = CACHE.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some((path, known, known_since, rows)) = cache.as_ref() {
        if path == db && *known == stamp && *known_since <= since {
            return rows.iter().filter(|row| row.summary.updated_at >= since).cloned().collect();
        }
    }
    let rows = read_database(db, since).unwrap_or_default();
    *cache = Some((db.to_path_buf(), stamp, since, rows.clone()));
    rows
}

fn stamp(db: &Path) -> Option<Stamp> {
    let main = fs::metadata(db).ok()?;
    let wal = fs::metadata(with_suffix(db, "-wal")).ok();
    Some((
        main.len(),
        main.modified().ok(),
        wal.as_ref().map_or(0, fs::Metadata::len),
        wal.and_then(|meta| meta.modified().ok()),
    ))
}

fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(suffix);
    PathBuf::from(name)
}

pub(super) fn data_dir(home_dir: &Path, env: impl Fn(&str) -> Option<OsString>) -> PathBuf {
    xdg_dir(home_dir, &env, "XDG_DATA_HOME", &[".local", "share"]).join("opencode")
}

pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
    vec![xdg_dir(home_dir, &|name: &str| std::env::var_os(name), "XDG_CONFIG_HOME", &[".config"]).join("opencode").join("AGENTS.md")]
}

fn xdg_dir(home_dir: &Path, env: &impl Fn(&str) -> Option<OsString>, name: &str, fallback: &[&str]) -> PathBuf {
    env(name)
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
        .unwrap_or_else(|| fallback.iter().fold(home_dir.to_path_buf(), |dir, part| dir.join(part)))
}

pub(super) fn database_path(home_dir: &Path, env: impl Fn(&str) -> Option<OsString>) -> Option<PathBuf> {
    let data = data_dir(home_dir, &env);
    match env("OPENCODE_DB").filter(|name| !name.is_empty()) {
        Some(name) if name == ":memory:" => None,
        Some(name) => {
            let path = PathBuf::from(name);
            Some(if path.is_absolute() { path } else { data.join(path) })
        }
        None => Some(data.join("opencode.db")),
    }
}

pub(super) fn finish(stored: Vec<Stored>, service: Service, now: i64) -> Vec<AgentSessionSummary> {
    stored
        .into_iter()
        .map(|row| {
            let mut summary = row.summary;
            let gone = row.from_service && service == Service::Gone;
            let state = if gone && row.state == TurnState::Working { TurnState::Done } else { row.state };
            summary.closed = gone;
            summary.phase = session_phase(state, now - summary.updated_at, AGENT_RUNNING_STALE_AFTER_MS);
            summary
        })
        .collect()
}

pub(super) fn read_database(db: &Path, since: i64) -> rusqlite::Result<Vec<Stored>> {
    let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX;
    let conn = Connection::open_with_flags(db, flags)?;
    conn.busy_timeout(Duration::from_millis(250))?;
    let mut rows = Vec::new();
    let mut seen = HashSet::new();
    if let Some(columns) = columns(&conn, "session_v2")? {
        for row in read_v2(&conn, &columns, since)? {
            seen.insert(row.summary.session_id.clone());
            rows.push(row);
        }
    }
    if let (Some(columns), Some(_)) = (columns(&conn, "session")?, columns(&conn, "message")?) {
        if columns.contains("title") && columns.contains("directory") {
            rows.extend(read_v1(&conn, &columns, since)?.into_iter().filter(|row| !seen.contains(&row.summary.session_id)));
        }
    }
    Ok(rows)
}

fn columns(conn: &Connection, table: &str) -> rusqlite::Result<Option<HashSet<String>>> {
    let mut statement = conn.prepare("SELECT name FROM pragma_table_info(?1)")?;
    let names = statement.query_map([table], |row| row.get::<_, String>(0))?.collect::<rusqlite::Result<HashSet<_>>>()?;
    Ok((!names.is_empty()).then_some(names))
}

fn column<'a>(columns: &HashSet<String>, name: &'a str) -> &'a str {
    if columns.contains(name) { name } else { "NULL" }
}

struct SessionRow {
    id: String,
    title: Option<String>,
    directory: Option<String>,
    model: Option<String>,
    updated: i64,
    busy: Option<i64>,
    idle: Option<i64>,
    outcome: Option<String>,
    agent: Option<String>,
}

fn session_rows(conn: &Connection, table: &str, columns: &HashSet<String>, since: i64) -> rusqlite::Result<Vec<SessionRow>> {
    let busy = column(columns, "time_busy");
    let idle = column(columns, "time_idle");
    let parent = if columns.contains("parent_id") { "parent_id IS NULL" } else { "1" };
    let archived = if columns.contains("time_archived") { "time_archived IS NULL" } else { "1" };
    let sql = format!(
        "SELECT id, title, directory, {model}, time_updated, {busy}, {idle}, {outcome}, {agent} FROM {table} \
         WHERE {parent} AND {archived} \
         AND max(time_updated, coalesce({busy}, 0), coalesce({idle}, 0)) >= ?1",
        model = column(columns, "model"),
        outcome = column(columns, "idle_outcome"),
        agent = column(columns, "agent"),
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([since], |row| {
        Ok(SessionRow {
            id: row.get(0)?,
            title: row.get(1)?,
            directory: row.get(2)?,
            model: row.get(3)?,
            updated: row.get(4)?,
            busy: row.get(5)?,
            idle: row.get(6)?,
            outcome: row.get(7)?,
            agent: row.get(8)?,
        })
    })?;
    rows.collect()
}

fn read_v2(conn: &Connection, columns: &HashSet<String>, since: i64) -> rusqlite::Result<Vec<Stored>> {
    let has_parts = columns_exist(conn, "session_part")?;
    let has_messages = columns_exist(conn, "session_message")?;
    let mut out = Vec::new();
    for row in session_rows(conn, "session_v2", columns, since)? {
        let messages = if has_messages { v2_messages(conn, &row.id, has_parts)? } else { Turn::default() };
        let state = match (row.busy, row.idle) {
            (Some(busy), idle) if busy > idle.unwrap_or(0) => TurnState::Working,
            (Some(_), _) | (None, Some(_)) => match row.outcome.as_deref() {
                Some("failed") => TurnState::Failed,
                _ => TurnState::Done,
            },
            (None, None) => messages.state,
        };
        let updated = [Some(row.updated), row.busy, row.idle, messages.at].into_iter().flatten().max().unwrap_or(row.updated);
        out.push(Stored { summary: summary(&row, &messages, updated, state), state, from_service: true });
    }
    Ok(out)
}

fn read_v1(conn: &Connection, columns: &HashSet<String>, since: i64) -> rusqlite::Result<Vec<Stored>> {
    let has_parts = columns_exist(conn, "part")?;
    let has_todos = columns_exist(conn, "todo")?;
    let mut out = Vec::new();
    for row in session_rows(conn, "session", columns, since)? {
        let mut messages = v1_messages(conn, &row.id, has_parts)?;
        if has_todos {
            messages.todos = v1_todos(conn, &row.id)?;
        }
        let updated = [Some(row.updated), messages.at].into_iter().flatten().max().unwrap_or(row.updated);
        out.push(Stored { summary: summary(&row, &messages, updated, messages.state), state: messages.state, from_service: false });
    }
    Ok(out)
}

fn columns_exist(conn: &Connection, table: &str) -> rusqlite::Result<bool> {
    Ok(columns(conn, table)?.is_some())
}

#[derive(Default)]
struct Turn {
    first_prompt: Option<String>,
    last_prompt: Option<String>,
    prompt_at: Option<i64>,
    reply: Option<String>,
    model: Option<String>,
    state: TurnState,
    at: Option<i64>,
    agent: Option<String>,
    tokens: Option<u64>,
    tool: Option<ToolCall>,
    todos: Option<TodoProgress>,
    seen_assistant: bool,
    seen_todos: bool,
}

impl Turn {
    fn take_assistant(&mut self, data: &Value, tools: &[Value]) {
        if self.agent.is_none() {
            self.agent = text(&data["agent"]).or_else(|| text(&data["mode"]));
        }
        if self.tokens.is_none() {
            self.tokens = token_total(&data["tokens"]);
        }
        if !self.seen_assistant {
            self.seen_assistant = true;
            self.tool = tools
                .iter()
                .rev()
                .find(|tool| tool["state"]["status"].as_str().is_some_and(|status| ACTIVE_TOOL.contains(&status)))
                .and_then(opencode_tool_call);
        }
        if !self.seen_todos {
            if let Some(call) = tools.iter().rev().find(|tool| tool_name(tool) == Some(TODO_TOOL) && tool["state"]["input"]["todos"].is_array()) {
                self.seen_todos = true;
                self.todos = unfinished(todo_items(&call["state"]["input"]["todos"]));
            }
        }
    }
}

fn tool_name(tool: &Value) -> Option<&str> {
    tool["name"].as_str().or_else(|| tool["tool"].as_str())
}

fn token_total(tokens: &Value) -> Option<u64> {
    let total: u64 = [&tokens["input"], &tokens["output"], &tokens["reasoning"], &tokens["cache"]["read"], &tokens["cache"]["write"]]
        .iter()
        .filter_map(|value| value.as_f64())
        .map(|value| value.max(0.0) as u64)
        .sum();
    (total > 0).then_some(total)
}

fn tools_in(content: &Value) -> Vec<Value> {
    content.as_array().into_iter().flatten().filter(|part| part["type"] == "tool").cloned().collect()
}

fn v2_messages(conn: &Connection, session: &str, has_parts: bool) -> rusqlite::Result<Turn> {
    let mut turn = Turn {
        first_prompt: conn
            .query_row(
                "SELECT data FROM session_message WHERE session_id = ?1 AND type = 'user' ORDER BY seq LIMIT 1",
                [session],
                |row| row.get::<_, String>(0),
            )
            .optional()?
            .and_then(|data| json(&data)["text"].as_str().and_then(prompt_title)),
        ..Turn::default()
    };
    let mut statement = conn.prepare(
        "SELECT id, type, data, time_created FROM session_message WHERE session_id = ?1 ORDER BY seq DESC LIMIT ?2",
    )?;
    let recent = statement
        .query_map(params![session, RECENT_MESSAGES], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, i64>(3)?))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut state = None;
    for (id, kind, data, created) in recent {
        let data = json(&data);
        turn.at = turn.at.max(Some(created));
        match kind.as_str() {
            "user" if turn.last_prompt.is_none() => {
                turn.last_prompt = data["text"].as_str().and_then(prompt_title);
                turn.prompt_at = data["time"]["created"].as_i64().or(Some(created));
                state.get_or_insert(TurnState::Working);
            }
            "assistant" => {
                if state.is_none() {
                    state = Some(assistant_state(&data));
                }
                if turn.model.is_none() {
                    turn.model = text(&data["model"]["id"]).or_else(|| text(&data["model"]["modelID"]));
                }
                if turn.reply.is_none() {
                    turn.reply = content_text(&data["content"]).or(if has_parts { v2_part_text(conn, &id)? } else { None });
                }
                let mut tools = tools_in(&data["content"]);
                if tools.is_empty() && has_parts {
                    tools = v2_part_tools(conn, &id)?;
                }
                turn.take_assistant(&data, &tools);
            }
            _ => {}
        }
        if turn.last_prompt.is_some() && turn.reply.is_some() && turn.model.is_some() {
            break;
        }
    }
    turn.state = state.unwrap_or_default();
    Ok(turn)
}

fn v2_part_text(conn: &Connection, message: &str) -> rusqlite::Result<Option<String>> {
    let mut statement = conn.prepare("SELECT data FROM session_part WHERE message_id = ?1 AND type = 'text' ORDER BY ordinal")?;
    let texts = statement.query_map([message], |row| row.get::<_, String>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(joined(texts.iter().map(|data| json(data)).filter_map(|part| part["text"].as_str().map(str::to_string))))
}

fn v2_part_tools(conn: &Connection, message: &str) -> rusqlite::Result<Vec<Value>> {
    let mut statement = conn.prepare("SELECT data FROM session_part WHERE message_id = ?1 AND type = 'tool' ORDER BY ordinal")?;
    let tools = statement.query_map([message], |row| row.get::<_, String>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(tools.iter().map(|data| json(data)).collect())
}

fn v1_todos(conn: &Connection, session: &str) -> rusqlite::Result<Option<TodoProgress>> {
    let mut statement = conn.prepare("SELECT content, status FROM todo WHERE session_id = ?1 ORDER BY position")?;
    let todos = statement
        .query_map([session], |row| Ok(serde_json::json!({ "content": row.get::<_, String>(0)?, "status": row.get::<_, String>(1)? })))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(unfinished(todo_items(&Value::Array(todos))))
}

fn v1_messages(conn: &Connection, session: &str, has_parts: bool) -> rusqlite::Result<Turn> {
    let mut statement = conn.prepare(
        "SELECT id, data, time_created FROM message WHERE session_id = ?1 ORDER BY time_created DESC, id DESC LIMIT ?2",
    )?;
    let recent = statement
        .query_map(params![session, RECENT_MESSAGES], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, i64>(2)?))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut turn = Turn::default();
    let mut state = None;
    for (id, data, created) in recent {
        let data = json(&data);
        turn.at = turn.at.max(Some(created)).max(data["time"]["completed"].as_i64());
        let parts = if has_parts { v1_parts(conn, &id)? } else { Vec::new() };
        match data["role"].as_str() {
            Some("user") if turn.last_prompt.is_none() => {
                turn.last_prompt = v1_text(&parts).as_deref().and_then(prompt_title);
                turn.prompt_at = data["time"]["created"].as_i64().or(Some(created));
                state.get_or_insert(TurnState::Working);
            }
            Some("assistant") => {
                if state.is_none() {
                    state = Some(assistant_state(&data));
                }
                if turn.model.is_none() {
                    turn.model = text(&data["modelID"]);
                }
                if turn.reply.is_none() {
                    turn.reply = v1_text(&parts);
                }
                let tools: Vec<Value> = parts.into_iter().filter(|part| part["type"] == "tool").collect();
                turn.take_assistant(&data, &tools);
            }
            _ => {}
        }
        if turn.last_prompt.is_some() && turn.reply.is_some() && turn.model.is_some() {
            break;
        }
    }
    turn.state = state.unwrap_or_default();
    Ok(turn)
}

fn v1_parts(conn: &Connection, message: &str) -> rusqlite::Result<Vec<Value>> {
    let mut statement = conn.prepare("SELECT data FROM part WHERE message_id = ?1 ORDER BY id")?;
    let parts = statement.query_map([message], |row| row.get::<_, String>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(parts.iter().map(|data| json(data)).collect())
}

fn v1_text(parts: &[Value]) -> Option<String> {
    joined(
        parts
            .iter()
            .filter(|part| part["type"] == "text" && part["synthetic"] != Value::Bool(true))
            .filter_map(|part| part["text"].as_str().map(str::to_string)),
    )
}

fn assistant_state(data: &Value) -> TurnState {
    if !data["error"].is_null() {
        TurnState::Failed
    } else if data["time"]["completed"].is_null() {
        TurnState::Working
    } else {
        TurnState::Done
    }
}

fn content_text(content: &Value) -> Option<String> {
    joined(
        content
            .as_array()?
            .iter()
            .filter(|part| part["type"] == "text")
            .filter_map(|part| part["text"].as_str().map(str::to_string)),
    )
}

fn joined(texts: impl Iterator<Item = String>) -> Option<String> {
    let text = texts.filter(|text| !text.trim().is_empty()).collect::<Vec<_>>().join("\n");
    (!text.trim().is_empty()).then_some(text)
}

fn summary(row: &SessionRow, turn: &Turn, updated: i64, state: TurnState) -> AgentSessionSummary {
    let agent = row.agent.as_deref().or(turn.agent.as_deref());
    let named = row.title.as_deref().filter(|title| !UNTITLED.iter().any(|prefix| title.starts_with(prefix)));
    let cwd = row.directory.clone().filter(|dir| !dir.is_empty());
    let (title, title_source) = pick_title(
        None,
        named.and_then(display_title),
        turn.first_prompt.clone().or_else(|| turn.last_prompt.clone()),
        cwd.as_deref().and_then(folder_title),
    );
    let model = row.model.as_deref().map(json);
    let reply = turn.reply.as_deref().map(reply_ending).unwrap_or_default();
    AgentSessionSummary {
        provider: PROVIDER,
        session_id: row.id.clone(),
        cwd,
        title,
        title_source,
        model: model.as_ref().and_then(|model| text(&model["id"]).or_else(|| text(&model["modelID"]))).or_else(|| turn.model.clone()),
        effort: model.as_ref().and_then(|model| text(&model["variant"])),
        phase: "completed",
        last_message: reply.message,
        reply_marker: reply.marker,
        reply_asks: reply.asks,
        updated_at: updated,
        host: None,
        turn_started_at: turn.prompt_at,
        last_prompt: turn.last_prompt.clone(),
        current_tool: turn.tool.clone().filter(|_| state == TurnState::Working),
        permission_mode: (agent == Some("plan")).then_some("plan"),
        subagents: 0,
        background_tasks: 0,
        compacting: false,
        todos: turn.todos.clone(),
        closed: false,
        remote_host: None,
        context_tokens: turn.tokens,
    }
}

fn json(text: &str) -> Value {
    serde_json::from_str(text).unwrap_or(Value::Null)
}

fn text(value: &Value) -> Option<String> {
    value.as_str().map(str::trim).filter(|text| !text.is_empty()).map(str::to_string)
}

#[cfg(test)]
#[path = "opencode_tests.rs"]
mod tests;
