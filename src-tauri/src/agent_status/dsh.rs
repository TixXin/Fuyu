use std::{
    collections::HashMap,
    ffi::{OsStr, OsString},
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
    time::SystemTime,
};

use serde_json::Value;

use super::harness::{Harness, Hooks, RemoteFiles, ScanRoots, StatusLight};
use super::markers::AGENT_RUNNING_STALE_AFTER_MS;
use super::session_scan::pick_title;
use super::reply_text::reply_ending;
use super::sessions::{session_phase, AgentSessionSummary, TurnState};
use super::snapshot::system_time_to_unix_millis;
use super::title::{display_title, folder_title, prompt_title};
use super::todo_list::{todo_items, unfinished};
use super::tool_call::ToolCall;
use super::window_focus::app_name;
use crate::platform;

pub(super) const PROVIDER: &str = "dsh";
const EXES: [&str; 6] = [
    "DeepSeek Harness.exe",
    "DSH Desktop.exe",
    "dsh-desktop.exe",
    "DSH Desktop Beta.exe",
    "DSH NEXT.exe",
    "dsh-desktop-next.exe",
];
const LOGS: [&str; 2] = ["session.v3.jsonl.zstd", "session.v4.jsonl.zstd"];
const MAX_CHECKPOINT_BYTES: u64 = 512 * 1024;
const MAX_CACHED: usize = 256;

type Parsed = Option<(AgentSessionSummary, TurnState)>;
type Stamp = (u64, Option<SystemTime>);
static CHECKPOINTS: Mutex<Option<HashMap<PathBuf, (Stamp, Parsed)>>> = Mutex::new(None);

const HOME_VARIABLES: [&str; 2] = ["DSH_HOME", "DSH_DESKTOP_NEXT_HOME"];
const CHOSEN_HOMES: [(&str, &str, &str); 5] = [
    ("DSH NEXT/home", "desktop-next-location.json", "home"),
    ("DSH NEXT/home", "desktop-next-last-home.json", "home"),
    ("DSH Desktop Beta/home", "desktop-next-location.json", "home"),
    ("DSH Desktop Beta/home", "desktop-next-last-home.json", "home"),
    ("DSH Desktop/data-directory", "state.json", "activeHome"),
];
const MAX_POINTER_BYTES: u64 = 64 * 1024;
const MIRRORED_HOMES: [&str; 3] = [".dsh", ".dsh-beta", ".dsh-home"];

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks {
        install: super::dsh_hooks::install_hooks,
        check: super::dsh_hooks::hooks_state,
        uninstall: super::dsh_hooks::uninstall_hooks,
    }),
    status_light: Some(StatusLight {
        running_marker: "agent-dsh-running.flag",
        running_hold: "agent-dsh-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: Some(read_sessions),
    remote: Some(RemoteFiles {
        find: &[
            "dshc() { find \"$1/storages/session_projcache/sessions\" -maxdepth 1 -type f -name '*.json' -mmin -\"$W\" 2>/dev/null | while IFS= read -r f; do i=${f##*/}; i=${i%.json}; for l in \"$1\"/sessions/*/\"$i\"/session.v[34].jsonl.zstd; do [ -f \"$l\" ] && { printf '%s\\t%s\\n' \"$f\" \"$2/storages/session_projcache/sessions/${f##*/}\"; break; }; done; done; }",
            "dshc .dsh .dsh",
            "dshc .dsh-beta .dsh-beta",
            "case \"$DSH_HOME\" in /*) [ \"$DSH_HOME\" = \"$HOME/.dsh\" ] || [ \"$DSH_HOME\" = \"$HOME/.dsh-beta\" ] || dshc \"$DSH_HOME\" .dsh-home ;; esac",
        ],
        session_dirs: &[],
        files: &[],
        checkpoint_dirs: &[
            ".dsh/storages/session_projcache/sessions/",
            ".dsh-beta/storages/session_projcache/sessions/",
            ".dsh-home/storages/session_projcache/sessions/",
        ],
    }),
};

fn read_sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    if roots.local_app_dir.is_some() {
        return sessions(roots.home_dir, now, window_ms);
    }
    let mirrored = MIRRORED_HOMES.iter().map(|home| roots.home_dir.join(home)).collect();
    sessions_in(mirrored, now, window_ms, false)
}

fn app_data(home_dir: &Path) -> PathBuf {
    if cfg!(windows) {
        home_dir.join("AppData").join("Roaming")
    } else if cfg!(target_os = "macos") {
        home_dir.join("Library").join("Application Support")
    } else {
        home_dir.join(".config")
    }
}

