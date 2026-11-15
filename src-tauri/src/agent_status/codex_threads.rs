use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
    time::{Duration, SystemTime},
};

use rusqlite::{Connection, OpenFlags, OptionalExtension};
use serde_json::Value;

use super::session_host::codex_host;
use super::sessions::{AgentSessionSummary, SessionTail, TurnState};
use super::title::{display_title, prompt_title};

const STATE_DB: &str = "state_5.sqlite";
const HISTORY_DB: &str = "thread_history_1.sqlite";

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(super) struct Thread {
    pub(super) id: String,
    pub(super) rollout: Option<PathBuf>,
    pub(super) updated_at: i64,
    pub(super) cwd: Option<String>,
    pub(super) name: Option<String>,
    pub(super) first_prompt: Option<String>,
    pub(super) model: Option<String>,
    pub(super) effort: Option<String>,
    pub(super) originator: Option<String>,
}

type Stamp = (u64, Option<SystemTime>, u64, Option<SystemTime>);

struct ThreadsCache {
    db: PathBuf,
    stamp: Stamp,
    since: i64,
    threads: Vec<Thread>,
}

static THREADS: Mutex<Option<ThreadsCache>> = Mutex::new(None);
type HistoryCache = HashMap<(String, i64), (AgentSessionSummary, TurnState)>;

static HISTORY: Mutex<Option<HistoryCache>> = Mutex::new(None);

pub(super) fn recent_threads(codex_home: &Path, since: i64) -> Option<Vec<Thread>> {
    let db = codex_home.join(STATE_DB);
    let stamp = stamp(&db)?;
    let mut cache = THREADS.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(known) = cache.as_ref() {
        if known.db == db && known.stamp == stamp && known.since <= since {
            return Some(known.threads.iter().filter(|thread| thread.updated_at >= since).cloned().collect());
        }
    }
    let threads = read_threads(&db, since).ok().flatten()?;
    *cache = Some(ThreadsCache { db, stamp, since, threads: threads.clone() });
    Some(threads)
}

pub(super) fn sqlite_only_summary(codex_home: &Path, thread: &Thread) -> (AgentSessionSummary, TurnState) {
    let key = (thread.id.clone(), thread.updated_at);
    let mut cache = HISTORY.lock().unwrap_or_else(PoisonError::into_inner);
    let known = cache.get_or_insert_with(HashMap::new);
    if let Some(found) = known.get(&key) {
        return found.clone();
    }
    let (tail, state) = read_history(&codex_home.join(HISTORY_DB), &thread.id)
        .unwrap_or_else(|_| (SessionTail::default(), TurnState::Done));
    let built = (summary_from(thread, tail), state);
    known.retain(|(id, _), _| *id != thread.id);
    known.insert(key, built.clone());
    built
}

fn summary_from(thread: &Thread, tail: SessionTail) -> AgentSessionSummary {
    AgentSessionSummary {
        provider: super::codex::PROVIDER,
        session_id: thread.id.clone(),
        cwd: thread.cwd.clone(),
        title: None,
        title_source: None,
        model: thread.model.clone().or(tail.model),
        effort: thread.effort.clone().or(tail.effort),
        phase: "completed",
        last_message: tail.last_message,
        reply_marker: tail.reply_marker,
        reply_asks: tail.reply_asks,
        updated_at: thread.updated_at,
        host: thread.originator.as_deref().map(codex_host),
        turn_started_at: tail.turn_started_at,
        last_prompt: tail.last_prompt,
        current_tool: None,
        permission_mode: None,
        subagents: 0,
        background_tasks: 0,
        compacting: false,
        todos: None,
        closed: false,
        context_tokens: None,
        remote_host: None,
    }
}

