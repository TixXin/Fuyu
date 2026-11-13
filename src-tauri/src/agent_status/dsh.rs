use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
    time::SystemTime,
};

use serde_json::Value;

use super::markers::AGENT_RUNNING_STALE_AFTER_MS;
use super::session_scan::pick_title;
use super::sessions::{session_phase, AgentSessionSummary, TurnState, LAST_MESSAGE_MAX_CHARS};
use super::snapshot::system_time_to_unix_millis;
use super::title::{display_title, folder_title, prompt_title, shorten};
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

fn roots(home_dir: &Path) -> [PathBuf; 3] {
    [
        home_dir.join(".dsh"),
        home_dir.join(".dsh-beta"),
        home_dir.join("AppData").join("Roaming").join("dsh-desktop").join("harness"),
    ]
}

pub(super) fn sessions(home_dir: &Path, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    let mut newest: HashMap<String, (AgentSessionSummary, TurnState)> = HashMap::new();
    for root in roots(home_dir) {
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
            if now - at > window_ms || newest.get(id).is_some_and(|(known, _)| known.updated_at >= at) || !has_log(&root, id) {
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
    let model = row(rows, "modelSelection", &[2]).map(|selection| &selection["lastUsed"]);
    let summary = AgentSessionSummary {
        provider: PROVIDER,
        session_id: id.to_string(),
        cwd,
        title,
        title_source,
        model: model.and_then(|model| text(&model["model"])),
        effort: model.and_then(|model| text(&model["reasoningEffort"])),
        phase: "completed",
        last_message: turn.and_then(|turn| turn["response"].as_str()).and_then(|reply| shorten(reply, LAST_MESSAGE_MAX_CHARS)),
        reply_marker: None,
        reply_asks: false,
        updated_at: at,
        host: None,
        turn_started_at: metadata["lastPromptAt"].as_i64(),
        last_prompt: turn.and_then(|turn| turn["prompt"].as_str()).and_then(prompt_title),
        current_tool: None,
        permission_mode: None,
        subagents: 0,
        background_tasks: 0,
        compacting: false,
        todos: None,
        closed: false,
        remote_host: None,
        context_tokens: row(rows, "contextPressure", &[4, 5]).and_then(|pressure| pressure["surfaceTokens"].as_u64()),
    };
    Some((summary, state))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const ID: &str = "session-7f3c2a10-5b8e-4d21-9c6f-0a1b2c3d4e5f";

    fn fixture() -> Value {
        json!({"version": 7, "record": {
            "identity": {"formatVersion": 4, "cwd": "D:\\work\\demo"},
            "rows": {
                "title": {"ver": 1, "val": "Fix the login page"},
                "sessionListMetadata": {"ver": 1, "val": {"blank": false, "lastPromptAt": 1000}},
                "turnBoundary": {"ver": 2, "val": {"openTurnStartSeq": 5}},
                "turnOutline": {"ver": 2, "val": {"turns": [{"prompt": "why does it fail", "response": "Looking at it."}]}},
                "modelSelection": {"ver": 2, "val": {"lastUsed": {"model": "deepseek-v4", "reasoningEffort": "high"}}},
                "userQuestions": {"ver": 2, "val": {"questions": {"active": []}}},
                "contextPressure": {"ver": 5, "val": {"surfaceTokens": 4200}}
            }
        }})
    }

    fn state(value: &Value) -> Option<TurnState> {
        parse_checkpoint(value, ID, 1100).map(|(_, state)| state)
    }

    #[test]
    fn reads_a_known_checkpoint() {
        let (summary, state) = parse_checkpoint(&fixture(), ID, 1100).unwrap();
        assert_eq!(state, TurnState::Working);
        assert_eq!(summary.provider, PROVIDER);
        assert_eq!(summary.title.as_deref(), Some("Fix the login page"));
        assert_eq!(summary.cwd.as_deref(), Some(r"D:\work\demo"));
        assert_eq!(summary.model.as_deref(), Some("deepseek-v4"));
        assert_eq!(summary.effort.as_deref(), Some("high"));
        assert_eq!(summary.last_prompt.as_deref(), Some("why does it fail"));
        assert_eq!(summary.last_message.as_deref(), Some("Looking at it."));
        assert_eq!(summary.turn_started_at, Some(1000));
        assert_eq!(summary.context_tokens, Some(4200));
    }

    #[test]
    fn open_questions_wait_closed_turns_finish_and_unknown_versions_are_skipped() {
        let mut value = fixture();
        value["record"]["rows"]["userQuestions"]["val"]["questions"]["active"] = json!([{"state": "open"}]);
        assert_eq!(state(&value), Some(TurnState::AwaitingUser));
        value["record"]["rows"]["userQuestions"]["val"]["questions"]["active"][0]["state"] = json!("continued");
        assert_eq!(state(&value), Some(TurnState::Working));
        value["record"]["rows"]["turnBoundary"]["val"]["openTurnStartSeq"] = Value::Null;
        assert_eq!(state(&value), Some(TurnState::Done));
        value["record"]["rows"]["sessionListMetadata"]["val"]["blank"] = json!(true);
        assert_eq!(state(&value), None);
        let mut value = fixture();
        value["version"] = json!(99);
        assert_eq!(state(&value), None);
        let mut value = fixture();
        value["record"]["rows"]["turnBoundary"]["ver"] = json!(3);
        assert_eq!(state(&value), None);
    }

    #[test]
    fn lists_logged_sessions_once_from_the_newest_store() {
        let home = std::env::temp_dir().join(format!("fuyu-dsh-{}", std::process::id()));
        let _ = fs::remove_dir_all(&home);
        let write = |root: &Path, id: &str, title: &str, log: bool| {
            let dir = root.join("storages/session_projcache/sessions");
            fs::create_dir_all(&dir).unwrap();
            let mut value = fixture();
            value["record"]["rows"]["title"]["val"] = json!(title);
            fs::write(dir.join(format!("{id}.json")), value.to_string()).unwrap();
            if log {
                let session = root.join("sessions/--D-work-demo--").join(id);
                fs::create_dir_all(&session).unwrap();
                fs::write(session.join(LOGS[1]), b"").unwrap();
            }
        };
        let [shared, _, isolated] = roots(&home);
        write(&shared, ID, "old", true);
        std::thread::sleep(std::time::Duration::from_millis(20));
        write(&isolated, ID, "new", true);
        write(&shared, "session-deleted", "gone", false);
        let now = system_time_to_unix_millis(SystemTime::now()).unwrap();
        let listed = sessions(&home, now, 60_000);
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].title.as_deref(), Some("new"));
        assert_eq!(listed[0].phase, "running");
        fs::remove_dir_all(&home).unwrap();
    }
}
