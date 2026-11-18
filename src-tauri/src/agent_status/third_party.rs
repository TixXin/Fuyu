use std::{
    collections::{BTreeMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::external::{self, ExternalAgentStatus};
use super::harness::{ScanRoots, HARNESSES};
use super::markers::{active_agent_running_marker_status, file_modified_unix_millis, remove_agent_marker_files};
use super::pi;
use super::session_scan::pick_title;
use super::sessions::{AgentSessionSummary, TurnState};
use super::snapshot::{normalize_agent_task_status, AgentStatusSnapshot, AgentTaskStatus};
use super::title::{display_title, folder_title};
use super::AGENT_STATUS_FILE_NAME;

pub(super) const PROVIDERS_FILE_NAME: &str = "agent-providers.json";
pub(super) const THIRD_PARTY_DIR_NAME: &str = "agent-third-party";
const MAX_CUSTOM_PROVIDERS: usize = 64;

static INTERNED_PROVIDERS: Mutex<Option<HashSet<&'static str>>> = Mutex::new(None);

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ThirdPartyAgentStatus {
    #[serde(default = "super::snapshot::default_agent_phase")]
    pub(super) phase: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) task_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) cwd: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) sessions_dir: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) transcript_dir: Option<String>,
    #[serde(default)]
    pub(super) updated_at: i64,
}

impl ThirdPartyAgentStatus {
    fn configured_dir(&self) -> Option<&str> {
        self.sessions_dir
            .as_deref()
            .or(self.transcript_dir.as_deref())
            .map(str::trim)
            .filter(|dir| !dir.is_empty())
    }

    pub(super) fn to_external(&self, id: &str, fallback_updated_at: i64) -> ExternalAgentStatus {
        let task = normalize_agent_task_status(AgentTaskStatus {
            phase: self.phase.clone(),
            task_id: self.task_id.clone(),
            updated_at: if self.updated_at > 0 { self.updated_at } else { fallback_updated_at },
        });
        let name = self
            .name
            .as_deref()
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .unwrap_or(id);
        external::file_status(
            id.to_string(),
            name.to_string(),
            task.phase,
            task.task_id,
            self.title.clone(),
            self.cwd.clone(),
            task.updated_at,
        )
    }
}

pub(super) fn is_third_party_id(id: &str) -> bool {
    (1..=32).contains(&id.len())
        && id.as_bytes()[0].is_ascii_alphabetic()
        && id.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
        && !matches!(id, "updatedAt" | "statusPath" | "others")
        && !HARNESSES.iter().any(|harness| harness.id.eq_ignore_ascii_case(id))
}

pub(super) fn intern_provider(id: &str) -> &'static str {
    if let Some(known) = HARNESSES.iter().find(|harness| harness.id == id) {
        return known.id;
    }
    let mut guard = INTERNED_PROVIDERS.lock().unwrap_or_else(PoisonError::into_inner);
    let set = guard.get_or_insert_with(HashSet::new);
    if let Some(&existing) = set.get(id) {
        return existing;
    }
    if set.len() >= MAX_CUSTOM_PROVIDERS {
        return "thirdParty";
    }
    let leaked: &'static str = Box::leak(id.to_string().into_boxed_str());
    set.insert(leaked);
    leaked
}

pub(super) fn marker_names(id: &str) -> (String, String) {
    (format!("agent-{id}-running.flag"), format!("agent-{id}-running-hold.flag"))
}

pub(super) fn clear_markers(app_dir: &Path, id: &str) {
    let (running, hold) = marker_names(id);
    remove_agent_marker_files(app_dir, &running, &hold, &[]);
}