fn stamp(db: &Path) -> Option<Stamp> {
    let main = fs::metadata(db).ok().filter(fs::Metadata::is_file)?;
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

pub(super) fn open_read_only(db: &Path) -> rusqlite::Result<Connection> {
    let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX | OpenFlags::SQLITE_OPEN_URI;
    let conn = if with_suffix(db, "-wal").exists() {
        Connection::open_with_flags(db, flags)?
    } else {
        Connection::open_with_flags(immutable_uri(db), flags)?
    };
    conn.busy_timeout(Duration::from_millis(250))?;
    Ok(conn)
}

pub(super) fn immutable_uri(db: &Path) -> String {
    let raw = db.to_string_lossy().replace('\\', "/");
    let mut uri = String::from("file:");
    if !raw.starts_with('/') {
        uri.push('/');
    }
    for char in raw.chars() {
        match char {
            '%' | '?' | '#' => uri.push_str(&format!("%{:02X}", char as u32)),
            _ => uri.push(char),
        }
    }
    uri.push_str("?immutable=1");
    uri
}

fn columns(conn: &Connection, table: &str) -> rusqlite::Result<HashSet<String>> {
    let mut statement = conn.prepare("SELECT name FROM pragma_table_info(?1)")?;
    let names = statement.query_map([table], |row| row.get::<_, String>(0))?;
    names.collect()
}

fn column(columns: &HashSet<String>, name: &str) -> String {
    if columns.contains(name) { name.to_string() } else { "NULL".to_string() }
}

fn read_threads(db: &Path, since: i64) -> rusqlite::Result<Option<Vec<Thread>>> {
    let conn = open_read_only(db)?;
    let columns = columns(&conn, "threads")?;
    if !["id", "rollout_path", "updated_at"].iter().all(|name| columns.contains(*name)) {
        return Ok(None);
    }
    let updated = if columns.contains("updated_at_ms") {
        "COALESCE(updated_at_ms, updated_at * 1000)"
    } else {
        "updated_at * 1000"
    };
    let mut filters = vec![format!("{updated} >= ?1")];
    if columns.contains("archived") {
        filters.push("archived = 0".to_string());
    }
    if columns.contains("thread_source") {
        filters.push("COALESCE(thread_source, '') <> 'subagent'".to_string());
    }
    if columns.contains("source") {
        filters.push("source NOT LIKE '{\"subagent\"%'".to_string());
    }
    let sql = format!(
        "SELECT id, rollout_path, {updated}, {}, {}, {}, {}, {}, {} FROM threads WHERE {} ORDER BY {updated} DESC LIMIT 200",
        column(&columns, "cwd"),
        column(&columns, "name"),
        column(&columns, "first_user_message"),
        column(&columns, "model"),
        column(&columns, "reasoning_effort"),
        column(&columns, "originator"),
        filters.join(" AND "),
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([since], |row| {
        Ok(Thread {
            id: row.get(0)?,
            rollout: row.get::<_, Option<String>>(1)?.filter(|path| !path.is_empty()).map(PathBuf::from),
            updated_at: row.get(2)?,
            cwd: text(row.get(3)?),
            name: row.get::<_, Option<String>>(4)?.as_deref().and_then(display_title),
            first_prompt: row.get::<_, Option<String>>(5)?.as_deref().and_then(prompt_title),
            model: text(row.get(6)?),
            effort: text(row.get(7)?),
            originator: text(row.get(8)?),
        })
    })?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map(Some)
}

fn text(value: Option<String>) -> Option<String> {
    value.map(|value| value.trim().to_string()).filter(|value| !value.is_empty())
}

pub(super) fn read_history(db: &Path, thread_id: &str) -> rusqlite::Result<(SessionTail, TurnState)> {
    let mut tail = SessionTail::default();
    if !db.is_file() {
        return Ok((tail, TurnState::Done));
    }
    let conn = open_read_only(db)?;
    let items = columns(&conn, "thread_items")?;
    if ["thread_id", "item_type", "item_json", "rollout_ordinal"].iter().all(|name| items.contains(*name)) {
        let latest = |kind: &str| -> rusqlite::Result<Option<String>> {
            conn.query_row(
                "SELECT item_json FROM thread_items WHERE thread_id = ?1 AND item_type = ?2 ORDER BY rollout_ordinal DESC LIMIT 1",
                [thread_id, kind],
                |row| row.get(0),
            )
            .optional()
        };
        if let Some(reply) = latest("agentMessage")?.as_deref().and_then(agent_text) {
            tail.take_reply(&reply);
        }
        tail.last_prompt = latest("userMessage")?.as_deref().and_then(user_text);
    }
    let turns = columns(&conn, "thread_turns")?;
    let mut state = TurnState::Done;
    if ["thread_id", "status", "rollout_ordinal"].iter().all(|name| turns.contains(*name)) {
        let started = if turns.contains("started_at") { "started_at" } else { "NULL" };
        let turn: Option<(String, Option<i64>)> = conn
            .query_row(
                &format!("SELECT status, {started} FROM thread_turns WHERE thread_id = ?1 ORDER BY rollout_ordinal DESC LIMIT 1"),
                [thread_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        if let Some((status, started_at)) = turn {
            state = turn_state(&status);
            tail.turn_started_at = started_at.map(|at| if at < 10_000_000_000 { at * 1000 } else { at });
        }
    }
    Ok((tail, state))
}

pub(super) fn turn_state(status: &str) -> TurnState {
    match status {
        "inProgress" => TurnState::Working,
        "failed" => TurnState::Failed,
        _ => TurnState::Done,
    }
}

pub(super) fn agent_text(item_json: &str) -> Option<String> {
    let item: Value = serde_json::from_str(item_json).ok()?;
    item["text"].as_str().map(str::to_string).filter(|text| !text.trim().is_empty())
}

pub(super) fn user_text(item_json: &str) -> Option<String> {
    let item: Value = serde_json::from_str(item_json).ok()?;
    let text = item["content"]
        .as_array()?
        .iter()
        .filter_map(|part| part["text"].as_str())
        .collect::<Vec<_>>()
        .join("\n");
    prompt_title(&text)
}

#[cfg(test)]
#[path = "codex_threads_tests.rs"]
mod tests;
