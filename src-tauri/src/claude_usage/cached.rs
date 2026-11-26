use std::{
    env, fs,
    io::BufReader,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
    time::SystemTime,
};

use serde_json::Value;

use super::{source, ClaudeUsage};

const MAX_CONFIG_BYTES: u64 = 32 * 1024 * 1024;

type Cache = Option<(PathBuf, SystemTime, Option<ClaudeUsage>)>;

static CACHE: Mutex<Cache> = Mutex::new(None);

pub(crate) fn read(home_dir: &Path) -> Option<ClaudeUsage> {
    let path = config_path(home_dir);
    let meta = fs::metadata(&path).ok()?;
    if meta.len() > MAX_CONFIG_BYTES {
        return None;
    }
    let modified = meta.modified().ok()?;
    let mut cache = CACHE.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some((cached_path, cached_at, usage)) = cache.as_ref() {
        if *cached_path == path && *cached_at == modified {
            return usage.clone();
        }
    }
    let file = fs::File::open(&path).ok()?;
    let usage = serde_json::from_reader::<_, Value>(BufReader::new(file)).ok().and_then(|config| parse(&config));
    *cache = Some((path, modified, usage.clone()));
    usage
}

fn config_path(home_dir: &Path) -> PathBuf {
    env::var_os("CLAUDE_CONFIG_DIR")
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
        .map_or_else(|| home_dir.join(".claude.json"), |dir| dir.join(".claude.json"))
}

pub(super) fn parse(config: &Value) -> Option<ClaudeUsage> {
    let cached = &config["cachedUsageUtilization"];
    let fetched_at = cached["fetchedAtMs"].as_f64().filter(|at| at.is_finite() && *at > 0.0)? as u64;
    if let (Some(signed_in), Some(owner)) = (config["oauthAccount"]["accountUuid"].as_str(), cached["accountUuid"].as_str()) {
        if signed_in != owner {
            return None;
        }
    }
    let limits = source::parse_api_usage(&cached["utilization"].to_string()).ok()?;
    Some(ClaudeUsage { five_hour: limits.five_hour, seven_day: limits.seven_day, updated_at: Some(fetched_at), error: None })
}
