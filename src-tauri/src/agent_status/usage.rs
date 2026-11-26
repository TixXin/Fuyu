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
    pub(crate) name: String,
    pub(crate) used: f64,
    pub(crate) resets_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentUsage {
    pub(crate) updated_at: Option<i64>,
    pub(crate) five_hour: Option<UsageWindow>,
    pub(crate) seven_day: Option<UsageWindow>,
    pub(crate) models: Vec<UsageWindow>,
    pub(crate) plan: Option<String>,
    pub(crate) source: UsageSource,
    pub(crate) error: Option<UsageError>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum UsageSource {
    Hud,
    Statusline,
    Api,
    Magpie,
    Codex,
    Glm,
    Kimi,
    Antigravity,
    AntigravityCloud,
    Cursor,
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

pub(super) async fn claude_usage(home_dir: &Path, app_dir: Option<&Path>) -> Result<Option<AgentUsage>, String> {
    let magpie = super::magpie::read_usage(&claude_dir(home_dir)).await;
    let (home, app) = (home_dir.to_path_buf(), app_dir.map(Path::to_path_buf));
    let local = match magpie {
        Some(magpie) => Some(magpie),
        None => tauri::async_runtime::spawn_blocking(move || read_local(&home, app.as_deref()))
            .await
            .map_err(|error| format!("Failed to join the usage task: {error}"))?,
    };
    let now_ms = unix_now_ms();
    let api = crate::claude_usage::fallback_usage(needs_fallback(local.as_ref(), now_ms)).await;
    Ok(merge(local, api))
}

fn unix_now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .and_then(|elapsed| i64::try_from(elapsed.as_millis()).ok())
        .unwrap_or_default()
}

pub(super) fn read_local(home_dir: &Path, app_dir: Option<&Path>) -> Option<AgentUsage> {
    let cached = crate::claude_usage::cached_usage(home_dir).map(from_api);
    newest(newest(app_dir.and_then(super::claude_statusline::read_usage), read_usage(home_dir)), cached)
}

pub(super) fn from_api(api: ClaudeUsage) -> AgentUsage {
    AgentUsage {
        updated_at: api.updated_at.and_then(|ms| i64::try_from(ms).ok()),
        five_hour: api_window(api.five_hour),
        seven_day: api_window(api.seven_day),
        models: Vec::new(),
        plan: None,
        source: UsageSource::Api,
        error: api.error,
    }
}

fn api_window(limit: Option<crate::claude_usage::UsageWindow>) -> Option<UsageWindow> {
    limit.map(|limit| UsageWindow {
        name: String::new(),
        used: limit.percent.clamp(0.0, 100.0),
        resets_at: limit.resets_at.as_deref().and_then(parse_timestamp_ms),
    })
}

pub(super) fn newest(first: Option<AgentUsage>, second: Option<AgentUsage>) -> Option<AgentUsage> {
    match (first, second) {
        (Some(first), Some(second)) => Some(if second.updated_at > first.updated_at { second } else { first }),
        (first, second) => first.or(second),
    }
}

pub(super) fn needs_fallback(local: Option<&AgentUsage>, now_ms: i64) -> bool {
    const FRESH_MS: i64 = 30 * 60 * 1000;
    let Some(local) = local else { return true };
    let recent = local.updated_at.is_some_and(|at| now_ms - at < FRESH_MS);
    let live = [&local.five_hour, &local.seven_day]
        .into_iter()
        .flatten()
        .chain(local.models.iter())
        .any(|window| window.resets_at.is_none_or(|reset| reset > now_ms));
    !(recent && live)
}

pub(super) fn merge(hud: Option<AgentUsage>, api: Option<ClaudeUsage>) -> Option<AgentUsage> {
    let Some(api) = api else { return hud };
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
        usage.five_hour = api_window(api.five_hour);
        usage.seven_day = api_window(api.seven_day);
        usage.source = UsageSource::Api;
    }
    usage.error = api.error;
    Some(usage)
}
