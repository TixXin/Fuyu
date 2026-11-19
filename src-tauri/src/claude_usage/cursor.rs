use std::{
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock, PoisonError},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use base64::{
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
    Engine,
};
use reqwest::header::{HeaderValue, ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use rusqlite::{Connection, OpenFlags, OptionalExtension};
use serde_json::Value;

use super::{UsageError, UsageErrorKind};
use crate::agent_status::usage::{AgentUsage, UsageSource, UsageWindow};

const USAGE_URL: &str = "https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
const CACHE_MS: i64 = 5 * 60_000;
const REFRESH_GAP_MS: i64 = 60_000;
const MONTH: &str = "month";
const AUTO: &str = "cursorAuto";
const API: &str = "cursorApi";
const TOKEN_KEY: &str = "cursorAuth/accessToken";
const MEMBERSHIP_KEY: &str = "cursorAuth/stripeMembershipType";

pub(super) struct Login {
    token: String,
    plan: Option<String>,
}

fn error(kind: UsageErrorKind, message: impl Into<String>) -> UsageError {
    UsageError { kind, message: message.into() }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| i64::try_from(since.as_millis()).unwrap_or(i64::MAX))
}

fn empty() -> AgentUsage {
    AgentUsage {
        updated_at: None,
        five_hour: None,
        seven_day: None,
        models: Vec::new(),
        plan: None,
        source: UsageSource::Cursor,
        error: None,
    }
}

fn cache() -> &'static Mutex<Option<(i64, AgentUsage)>> {
    static CACHE: OnceLock<Mutex<Option<(i64, AgentUsage)>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

pub(super) async fn read(refresh: bool) -> AgentUsage {
    let now = now_ms();
    let previous = cache().lock().unwrap_or_else(PoisonError::into_inner).clone();
    if let Some((asked_at, usage)) = &previous {
        let ttl = if refresh { REFRESH_GAP_MS } else { CACHE_MS };
        if now.saturating_sub(*asked_at) < ttl {
            return usage.clone();
        }
    }
    let usage = match fetch(now).await {
        Ok(usage) => usage,
        Err(failure) => {
            let mut base = previous
                .map(|(_, cached)| cached)
                .filter(|_| !matches!(failure.kind, UsageErrorKind::NoCredentials | UsageErrorKind::LoginRequired))
                .unwrap_or_else(empty);
            base.error = Some(failure);
            base
        }
    };
    *cache().lock().unwrap_or_else(PoisonError::into_inner) = Some((now, usage.clone()));
    usage
}

async fn fetch(now: i64) -> Result<AgentUsage, UsageError> {
    let login = tauri::async_runtime::spawn_blocking(read_login)
        .await
        .map_err(|_| error(UsageErrorKind::NoCredentials, "Could not inspect the Cursor login."))??;
    let body = request(&login.token, now).await?;
    let value: Value = serde_json::from_str(&body)
        .map_err(|_| error(UsageErrorKind::InvalidResponse, "Cursor's usage answer is not JSON."))?;
    let models = parse_usage(&value)
        .ok_or_else(|| error(UsageErrorKind::InvalidResponse, "Cursor's usage answer has no plan usage."))?;
    Ok(AgentUsage {
        updated_at: Some(now),
        five_hour: None,
        seven_day: None,
        models,
        plan: login.plan,
        source: UsageSource::Cursor,
        error: None,
    })
}

async fn request(token: &str, now: i64) -> Result<String, UsageError> {
    let network = |message: String| error(UsageErrorKind::Network, message);
    let request_id = request_id().map_err(network)?;
    let mut bearer = HeaderValue::from_str(&format!("Bearer {token}"))
        .map_err(|_| error(UsageErrorKind::LoginRequired, "The saved Cursor login is not a usable token."))?;
    bearer.set_sensitive(true);
    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|failure| network(format!("Could not create the HTTP client: {failure}")))?;
    let response = client
        .post(USAGE_URL)
        .header(AUTHORIZATION, bearer)
        .header(CONTENT_TYPE, "application/json")
        .header(ACCEPT, "application/json")
        .header("Connect-Protocol-Version", "1")
        .header("x-cursor-checksum", checksum(&request_id, now))
        .header("x-request-id", &request_id)
        .header("x-ghost-mode", "true")
        .body("{}")
        .send()
        .await
        .map_err(|failure| network(format!("The request to api2.cursor.sh failed: {}", failure.without_url())))?;
    let status = response.status().as_u16();
    if let Some(failure) = status_error(status) {
        return Err(failure);
    }
    response
        .text()
        .await
        .map_err(|failure| network(format!("Could not read Cursor's answer: {}", failure.without_url())))
}

pub(super) fn status_error(status: u16) -> Option<UsageError> {
    match status {
        200..=299 => None,
        401 => Some(error(UsageErrorKind::LoginRequired, "api2.cursor.sh refused the login (HTTP 401).")),
        403 => Some(error(UsageErrorKind::Forbidden, "api2.cursor.sh refused to show the usage (HTTP 403).")),
        404 => Some(error(UsageErrorKind::EndpointChanged, "Cursor's usage endpoint is gone (HTTP 404).")),
        429 => Some(error(UsageErrorKind::RateLimited, "api2.cursor.sh asked to slow down (HTTP 429).")),
        _ => Some(error(UsageErrorKind::Http, format!("api2.cursor.sh answered HTTP {status}."))),
    }
}

fn request_id() -> Result<String, String> {
    let mut bytes = [0u8; 16];
    getrandom::fill(&mut bytes).map_err(|failure| format!("Could not make a request id: {failure}"))?;
    Ok(uuid_text(bytes))
}

