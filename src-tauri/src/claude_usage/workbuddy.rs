use std::{
    collections::HashSet,
    env, fs,
    io::{BufRead, BufReader, Read},
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock, PoisonError},
    time::{SystemTime, UNIX_EPOCH},
};

use chrono::{Local, TimeZone};
use serde_json::Value;

use super::{HoverUsage, UsageError, UsageErrorKind, WorkbuddyCredits};

const CACHE_MS: i64 = 30_000;
const REFRESH_GAP_MS: i64 = 2_000;
const MAX_SESSION_FILES: usize = 256;
const MAX_FILE_BYTES: u64 = 4 * 1024 * 1024;
const SEVEN_DAYS_MS: i64 = 7 * 24 * 60 * 60 * 1000;

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| i64::try_from(since.as_millis()).unwrap_or(i64::MAX))
}

fn local_day_start_ms(now: i64) -> i64 {
    Local
        .timestamp_millis_opt(now)
        .single()
        .and_then(|dt| dt.date_naive().and_hms_opt(0, 0, 0))
        .and_then(|naive| Local.from_local_datetime(&naive).earliest())
        .map_or_else(|| now.saturating_sub(24 * 60 * 60 * 1000), |dt| dt.timestamp_millis())
}

fn error(kind: UsageErrorKind, message: impl Into<String>) -> UsageError {
    UsageError { kind, message: message.into() }
}

fn empty(err: Option<UsageError>) -> HoverUsage {
    HoverUsage {
        provider: "workbuddy".to_string(),
        updated_at: None,
        source: Some("workbuddy".to_string()),
        available: None,
        credits: None,
        wallets: Vec::new(),
        error: err,
    }
}

fn cache() -> &'static Mutex<Option<(i64, HoverUsage)>> {
    static CACHE: OnceLock<Mutex<Option<(i64, HoverUsage)>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

pub(super) async fn read(refresh: bool) -> HoverUsage {
    let now = now_ms();
    if let Some((asked_at, cached)) = cache().lock().unwrap_or_else(PoisonError::into_inner).clone() {
        let ttl = if refresh { REFRESH_GAP_MS } else { CACHE_MS };
        if now.saturating_sub(asked_at) < ttl {
            return cached;
        }
    }
    let usage = tauri::async_runtime::spawn_blocking(move || scan_local(now))
        .await
        .unwrap_or_else(|_| empty(Some(error(UsageErrorKind::InvalidResponse, "Could not scan WorkBuddy sessions."))));
    *cache().lock().unwrap_or_else(PoisonError::into_inner) = Some((now, usage.clone()));
    usage
}

fn roots(home: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(custom) = env::var_os("WORKBUDDY_CONFIG_DIR")
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
    {
        dirs.push(custom);
    }
    for folder in [".workbuddy", ".workbuddy-ai"] {
        let candidate = home.join(folder);
        if !dirs.contains(&candidate) {
            dirs.push(candidate);
        }
    }
    dirs
}

fn collect_session_files(roots: &[PathBuf]) -> Vec<(SystemTime, PathBuf)> {
    let mut files = Vec::new();
    for root in roots {
        let projects = root.join("projects");
        for project in fs::read_dir(projects).into_iter().flatten().flatten() {
            for entry in fs::read_dir(project.path()).into_iter().flatten().flatten() {
                let path = entry.path();
                if path.extension().and_then(|ext| ext.to_str()) != Some("jsonl") {
                    continue;
                }
                if let Some(modified) = entry.metadata().ok().and_then(|meta| meta.modified().ok()) {
                    files.push((modified, path));
                }
            }
        }
    }
    files.sort_by_key(|(modified, _)| std::cmp::Reverse(*modified));
    files.truncate(MAX_SESSION_FILES);
    files
}

fn scan_local(now: i64) -> HoverUsage {
    let Some(home) = super::home_dir() else {
        return empty(Some(error(UsageErrorKind::NoSessions, "User home directory is unknown.")));
    };
    scan_in_roots(&roots(&home), now, local_day_start_ms(now))
}

pub(super) fn scan_in_roots(roots: &[PathBuf], now: i64, day_start_ms: i64) -> HoverUsage {
    let files = collect_session_files(roots);
    if files.is_empty() {
        return empty(Some(error(
            UsageErrorKind::NoSessions,
            "No WorkBuddy session logs found.",
        )));
    }
    let mut accum = CreditAccumulator::new(day_start_ms, now.saturating_sub(SEVEN_DAYS_MS));
    for (modified, path) in &files {
        if let Ok(file) = fs::File::open(path) {
            let fallback_ts = modified
                .duration_since(UNIX_EPOCH)
                .ok()
                .and_then(|d| i64::try_from(d.as_millis()).ok());
            let reader = BufReader::new(file.take(MAX_FILE_BYTES));
            for line in reader.lines().map_while(Result::ok) {
                accum.feed_line(&line, fallback_ts);
            }
        }
    }
    match accum.finish(now) {
        Some((credits, latest_ts)) => HoverUsage {
            provider: "workbuddy".to_string(),
            updated_at: Some(latest_ts),
            source: Some("workbuddy".to_string()),
            available: None,
            credits: Some(credits),
            wallets: Vec::new(),
            error: None,
        },
        None => empty(Some(error(
            UsageErrorKind::InvalidResponse,
            "WorkBuddy session logs have no recognizable usage records.",
        ))),
    }
}