pub(super) fn apply_running_markers(app_dir: &Path, snapshot: &mut AgentStatusSnapshot, now: i64) {
    let mut ids: BTreeMap<String, usize> = snapshot
        .others
        .iter()
        .enumerate()
        .filter(|(_, item)| is_third_party_id(&item.id))
        .map(|(index, item)| (item.id.clone(), index))
        .collect();

    if let Ok(entries) = fs::read_dir(app_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            let id = name
                .strip_prefix("agent-")
                .and_then(|rest| rest.strip_suffix("-running.flag").or_else(|| rest.strip_suffix("-running-hold.flag")));
            if let Some(id) = id.filter(|id| is_third_party_id(id)) {
                ids.entry(id.to_string()).or_insert(usize::MAX);
            }
        }
    }

    for (id, index) in ids {
        let (running_name, hold_name) = marker_names(&id);
        let current = if index < snapshot.others.len() {
            AgentTaskStatus {
                phase: snapshot.others[index].phase.clone(),
                task_id: None,
                updated_at: snapshot.others[index].updated_at,
            }
        } else {
            AgentTaskStatus::default()
        };
        if let Some(marker) = active_agent_running_marker_status(app_dir, &current, &running_name, &hold_name, now) {
            if index < snapshot.others.len() {
                snapshot.others[index].phase = marker.phase;
                snapshot.others[index].updated_at = marker.updated_at;
            } else {
                snapshot.others.push(external::file_status(
                    id.clone(),
                    id,
                    marker.phase,
                    marker.task_id,
                    None,
                    None,
                    marker.updated_at,
                ));
            }
        }
    }
}

pub(super) fn sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    let Some(app_dir) = roots.local_app_dir else {
        return Vec::new();
    };
    let mut dirs: Vec<(String, PathBuf)> = Vec::new();
    let mut seen: HashSet<(String, PathBuf)> = HashSet::new();
    let mut push_dir = |id: String, dir: PathBuf| {
        if is_third_party_id(&id) && dir.is_absolute() && seen.insert((id.clone(), dir.clone())) {
            dirs.push((id, dir));
        }
    };

    let drop_in = app_dir.join(THIRD_PARTY_DIR_NAME);
    if let Ok(entries) = fs::read_dir(&drop_in) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let id = entry.file_name().to_string_lossy().into_owned();
                push_dir(id, path);
            }
        }
    }

    for config_path in [app_dir.join(PROVIDERS_FILE_NAME), drop_in.join("config.json")] {
        for (id, raw_dir) in read_providers_config(&config_path) {
            if let Some(resolved) = resolve_dir(roots.home_dir, &raw_dir) {
                push_dir(id, resolved);
            }
        }
    }

    if let Ok(text) = fs::read_to_string(app_dir.join(AGENT_STATUS_FILE_NAME)) {
        if let Ok(Value::Object(map)) = serde_json::from_str::<Value>(&text) {
            for (id, value) in map {
                if !is_third_party_id(&id) {
                    continue;
                }
                if let Ok(status) = serde_json::from_value::<ThirdPartyAgentStatus>(value) {
                    if let Some(dir) = status.configured_dir().and_then(|raw| resolve_dir(roots.home_dir, raw)) {
                        push_dir(id, dir);
                    }
                }
            }
        }
    }

    let mut out = Vec::new();
    for (id, dir) in dirs {
        let provider = intern_provider(&id);
        out.extend(pi::sessions_in_dir(provider, &dir, Some(app_dir), now, window_ms));
        out.extend(json_sessions_in_dir(provider, &dir, now, window_ms));
    }
    out
}

fn resolve_dir(home_dir: &Path, raw: &str) -> Option<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Some(rest) = trimmed.strip_prefix("~/").or_else(|| trimmed.strip_prefix(r"~\")) {
        return Some(home_dir.join(rest));
    }
    let path = PathBuf::from(trimmed);
    path.is_absolute().then_some(path)
}

