use std::{
    env, fs,
    io::Read,
    path::{Path, PathBuf},
};

use serde::Serialize;
use serde_json::Value;

use super::sessions::parse_timestamp_ms;
use crate::claude_usage::{ClaudeUsage, UsageError};

const MAX_SNAPSHOT_BYTES: u64 = 64 * 1024;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    pub(super) name: String,
    pub(super) used: f64,
    pub(super) resets_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentUsage {
    pub(super) updated_at: Option<i64>,
    pub(super) five_hour: Option<UsageWindow>,
    pub(super) seven_day: Option<UsageWindow>,
    pub(super) models: Vec<UsageWindow>,
    pub(super) plan: Option<String>,
    pub(super) source: UsageSource,
    pub(super) error: Option<UsageError>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum UsageSource {
    Hud,
    Api,
    Magpie,
    Codex,
    Glm,
    Kimi,
}

pub(super) fn snapshot_path(claude_dir: &Path, home_dir: &Path) -> Option<PathBuf> {
    let config = fs::read_to_string(claude_dir.join("plugins").join("claude-hud").join("config.json")).ok()?;
    let config = serde_json::from_str::<Value>(&config).ok()?;
    let display = &config["display"];
    ["externalUsagePath", "externalUsageWritePath"]
        .iter()
        .filter_map(|key| display[*key].as_str())
        .find_map(|path| expand_path(path, home_dir))
}

pub(super) fn expand_path(path: &str, home_dir: &Path) -> Option<PathBuf> {
    let path = path.trim();
    let mut expanded = String::with_capacity(path.len());
    let mut rest = match path.strip_prefix('~') {
        Some(after) if after.is_empty() || after.starts_with(['/', '\\']) => {
            expanded.push_str(&home_dir.to_string_lossy());
            after
        }
        _ => path,
    };
    while let Some(start) = rest.find("${") {
        let end = rest[start..].find('}')? + start;
        expanded.push_str(&rest[..start]);
        expanded.push_str(&env::var(&rest[start + 2..end]).ok()?);
        rest = &rest[end + 1..];
    }
    expanded.push_str(rest);
    let path = PathBuf::from(expanded);
    path.is_absolute().then_some(path)
}

pub(super) fn parse_snapshot(text: &str) -> Option<AgentUsage> {
    let snapshot = serde_json::from_str::<Value>(text).ok()?;
    let window = |value: &Value, name: &str, used_key: &str| {
        let used = value[used_key].as_f64().filter(|used| used.is_finite())?;
        Some(UsageWindow {
            name: name.to_string(),
            used: used.clamp(0.0, 100.0),
            resets_at: value["resets_at"].as_str().and_then(parse_timestamp_ms),
        })
    };
    let models = snapshot["model_scoped"]
        .as_array()
        .map(|models| {
            models
                .iter()
                .filter_map(|model| {
                    let name = model["display_name"].as_str().map(str::trim).filter(|name| !name.is_empty())?;
                    window(model, name, "utilization")
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let usage = AgentUsage {
        updated_at: snapshot["updated_at"].as_str().and_then(parse_timestamp_ms),
        five_hour: window(&snapshot["five_hour"], "", "used_percentage"),
        seven_day: window(&snapshot["seven_day"], "", "used_percentage"),
        models,
        plan: snapshot["balance_label"].as_str().map(str::trim).filter(|plan| !plan.is_empty()).map(str::to_string),
        source: UsageSource::Hud,
        error: None,
    };
    (usage.five_hour.is_some() || usage.seven_day.is_some() || !usage.models.is_empty()).then_some(usage)
}

pub(super) fn claude_dir(home_dir: &Path) -> PathBuf {
    env::var_os("CLAUDE_CONFIG_DIR")
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
        .unwrap_or_else(|| home_dir.join(".claude"))
}

pub(super) fn read_usage(home_dir: &Path) -> Option<AgentUsage> {
    let path = snapshot_path(&claude_dir(home_dir), home_dir)?;
    let mut text = String::new();
    fs::File::open(path).ok()?.take(MAX_SNAPSHOT_BYTES).read_to_string(&mut text).ok()?;
    parse_snapshot(&text)
}

pub(super) fn merge(hud: Option<AgentUsage>, api: Option<ClaudeUsage>) -> Option<AgentUsage> {
    let Some(api) = api else { return hud };
    let window = |limit: Option<crate::claude_usage::UsageWindow>| {
        limit.map(|limit| UsageWindow {
            name: String::new(),
            used: limit.percent.clamp(0.0, 100.0),
            resets_at: limit.resets_at.as_deref().and_then(parse_timestamp_ms),
        })
    };
    let api_at = api.updated_at.and_then(|ms| i64::try_from(ms).ok());
    let api_newer = api_at.is_some_and(|api_at| {
        hud.as_ref().is_none_or(|hud| hud.updated_at.is_none_or(|hud_at| api_at >= hud_at))
    });
    let mut usage = match hud {
        Some(hud) if api_newer => AgentUsage { models: Vec::new(), ..hud },
        Some(hud) => hud,
        None => AgentUsage { updated_at: None, five_hour: None, seven_day: None, models: Vec::new(), plan: None, source: UsageSource::Hud, error: None },
    };
    if api_newer {
        usage.updated_at = api_at;
        usage.five_hour = window(api.five_hour);
        usage.seven_day = window(api.seven_day);
        usage.source = UsageSource::Api;
    }
    usage.error = api.error;
    Some(usage)
}
