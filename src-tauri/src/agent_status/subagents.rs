use std::{
    collections::HashMap,
    fs::{self, File},
    io::{BufRead, BufReader, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
    time::SystemTime,
};

use serde::Serialize;
use serde_json::Value;

use super::push_detail::claude_transcript;
use super::sessions::{parse_timestamp_ms, AgentSessionSummary};
use super::snapshot::system_time_to_unix_millis;
use super::title::shorten;
use super::tool_call::{claude_tool_call, ToolCall};

const GONE_AFTER_MS: i64 = 30 * 60 * 1000;
const TAIL_BYTES: u64 = 128 * 1024;
const HEAD_BYTES: u64 = 256 * 1024;
const META_MAX_BYTES: u64 = 16 * 1024;
const DESCRIPTION_MAX_CHARS: usize = 80;
const MAX_LISTED: usize = 12;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Subagent {
    pub(super) id: String,
    pub(super) description: Option<String>,
    pub(super) agent_type: Option<String>,
    pub(super) current_tool: Option<ToolCall>,
    pub(super) started_at: Option<i64>,
    pub(super) updated_at: i64,
    pub(super) background: bool,
    pub(super) depth: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedSession {
    #[serde(flatten)]
    pub(super) summary: AgentSessionSummary,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(super) subagent_list: Vec<Subagent>,
}

#[derive(Debug, Default, PartialEq, Eq)]
pub(super) struct Meta {
    pub(super) description: Option<String>,
    pub(super) agent_type: Option<String>,
    pub(super) background: bool,
    pub(super) depth: u32,
    pub(super) ended: bool,
}

struct Cached {
    modified: SystemTime,
    len: u64,
    current_tool: Option<ToolCall>,
    started_at: Option<i64>,
}

static TRANSCRIPTS: Mutex<Option<HashMap<PathBuf, Cached>>> = Mutex::new(None);

pub(super) fn with_subagents(home_dir: &Path, sessions: Vec<AgentSessionSummary>, now: i64) -> Vec<ListedSession> {
    let mut cache = TRANSCRIPTS.lock().unwrap_or_else(PoisonError::into_inner);
    let cache = cache.get_or_insert_with(HashMap::new);
    let mut kept = Vec::new();
    let listed = sessions
        .into_iter()
        .map(|summary| {
            let subagent_list = if may_have_subagents(&summary) {
                claude_transcript(home_dir, &summary.session_id)
                    .map(|transcript| running(&subagents_dir(&transcript), now, cache, &mut kept))
                    .unwrap_or_default()
            } else {
                Vec::new()
            };
            ListedSession { summary, subagent_list }
        })
        .collect();
    cache.retain(|path, _| kept.contains(path));
    listed
}

pub(super) fn may_have_subagents(summary: &AgentSessionSummary) -> bool {
    summary.provider == "claudeCode"
        && summary.remote_host.is_none()
        && !summary.closed
        && (summary.subagents > 0 || summary.background_tasks > 0)
}

pub(super) fn subagents_dir(transcript: &Path) -> PathBuf {
    transcript.with_extension("").join("subagents")
}

fn running(dir: &Path, now: i64, cache: &mut HashMap<PathBuf, Cached>, kept: &mut Vec<PathBuf>) -> Vec<Subagent> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut list = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some(id) = name.to_str().and_then(|name| name.strip_prefix("agent-")?.strip_suffix(".meta.json")) else {
            continue;
        };
        let Some(meta) = read_meta(&entry.path()) else { continue };
        if meta.ended {
            continue;
        }
        let transcript = dir.join(format!("agent-{id}.jsonl"));
        let Ok(stat) = fs::metadata(&transcript) else { continue };
        let Ok(modified) = stat.modified() else { continue };
        let updated_at = system_time_to_unix_millis(modified).unwrap_or_default();
        if now - updated_at >= GONE_AFTER_MS {
            continue;
        }
        let fresh = cache.get(&transcript).is_some_and(|cached| cached.modified == modified && cached.len == stat.len());
        if !fresh {
            let started_at = cache.get(&transcript).and_then(|cached| cached.started_at).or_else(|| first_timestamp(&transcript));
            let current_tool = read_tail(&transcript).and_then(|tail| current_tool(&tail));
            cache.insert(transcript.clone(), Cached { modified, len: stat.len(), current_tool, started_at });
        }
        let Some(cached) = cache.get(&transcript) else { continue };
        list.push(Subagent {
            id: id.to_string(),
            description: meta.description,
            agent_type: meta.agent_type,
            current_tool: cached.current_tool.clone(),
            started_at: cached.started_at,
            updated_at,
            background: meta.background,
            depth: meta.depth,
        });
        kept.push(transcript);
    }
    list.sort_by_key(|agent| (agent.started_at.unwrap_or(agent.updated_at), agent.id.clone()));
    list.truncate(MAX_LISTED);
    list
}

fn read_meta(path: &Path) -> Option<Meta> {
    let mut text = String::new();
    File::open(path).ok()?.take(META_MAX_BYTES).read_to_string(&mut text).ok()?;
    parse_meta(&text)
}

pub(super) fn parse_meta(text: &str) -> Option<Meta> {
    let meta: Value = serde_json::from_str(text).ok()?;
    let flag = |key: &str| meta[key] == Value::Bool(true);
    Some(Meta {
        description: meta["description"].as_str().and_then(|text| shorten(text, DESCRIPTION_MAX_CHARS)),
        agent_type: meta["agentType"].as_str().filter(|kind| !kind.is_empty()).map(str::to_string),
        background: meta["requestShape"] == "background",
        depth: meta["spawnDepth"].as_u64().and_then(|depth| u32::try_from(depth).ok()).unwrap_or(1),
        ended: flag("finished") || flag("stoppedByUser"),
    })
}

pub(super) fn current_tool(tail: &str) -> Option<ToolCall> {
    let newest = tail
        .lines()
        .rev()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .find(|record| matches!(record["type"].as_str(), Some("user" | "assistant")) && record["isMeta"] != Value::Bool(true))?;
    if newest["type"] != "assistant" {
        return None;
    }
    claude_tool_call(&newest["message"]["content"])
}

pub(super) fn first_record_timestamp(line: &str) -> Option<i64> {
    let record: Value = serde_json::from_str(line).ok()?;
    record["timestamp"].as_str().and_then(parse_timestamp_ms)
}

fn first_timestamp(path: &Path) -> Option<i64> {
    let file = File::open(path).ok()?;
    let mut line = Vec::new();
    BufReader::new(file.take(HEAD_BYTES)).read_until(b'\n', &mut line).ok()?;
    first_record_timestamp(String::from_utf8_lossy(&line).trim_end())
}

fn read_tail(path: &Path) -> Option<String> {
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

#[cfg(test)]
#[path = "subagents_tests.rs"]
mod tests;