pub(super) fn uuid_text(mut bytes: [u8; 16]) -> String {
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    format!("{}-{}-{}-{}-{}", &hex[..8], &hex[8..12], &hex[12..16], &hex[16..20], &hex[20..])
}

pub(super) fn checksum(machine: &str, now_ms: i64) -> String {
    let stamp = (now_ms / 1_000_000) as u32;
    let mut bytes = [
        (stamp >> 8) as u8,
        stamp as u8,
        (stamp >> 24) as u8,
        (stamp >> 16) as u8,
        (stamp >> 8) as u8,
        stamp as u8,
    ];
    let mut previous = 165u8;
    for (index, byte) in bytes.iter_mut().enumerate() {
        *byte = (*byte ^ previous).wrapping_add(index as u8);
        previous = *byte;
    }
    format!("{}{machine}", URL_SAFE_NO_PAD.encode(bytes))
}

fn state_db() -> Option<PathBuf> {
    let home = super::home_dir()?;
    #[cfg(target_os = "macos")]
    let path = home.join("Library/Application Support/Cursor/User/globalStorage/state.vscdb");
    #[cfg(windows)]
    let path = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join("AppData").join("Roaming"))
        .join("Cursor")
        .join("User")
        .join("globalStorage")
        .join("state.vscdb");
    #[cfg(all(not(windows), not(target_os = "macos")))]
    let path = home.join(".config/Cursor/User/globalStorage/state.vscdb");
    Some(path)
}

fn read_login() -> Result<Login, UsageError> {
    let missing = || error(UsageErrorKind::NoCredentials, "Cursor is not installed or not signed in.");
    let path = state_db().filter(|path| path.is_file()).ok_or_else(missing)?;
    let conn = open_read_only(&path).ok_or_else(missing)?;
    let token = item(&conn, TOKEN_KEY).and_then(|raw| clean_token(&raw)).ok_or_else(missing)?;
    let plan = item(&conn, MEMBERSHIP_KEY).and_then(|raw| plan_label(&raw));
    Ok(Login { token, plan })
}

fn open_read_only(path: &Path) -> Option<Connection> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX).ok()?;
    let _ = conn.busy_timeout(Duration::from_millis(200));
    let _ = conn.pragma_update(None, "query_only", "ON");
    Some(conn)
}

fn item(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row("SELECT value FROM ItemTable WHERE key = ?1", [key], |row| row.get::<_, String>(0))
        .optional()
        .ok()
        .flatten()
}

pub(super) fn clean_token(raw: &str) -> Option<String> {
    let raw = raw.trim();
    let unquoted = serde_json::from_str::<String>(raw).unwrap_or_else(|_| raw.to_string());
    let mut token = unquoted.trim();
    if let Some((_, value)) = token.strip_prefix("scoped:v1:").and_then(|scoped| scoped.split_once(':')) {
        token = value.trim();
    }
    if token.is_empty() {
        return None;
    }
    if token.matches('.').count() != 2 {
        if let Some(decoded) = STANDARD
            .decode(token)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
            .filter(|text| text.matches('.').count() == 2)
        {
            return Some(decoded.trim().to_string());
        }
    }
    token.bytes().all(|byte| (0x21..=0x7e).contains(&byte)).then(|| token.to_string())
}

pub(super) fn plan_label(raw: &str) -> Option<String> {
    let raw = serde_json::from_str::<String>(raw.trim()).unwrap_or_else(|_| raw.trim().to_string());
    let words: Vec<String> = raw
        .split(['_', '-', ' '])
        .filter(|word| !word.is_empty())
        .map(|word| {
            let mut chars = word.chars();
            chars
                .next()
                .map(|first| first.to_uppercase().chain(chars.flat_map(char::to_lowercase)).collect())
                .unwrap_or_default()
        })
        .collect();
    (!words.is_empty()).then(|| words.join(" "))
}

fn number(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str().and_then(|text| text.trim().parse::<f64>().ok()))
        .filter(|number| number.is_finite())
}

fn reset_ms(value: &Value) -> Option<i64> {
    let number = number(value).filter(|number| *number > 0.0)?;
    let ms = if number < 10_000_000_000.0 { number * 1000.0 } else { number };
    Some(ms as i64)
}

fn window(name: &str, used: f64, resets_at: Option<i64>) -> UsageWindow {
    UsageWindow { name: name.to_string(), used: used.clamp(0.0, 100.0), resets_at }
}

pub(super) fn parse_usage(value: &Value) -> Option<Vec<UsageWindow>> {
    if value["usesPooledEnterpriseAllowance"].as_bool() == Some(true) || value["enabled"].as_bool() == Some(false) {
        return None;
    }
    if let Some(used) = number(&value["usagePercent"]) {
        return Some(vec![window(MONTH, used, reset_ms(&value["nextResetTimestampUtc"]))]);
    }
    let plan = value.get("planUsage")?;
    let resets_at = reset_ms(&value["billingCycleEnd"]);
    let total = number(&plan["totalPercentUsed"]).or_else(|| {
        let limit = number(&plan["limit"]).filter(|limit| *limit > 0.0)?;
        let spent = number(&plan["includedSpend"]).or_else(|| number(&plan["totalSpend"]))?;
        Some(spent / limit * 100.0)
    })?;
    let mut windows = vec![window(MONTH, total, resets_at)];
    for (name, key) in [(AUTO, "autoPercentUsed"), (API, "apiPercentUsed")] {
        if let Some(used) = number(&plan[key]) {
            windows.push(window(name, used, None));
        }
    }
    Some(windows)
}

#[cfg(test)]
#[path = "cursor_tests.rs"]
mod tests;
