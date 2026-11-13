use std::{
    collections::{HashMap, HashSet},
    fs::{self, File},
    io::{BufRead, BufReader, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
    time::SystemTime,
};

use super::markers::AGENT_RUNNING_STALE_AFTER_MS;
use super::notifications::{compacting_sessions, is_waiting, SavedNotifications, WaitingNotifications};
use super::session_host::codex_host;
use super::session_process::running_sessions_in;
use super::session_records;
use super::sessions::{
    codex_originator, codex_user_prompt, parse_claude_tail, parse_codex_meta, parse_codex_tail, record_cwd,
    session_phase, AgentSessionSummary, SessionTail, TurnState,
};
use super::snapshot::{current_unix_millis, system_time_to_unix_millis};
use super::title::{codex_thread_name, folder_title, user_prompt_in_record};
use super::{antigravity, workbuddy};

pub(super) const ACTIVE_WINDOW_MS: i64 = 2 * 60 * 60 * 1000;
const MAX_SESSIONS: usize = 12;
const REGISTRY_GRACE_MS: i64 = 30_000;
const TAIL_BYTES: u64 = 256 * 1024;
const HEAD_BYTES: u64 = 4 * 1024 * 1024;

static SESSION_CACHE: Mutex<SessionCache> = Mutex::new(SessionCache::new());

pub(super) fn list_sessions(
    home_dir: &Path,
    app_dir: Option<&Path>,
    waiting: &WaitingNotifications,
    window_ms: i64,
) -> Vec<AgentSessionSummary> {
    let compacting = app_dir.map(|dir| compacting_sessions(dir, current_unix_millis())).unwrap_or_default();
    scan(home_dir, app_dir, waiting, &compacting, window_ms, None)
}

pub(super) fn list_mirrored_sessions(
    home_dir: &Path,
    saved: &SavedNotifications,
    window_ms: i64,
    registry: Option<HashSet<String>>,
) -> Vec<AgentSessionSummary> {
    scan(home_dir, None, &saved.waiting, &saved.compacting, window_ms, registry)
}

fn scan(
    home_dir: &Path,
    app_dir: Option<&Path>,
    waiting: &WaitingNotifications,
    compacting: &HashMap<String, i64>,
    window_ms: i64,
    registry: Option<HashSet<String>>,
) -> Vec<AgentSessionSummary> {
    let now = current_unix_millis();
    let mut cache = SESSION_CACHE.lock().unwrap_or_else(PoisonError::into_inner);
    let mut sessions = Vec::new();

    let codex_index = read_tail(&home_dir.join(".codex").join("session_index.jsonl"));
    let mut live_claude = registry;
    let mut live_workbuddy = None;
    let mut workbuddy_running = None;
    for (provider, path, modified) in recent_session_files(home_dir, now, window_ms) {
        if let Some((mut summary, state)) =
            cache.summary(provider, &path, modified, codex_index.as_deref())
        {
            let asked_user = is_waiting(waiting, &summary.session_id, summary.updated_at);
            let mid_turn = matches!(state, TurnState::Working | TurnState::AwaitingUser);
            summary.closed = has_ended(app_dir, &summary.session_id).unwrap_or_else(|| match summary.provider {
                "claudeCode" => left_registry(&home_dir.join(".claude"), &summary, now, &mut live_claude),
                workbuddy::PROVIDER => {
                    left_registry(&home_dir.join(workbuddy::DIR), &summary, now, &mut live_workbuddy)
                        && !*workbuddy_running.get_or_insert_with(workbuddy::app_running)
                }
                _ => false,
            });
            let ended = mid_turn && summary.closed;
            summary.compacting = compacting.contains_key(&summary.session_id) && !ended;
            summary.phase = if ended {
                "completed"
            } else if summary.compacting {
                "running"
            } else if state == TurnState::Working && asked_user {
                "waiting"
            } else {
                session_phase(
                    state,
                    now - summary.updated_at,
                    AGENT_RUNNING_STALE_AFTER_MS,
                )
            };
            sessions.push(summary);
        }
    }
    cache.forget_missing(home_dir, &sessions);
    if let Some(app_dir) = app_dir {
        sessions.extend(antigravity::sessions(app_dir, now, window_ms));
    }

    let is_active = |phase: &str| matches!(phase, "running" | "waiting");
    sessions.sort_by_key(|session| (!is_active(session.phase), -session.updated_at));
    sessions.truncate(MAX_SESSIONS);
    sessions
}

fn has_ended(app_dir: Option<&Path>, session_id: &str) -> Option<bool> {
    let record = app_dir.and_then(|dir| session_records::read(dir, session_id))?;
    if record.has_ended() {
        return Some(true);
    }
    record.live_pid().map(|_| false)
}

fn left_registry(
    agent_dir: &Path,
    summary: &AgentSessionSummary,
    now: i64,
    live: &mut Option<HashSet<String>>,
) -> bool {
    let registry = agent_dir.join("sessions");
    now - summary.updated_at > REGISTRY_GRACE_MS
        && (live.is_some() || registry.is_dir())
        && !live
            .get_or_insert_with(|| running_sessions_in(&registry).into_keys().collect())
            .contains(&summary.session_id)
}

type SessionFile = (&'static str, PathBuf, i64);

fn recent_session_files(home_dir: &Path, now: i64, window_ms: i64) -> Vec<SessionFile> {
    let mut files = Vec::new();
    let mut push_recent = |provider: &'static str, path: PathBuf| {
        let modified = fs::metadata(&path)
            .ok()
            .filter(|metadata| metadata.is_file())
            .and_then(|metadata| metadata.modified().ok())
            .and_then(system_time_to_unix_millis);
        if let Some(modified) = modified.filter(|modified| now - modified <= window_ms) {
            files.push((provider, path, modified));
        }
    };

    for project in read_dir_paths(&home_dir.join(".claude").join("projects")) {
        for path in read_dir_paths(&project) {
            if path
                .extension()
                .is_some_and(|extension| extension == "jsonl")
            {
                push_recent("claudeCode", path);
            }
        }
    }

    for project in read_dir_paths(&home_dir.join(workbuddy::DIR).join("projects")) {
        for path in read_dir_paths(&project) {
            if path.extension().is_some_and(|extension| extension == "jsonl") {
                push_recent(workbuddy::PROVIDER, path);
            }
        }
    }

    let mut days = Vec::new();
    for year in read_dir_paths(&home_dir.join(".codex").join("sessions")) {
        for month in read_dir_paths(&year) {
            days.extend(read_dir_paths(&month));
        }
    }
    days.sort();
    for day in days.iter().rev().take(2) {
        for path in read_dir_paths(day) {
            if path
                .extension()
                .is_some_and(|extension| extension == "jsonl")
            {
                push_recent("codex", path);
            }
        }
    }
    files
}

fn read_dir_paths(dir: &Path) -> Vec<PathBuf> {
    fs::read_dir(dir)
        .map(|entries| entries.flatten().map(|entry| entry.path()).collect())
        .unwrap_or_default()
}

struct CachedSession {
    stamp: (u64, Option<SystemTime>),
    summary: AgentSessionSummary,
    state: TurnState,
    head: SessionHead,
}

#[derive(Clone, Default)]
struct SessionHead {
    first_prompt: Option<String>,
    first_cwd: Option<String>,
}

struct SessionCache {
    sessions: Option<HashMap<PathBuf, CachedSession>>,
}

impl SessionCache {
    const fn new() -> Self {
        Self { sessions: None }
    }

    fn summary(
        &mut self,
        provider: &'static str,
        path: &Path,
        modified: i64,
        codex_index: Option<&str>,
    ) -> Option<(AgentSessionSummary, TurnState)> {
        let metadata = fs::metadata(path).ok()?;
        let stamp = (metadata.len(), metadata.modified().ok());
        let sessions = self.sessions.get_or_insert_with(HashMap::new);
        if let Some(cached) = sessions.get(path).filter(|cached| cached.stamp == stamp) {
            let mut summary = cached.summary.clone();
            if provider == "codex" {
                if let Some(name) =
                    codex_index.and_then(|index| codex_thread_name(index, &summary.session_id))
                {
                    summary.title = Some(name);
                    summary.title_source = Some(TITLE_FROM_AGENT);
                }
            }
            return Some((summary, cached.state));
        }

        let known_turn_start = sessions.get(path).and_then(|cached| cached.summary.turn_started_at);
        let known_prompt = sessions.get(path).and_then(|cached| cached.summary.last_prompt.clone());
        let known_mode = sessions.get(path).and_then(|cached| cached.summary.permission_mode);
        let known_rename = sessions
            .get(path)
            .filter(|cached| cached.summary.title_source == Some(TITLE_FROM_RENAME))
            .and_then(|cached| cached.summary.title.clone());
        let known_head = sessions
            .get(path)
            .map(|cached| cached.head.clone())
            .filter(|head| head.first_prompt.is_some());
        let tail = read_tail(path)?;
        let mut host = None;
        let (mut parsed, session_id, cwd) = if provider == "codex" {
            let first_line = read_first_line(path)?;
            let (id, cwd) = parse_codex_meta(&first_line)?;
            host = codex_originator(&first_line).map(|origin| codex_host(&origin));
            (parse_codex_tail(&tail), id, cwd)
        } else {
            let parsed = if provider == workbuddy::PROVIDER {
                workbuddy::parse_tail(&tail)
            } else {
                parse_claude_tail(&tail)
            };
            let id = parsed.session_id.clone().or_else(|| {
                path.file_stem()
                    .map(|stem| stem.to_string_lossy().to_string())
            })?;
            (parsed, id, None)
        };
        let head = known_head.unwrap_or_else(|| scan_head(path, provider));
        let cwd = cwd
            .or_else(|| head.first_cwd.clone())
            .or_else(|| parsed.cwd.take());
        let agent_title = match provider {
            "codex" => codex_index.and_then(|index| codex_thread_name(index, &session_id)),
            _ => parsed.title.take(),
        };
        let (title, title_source) = pick_title(
            parsed.custom_title.take().or(known_rename),
            agent_title,
            head.first_prompt.clone(),
            cwd.as_deref().and_then(folder_title),
        );

        let state = parsed.state;
        let turn_started_at = parsed.turn_started_at.or(known_turn_start);
        let mut summary = summary_from(provider, session_id, cwd, title, parsed, modified);
        summary.title_source = title_source;
        summary.turn_started_at = turn_started_at;
        summary.last_prompt = summary.last_prompt.take().or(known_prompt);
        summary.permission_mode = summary.permission_mode.or(known_mode);
        summary.host = host;
        sessions.insert(
            path.to_path_buf(),
            CachedSession {
                stamp,
                summary: summary.clone(),
                state,
                head,
            },
        );
        Some((summary, state))
    }

    fn forget_missing(&mut self, home_dir: &Path, listed: &[AgentSessionSummary]) {
        if let Some(sessions) = &mut self.sessions {
            sessions.retain(|path, cached| {
                !path.starts_with(home_dir)
                    || listed
                        .iter()
                        .any(|session| session.session_id == cached.summary.session_id)
            });
        }
    }
}

pub(super) const TITLE_FROM_RENAME: &str = "rename";
pub(super) const TITLE_FROM_AGENT: &str = "agent";

pub(super) fn pick_title(
    renamed: Option<String>,
    agent: Option<String>,
    first_prompt: Option<String>,
    folder: Option<String>,
) -> (Option<String>, Option<&'static str>) {
    [
        (renamed, TITLE_FROM_RENAME),
        (agent, TITLE_FROM_AGENT),
        (first_prompt, "prompt"),
        (folder, "folder"),
    ]
    .into_iter()
    .find_map(|(title, source)| title.map(|title| (Some(title), Some(source))))
    .unwrap_or((None, None))
}

fn summary_from(
    provider: &'static str,
    session_id: String,
    cwd: Option<String>,
    title: Option<String>,
    parsed: SessionTail,
    updated_at: i64,
) -> AgentSessionSummary {
    AgentSessionSummary {
        provider,
        session_id,
        cwd,
        title,
        title_source: None,
        model: parsed.model,
        effort: parsed.effort,
        phase: "completed",
        last_message: parsed.last_message,
        reply_marker: parsed.reply_marker,
        reply_asks: parsed.reply_asks,
        updated_at,
        host: None,
        turn_started_at: None,
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
    }
}

fn scan_head(path: &Path, provider: &str) -> SessionHead {
    let mut head = SessionHead::default();
    let Ok(file) = File::open(path) else {
        return head;
    };
    let is_codex = provider == "codex";
    let prompt_in_line = match provider {
        "codex" => codex_user_prompt,
        workbuddy::PROVIDER => workbuddy::user_query,
        _ => user_prompt_in_record,
    };
    for line in BufReader::new(file.take(HEAD_BYTES))
        .split(b'\n')
        .map_while(Result::ok)
    {
        let line = String::from_utf8_lossy(&line);
        if head.first_cwd.is_none() && !is_codex {
            head.first_cwd = record_cwd(&line);
        }
        if head.first_prompt.is_none() {
            head.first_prompt = prompt_in_line(&line);
        }
        if head.first_prompt.is_some() && (is_codex || head.first_cwd.is_some()) {
            break;
        }
    }
    head
}

fn read_first_line(path: &Path) -> Option<String> {
    let file = File::open(path).ok()?;
    let mut line = Vec::new();
    BufReader::new(file.take(HEAD_BYTES))
        .read_until(b'\n', &mut line)
        .ok()?;
    Some(String::from_utf8_lossy(&line).into_owned())
}

pub(super) fn read_tail(path: &Path) -> Option<String> {
    let mut file = File::open(path).ok()?;
    let len = file.metadata().ok()?.len();
    let start = len.saturating_sub(TAIL_BYTES);
    file.seek(SeekFrom::Start(start)).ok()?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).ok()?;
    if start > 0 {
        let first_newline = bytes.iter().position(|&byte| byte == b'\n')?;
        bytes.drain(..=first_newline);
    }
    Some(String::from_utf8_lossy(&bytes).into_owned())
}