fn expand_home(value: &OsStr, home_dir: &Path) -> Option<PathBuf> {
    let text = value.to_string_lossy();
    let text = text.trim();
    let path = if text == "~" {
        home_dir.to_path_buf()
    } else if let Some(rest) = text.strip_prefix("~/").or_else(|| text.strip_prefix("~\\")) {
        home_dir.join(rest)
    } else {
        PathBuf::from(text)
    };
    (!text.is_empty() && path.is_absolute()).then_some(path)
}

fn chosen_home(app_data: &Path, (dir, file, key): (&str, &str, &str)) -> Option<PathBuf> {
    let path = dir.split('/').fold(app_data.to_path_buf(), |path, part| path.join(part)).join(file);
    let bytes = fs::read(&path).ok().filter(|bytes| bytes.len() as u64 <= MAX_POINTER_BYTES)?;
    let value = serde_json::from_slice::<Value>(&bytes).ok()?;
    let home = PathBuf::from(value[key].as_str()?);
    home.is_absolute().then_some(home)
}

fn roots(home_dir: &Path, var: impl Fn(&str) -> Option<OsString>) -> Vec<PathBuf> {
    let app_data = app_data(home_dir);
    let mut roots: Vec<PathBuf> = Vec::new();
    let candidates = HOME_VARIABLES
        .iter()
        .filter_map(|name| var(name).and_then(|value| expand_home(&value, home_dir)))
        .chain([
            home_dir.join(".dsh"),
            home_dir.join(".dsh-beta"),
            home_dir.join("AppData").join("Roaming").join("dsh-desktop").join("harness"),
            app_data.join("dshed").join("dsh"),
        ])
        .chain(CHOSEN_HOMES.into_iter().filter_map(|pointer| chosen_home(&app_data, pointer)));
    for root in candidates {
        if !roots.contains(&root) {
            roots.push(root);
        }
    }
    roots
}

pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
    homes(home_dir).into_iter().map(|home| home.join("AGENTS.md")).collect()
}

pub(super) fn homes(home_dir: &Path) -> Vec<PathBuf> {
    roots(home_dir, |name| std::env::var_os(name))
}

pub(super) fn sessions(home_dir: &Path, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    sessions_in(homes(home_dir), now, window_ms, true)
}

fn sessions_in(roots: Vec<PathBuf>, now: i64, window_ms: i64, check_logs: bool) -> Vec<AgentSessionSummary> {
    let mut newest: HashMap<String, (AgentSessionSummary, TurnState)> = HashMap::new();
    for root in roots {
        let dir = root.join("storages").join("session_projcache").join("sessions");
        for entry in fs::read_dir(dir).into_iter().flatten().flatten() {
            let path = entry.path();
            let Some(id) = path
                .file_stem()
                .and_then(|stem| stem.to_str())
                .filter(|_| path.extension().is_some_and(|extension| extension == "json"))
            else {
                continue;
            };
            let Some(at) = entry.metadata().ok().and_then(|meta| meta.modified().ok()).and_then(system_time_to_unix_millis)
            else {
                continue;
            };
            if now - at > window_ms || newest.get(id).is_some_and(|(known, _)| known.updated_at >= at) || (check_logs && !has_log(&root, id)) {
                continue;
            }
            if let Some(parsed) = checkpoint(&path, id, at) {
                newest.insert(id.to_string(), parsed);
            }
        }
    }
    newest
        .into_values()
        .map(|(mut summary, state)| {
            summary.phase = session_phase(state, now - summary.updated_at, AGENT_RUNNING_STALE_AFTER_MS);
            summary
        })
        .collect()
}

pub(super) fn running_app() -> Option<String> {
    platform::process::running_executable(&EXES).map(|exe| app_name(&exe))
}

fn has_log(root: &Path, id: &str) -> bool {
    fs::read_dir(root.join("sessions"))
        .into_iter()
        .flatten()
        .flatten()
        .any(|shard| LOGS.iter().any(|log| shard.path().join(id).join(log).is_file()))
}

fn checkpoint(path: &Path, id: &str, at: i64) -> Parsed {
    let meta = fs::metadata(path).ok()?;
    let stamp = (meta.len(), meta.modified().ok());
    let mut cache = CHECKPOINTS.lock().unwrap_or_else(PoisonError::into_inner);
    let cache = cache.get_or_insert_with(HashMap::new);
    if let Some((_, parsed)) = cache.get(path).filter(|(known, _)| *known == stamp) {
        return parsed.clone();
    }
    let parsed = (meta.len() <= MAX_CHECKPOINT_BYTES)
        .then(|| fs::read(path).ok())
        .flatten()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .and_then(|value| parse_checkpoint(&value, id, at));
    if cache.len() >= MAX_CACHED {
        cache.clear();
    }
    cache.insert(path.to_path_buf(), (stamp, parsed.clone()));
    parsed
}