fn read_providers_config(path: &Path) -> Vec<(String, String)> {
    let Ok(text) = fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(&text) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    let dir_of = |item: &Value| {
        item["sessionsDir"]
            .as_str()
            .or_else(|| item["transcriptDir"].as_str())
            .map(str::to_string)
    };
    match &value {
        Value::Array(items) => {
            for item in items {
                if let (Some(id), Some(dir)) = (item["id"].as_str().or_else(|| item["provider"].as_str()), dir_of(item)) {
                    out.push((id.to_string(), dir));
                }
            }
        }
        Value::Object(map) => {
            for (key, item) in map {
                if key == "providers" {
                    if let Some(items) = item.as_array() {
                        for entry in items {
                            if let (Some(id), Some(dir)) = (entry["id"].as_str().or_else(|| entry["provider"].as_str()), dir_of(entry)) {
                                out.push((id.to_string(), dir));
                            }
                        }
                    }
                } else if let Some(dir) = dir_of(item).or_else(|| item.as_str().map(str::to_string)) {
                    out.push((key.clone(), dir));
                }
            }
        }
        _ => {}
    }
    out
}

fn json_sessions_in_dir(provider: &'static str, dir: &Path, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path.extension().is_some_and(|ext| ext == "json")
                && !path.file_name().is_some_and(|name| {
                    let name = name.to_string_lossy();
                    name == "config.json" || name.ends_with(".settings.json")
                })
        })
        .filter_map(|path| read_json_session(provider, &path, now, window_ms))
        .collect()
}

fn read_json_session(provider: &'static str, path: &Path, now: i64, window_ms: i64) -> Option<AgentSessionSummary> {
    let updated_at = file_modified_unix_millis(path)?;
    if now - updated_at > window_ms {
        return None;
    }
    let text = fs::read_to_string(path).ok()?;
    let record: Value = serde_json::from_str(&text).ok()?;
    let str_field = |key: &str| record[key].as_str().map(str::trim).filter(|s| !s.is_empty()).map(str::to_string);
    let session_id = str_field("sessionId")
        .or_else(|| str_field("session_id"))
        .or_else(|| str_field("id"))
        .or_else(|| path.file_stem().map(|s| s.to_string_lossy().into_owned()))?;
    let cwd = str_field("cwd");
    let first_prompt = str_field("lastPrompt").or_else(|| str_field("prompt"));
    let named = str_field("title").as_deref().and_then(display_title);
    let (title, title_source) = pick_title(None, named, first_prompt.clone(), cwd.as_deref().and_then(folder_title));
    let phase = match record["phase"].as_str().or_else(|| record["status"].as_str()).unwrap_or("completed") {
        "running" | "working" => "running",
        "waiting" => "waiting",
        "failed" | "error" => "failed",
        "stale" => "stale",
        _ => "completed",
    };
    let closed = record["closed"].as_bool().unwrap_or(false);
    let state = match phase {
        "running" => TurnState::Working,
        "waiting" => TurnState::AwaitingUser,
        "failed" => TurnState::Failed,
        _ => TurnState::Done,
    };
    let _ = state;
    Some(AgentSessionSummary {
        provider,
        session_id,
        cwd,
        title,
        title_source,
        model: str_field("model"),
        effort: str_field("effort").or_else(|| str_field("thinkingLevel")),
        phase: if closed && matches!(phase, "running" | "waiting") { "completed" } else { phase },
        last_message: str_field("lastMessage").or_else(|| str_field("message")),
        reply_marker: None,
        reply_asks: false,
        updated_at: record["updatedAt"].as_i64().filter(|&t| t > 0).unwrap_or(updated_at),
        host: None,
        turn_started_at: record["turnStartedAt"].as_i64(),
        last_prompt: first_prompt,
        current_tool: None,
        permission_mode: None,
        subagents: 0,
        background_tasks: 0,
        compacting: false,
        todos: None,
        closed,
        remote_host: None,
        context_tokens: record["contextTokens"].as_u64(),
        parent_id: None,
    })
}

#[cfg(test)]
#[path = "third_party_tests.rs"]
mod tests;