struct CreditAccumulator {
    day_start_ms: i64,
    week_start_ms: i64,
    seen_ids: HashSet<String>,
    sessions: HashSet<String>,
    saw_workbuddy_record: bool,
    today: f64,
    seven_day: f64,
    total: f64,
    total_tokens: u64,
    latest_ts: Option<i64>,
}

impl CreditAccumulator {
    fn new(day_start_ms: i64, week_start_ms: i64) -> Self {
        Self {
            day_start_ms,
            week_start_ms,
            seen_ids: HashSet::new(),
            sessions: HashSet::new(),
            saw_workbuddy_record: false,
            today: 0.0,
            seven_day: 0.0,
            total: 0.0,
            total_tokens: 0,
            latest_ts: None,
        }
    }

    fn feed_line(&mut self, line: &str, fallback_ts: Option<i64>) {
        if !line.contains("sessionId") && !line.contains("providerData") {
            return;
        }
        let Ok(record) = serde_json::from_str::<Value>(line) else {
            return;
        };
        if let Some(session_id) = record["sessionId"].as_str().filter(|id| !id.is_empty()) {
            self.saw_workbuddy_record = true;
            self.sessions.insert(session_id.to_string());
        }
        let ts = record["timestamp"].as_i64().or(fallback_ts);
        if let Some(at) = ts {
            self.latest_ts = Some(self.latest_ts.map_or(at, |prev| prev.max(at)));
        }
        let raw_usage = &record["providerData"]["rawUsage"];
        if !raw_usage.is_object() {
            return;
        }
        self.saw_workbuddy_record = true;
        if let Some(id) = record["id"].as_str().filter(|id| !id.is_empty()) {
            if !self.seen_ids.insert(id.to_string()) {
                return;
            }
        }
        let credit = raw_usage["credit"]
            .as_f64()
            .or_else(|| raw_usage["credit"].as_str()?.trim().parse::<f64>().ok())
            .filter(|v| v.is_finite() && *v >= 0.0)
            .unwrap_or(0.0);
        let rec_tokens = raw_usage["total_tokens"].as_u64().unwrap_or(0);
        self.total += credit;
        self.total_tokens = self.total_tokens.saturating_add(rec_tokens);
        if let Some(at) = ts {
            if at >= self.week_start_ms {
                self.seven_day += credit;
            }
            if at >= self.day_start_ms {
                self.today += credit;
            }
        }
    }

    fn finish(self, now: i64) -> Option<(WorkbuddyCredits, i64)> {
        if !self.saw_workbuddy_record {
            return None;
        }
        let round2 = |v: f64| (v * 100.0).round() / 100.0;
        Some((
            WorkbuddyCredits {
                today: round2(self.today),
                seven_day: round2(self.seven_day),
                total: round2(self.total),
                total_tokens: self.total_tokens,
                sessions: self.sessions.len().max(1),
            },
            self.latest_ts.unwrap_or(now),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sums_workbuddy_credits_across_editions_and_deduplicates_records() {
        let dir = std::env::temp_dir().join(format!("fuyu-wb-usage-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let cn = dir.join(".workbuddy").join("projects").join("p1");
        let ai = dir.join(".workbuddy-ai").join("projects").join("p2");
        fs::create_dir_all(&cn).unwrap();
        fs::create_dir_all(&ai).unwrap();

        let now = 1_790_000_000_000_i64;
        let day_start = now - 3_600_000;
        let rec1 = serde_json::json!({
            "id": "m1",
            "sessionId": "s1",
            "timestamp": now - 600_000,
            "providerData": { "rawUsage": { "credit": 12.5, "total_tokens": 4000 } }
        });
        let rec2 = serde_json::json!({
            "id": "m2",
            "sessionId": "s2",
            "timestamp": now - 2 * 86_400_000,
            "providerData": { "rawUsage": { "credit": 30.25, "total_tokens": 8500 } }
        });
        let rec3 = serde_json::json!({
            "id": "m3",
            "sessionId": "s2",
            "timestamp": now - 10 * 86_400_000,
            "providerData": { "rawUsage": { "credit": 7.25, "total_tokens": 1500 } }
        });
        fs::write(cn.join("s1.jsonl"), format!("{rec1}\n{rec1}\n")).unwrap();
        fs::write(ai.join("s2.jsonl"), format!("{rec2}\n{rec3}\n")).unwrap();

        let usage = scan_in_roots(&[dir.join(".workbuddy"), dir.join(".workbuddy-ai")], now, day_start);
        assert!(usage.error.is_none());
        let credits = usage.credits.expect("credits");
        assert_eq!(credits.today, 12.5);
        assert_eq!(credits.seven_day, 42.75);
        assert_eq!(credits.total, 50.0);
        assert_eq!(credits.total_tokens, 14_000);
        assert_eq!(credits.sessions, 2);

        let empty_dir = dir.join("missing");
        let missing = scan_in_roots(&[empty_dir], now, day_start);
        assert_eq!(missing.error.map(|e| e.kind), Some(UsageErrorKind::NoSessions));
        assert!(missing.credits.is_none());
        let _ = fs::remove_dir_all(&dir);
    }
}