fn row<'a>(rows: &'a Value, key: &str, versions: &[u64]) -> Option<&'a Value> {
    let row = &rows[key];
    row["ver"].as_u64().is_some_and(|version| versions.contains(&version)).then_some(&row["val"])
}

fn text(value: &Value) -> Option<String> {
    value.as_str().filter(|text| !text.trim().is_empty()).map(|text| text.trim().to_string())
}

fn parse_checkpoint(value: &Value, id: &str, at: i64) -> Parsed {
    if !matches!(value["version"].as_u64(), Some(3..=7)) {
        return None;
    }
    let record = &value["record"];
    if !matches!(record["identity"]["formatVersion"].as_u64(), Some(3 | 4)) {
        return None;
    }
    let rows = &record["rows"];
    let metadata = row(rows, "sessionListMetadata", &[1])?;
    if metadata["blank"].as_bool() != Some(false) {
        return None;
    }
    let in_turn = row(rows, "turnBoundary", &[2])?["openTurnStartSeq"].as_u64().is_some();
    let asking = row(rows, "userQuestions", &[2])
        .and_then(|questions| questions["questions"]["active"].as_array())
        .is_some_and(|active| active.iter().any(|question| question["state"] == "open"));
    let state = if asking {
        TurnState::AwaitingUser
    } else if in_turn {
        TurnState::Working
    } else {
        TurnState::Done
    };
    let cwd = text(&record["identity"]["cwd"]);
    let turn = row(rows, "turnOutline", &[2]).and_then(|outline| outline["turns"].as_array()?.last());
    let first_prompt = row(rows, "titleInput", &[1]).and_then(|input| input["first"]["text"].as_str()).and_then(prompt_title);
    let agent_title = row(rows, "title", &[1]).and_then(Value::as_str).and_then(display_title);
    let (title, title_source) = pick_title(None, agent_title, first_prompt, cwd.as_deref().and_then(folder_title));
    let model = row(rows, "modelSelection", &[2, 3]).map(|selection| &selection["lastUsed"]);
    let reply = turn.and_then(|turn| turn["response"].as_str()).map(reply_ending).unwrap_or_default();
    let summary = AgentSessionSummary {
        provider: PROVIDER,
        session_id: id.to_string(),
        cwd,
        title,
        title_source,
        model: model.and_then(|model| text(&model["model"])),
        effort: model.and_then(|model| text(&model["reasoningEffort"])),
        phase: "completed",
        last_message: reply.message,
        reply_marker: reply.marker,
        reply_asks: reply.asks,
        updated_at: at,
        host: None,
        turn_started_at: metadata["lastPromptAt"].as_i64(),
        last_prompt: turn.and_then(|turn| turn["prompt"].as_str()).and_then(prompt_title),
        current_tool: in_turn.then(|| current_tool(rows)).flatten(),
        permission_mode: permission_mode(rows),
        subagents: 0,
        background_tasks: 0,
        compacting: false,
        todos: row(rows, "todos", &[2]).and_then(|todos| unfinished(todo_items(todos))),
        closed: false,
        remote_host: None,
        parent_id: None,
        context_tokens: row(rows, "contextPressure", &[4, 5]).and_then(|pressure| pressure["surfaceTokens"].as_u64()),
    };
    Some((summary, state))
}

fn current_tool(rows: &Value) -> Option<ToolCall> {
    let calls = rows["contextTimeline"]["val"]["callNames"].as_object()?;
    let (_, call) = calls.iter().filter(|(_, call)| call["name"].is_string()).max_by_key(|(_, call)| call["start"].as_i64())?;
    Some(ToolCall { name: text(&call["name"])?, detail: None })
}

fn permission_mode(rows: &Value) -> Option<&'static str> {
    if row(rows, "plan", &[3, 4]).is_some_and(|plan| plan["active"] == true) {
        return Some("plan");
    }
    let permissions = row(rows, "permissions", &[2]).filter(|permissions| permissions.is_object());
    let preset = permissions.and_then(|permissions| permissions["preset"].as_str());
    let sandbox = permissions
        .and_then(|permissions| permissions["sandbox"].as_str())
        .or_else(|| row(rows, "sandboxMode", &[1]).and_then(Value::as_str));
    let approval = permissions
        .and_then(|permissions| permissions["approval"].as_str())
        .or_else(|| row(rows, "approvalState", &[1]).and_then(|state| state["policy"].as_str()));
    if preset.is_none() && sandbox.is_none() && approval.is_none() {
        return None;
    }
    Some(match (preset, sandbox, approval) {
        (Some("auto"), _, _) => "auto",
        (Some("danger-full-access"), _, _) | (_, Some("danger-full-access"), Some("never")) => "bypass",
        (_, _, Some("never")) => "auto",
        _ => "default",
    })
}

#[cfg(test)]
#[path = "dsh_tests.rs"]
mod tests;
