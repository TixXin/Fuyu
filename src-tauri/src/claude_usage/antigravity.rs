use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::Command,
    sync::{Mutex, OnceLock, PoisonError},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use reqwest::header::{HeaderValue, ACCEPT, AUTHORIZATION, CONTENT_TYPE, USER_AGENT};
use serde_json::{json, Value};

use super::{background, source, UsageError, UsageErrorKind};
use crate::agent_status::{
    parse_timestamp_ms,
    usage::{AgentUsage, UsageSource, UsageWindow},
};

const LS_TIMEOUT: Duration = Duration::from_secs(2);
const CLOUD_TIMEOUT: Duration = Duration::from_secs(8);
const CACHE_MS: i64 = 60_000;
const REFRESH_GAP_MS: i64 = 10_000;
const MAX_TOKEN_FILE_BYTES: u64 = 64 * 1024;
const THIRD_PARTY_5H: &str = "3p5h";
const THIRD_PARTY_7D: &str = "3p7d";
const CLOUD_BASES: [&str; 2] = [
    "https://daily-cloudcode-pa.googleapis.com",
    "https://cloudcode-pa.googleapis.com",
];

#[derive(Debug, Clone, PartialEq)]
pub(super) struct LanguageServer {
    pub(super) pid: u32,
    pub(super) ports: Vec<u16>,
    pub(super) csrf: String,
}

#[derive(Debug, Default, PartialEq)]
pub(super) struct QuotaWindows {
    pub(super) five_hour: Option<UsageWindow>,
    pub(super) seven_day: Option<UsageWindow>,
    pub(super) models: Vec<UsageWindow>,
    pub(super) plan: Option<String>,
}

fn error(kind: UsageErrorKind, message: impl Into<String>) -> UsageError {
    UsageError { kind, message: message.into() }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| i64::try_from(since.as_millis()).unwrap_or(i64::MAX))
}

fn empty(source: UsageSource) -> AgentUsage {
    AgentUsage {
        updated_at: None,
        five_hour: None,
        seven_day: None,
        models: Vec::new(),
        plan: None,
        source,
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
        Ok((source, windows)) => AgentUsage {
            updated_at: Some(now),
            five_hour: windows.five_hour,
            seven_day: windows.seven_day,
            models: windows.models,
            plan: windows.plan,
            source,
            error: None,
        },
        Err((source, failure)) => {
            let mut base = previous
                .map(|(_, cached)| cached)
                .unwrap_or_else(|| empty(source));
            base.error = Some(failure);
            base
        }
    };
    *cache().lock().unwrap_or_else(PoisonError::into_inner) = Some((now, usage.clone()));
    usage
}

async fn fetch(now: i64) -> Result<(UsageSource, QuotaWindows), (UsageSource, UsageError)> {
    let servers = tauri::async_runtime::spawn_blocking(discover_servers)
        .await
        .unwrap_or_default();
    let mut ls_endpoint_changed = false;
    if let Ok(client) = reqwest::Client::builder()
        .timeout(LS_TIMEOUT)
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .build()
    {
        for server in &servers {
            for &port in &server.ports {
                match query_language_server(&client, port, &server.csrf).await {
                    Ok(Some(windows)) => return Ok((UsageSource::Antigravity, windows)),
                    Ok(None) => {}
                    Err(()) => ls_endpoint_changed = true,
                }
            }
        }
    }

    let token = tauri::async_runtime::spawn_blocking(move || read_saved_token(now))
        .await
        .map_err(|_| {
            (
                UsageSource::AntigravityCloud,
                error(UsageErrorKind::Network, "Could not inspect Antigravity login."),
            )
        })?;

    match token {
        Ok(token) => fetch_cloud_code(&token)
            .await
            .map(|windows| (UsageSource::AntigravityCloud, windows))
            .map_err(|failure| (UsageSource::AntigravityCloud, failure)),
        Err(_) if ls_endpoint_changed => Err((
            UsageSource::Antigravity,
            error(
                UsageErrorKind::EndpointChanged,
                "Antigravity's local quota endpoint changed or answered in an unknown format.",
            ),
        )),
        Err(token_error) => Err((UsageSource::Antigravity, token_error)),
    }
}

fn discover_servers() -> Vec<LanguageServer> {
    let mut found = Vec::new();
    for pid in crate::platform::process::pids_matching_name("language_server") {
        let Some(args) = crate::platform::process_env::command_line_args(pid) else {
            continue;
        };
        let listening = listening_loopback_ports(pid);
        if let Some(server) = parse_server_args(pid, &args, &listening) {
            found.push(server);
        }
    }
    found
}

pub(super) fn parse_server_args(pid: u32, args: &[String], fallback_ports: &[u16]) -> Option<LanguageServer> {
    let joined = args.join(" ").to_ascii_lowercase();
    if !joined.contains("antigravity") && !joined.contains("agy") {
        return None;
    }
    let mut csrf: Option<String> = None;
    let mut ports = Vec::new();
    let push_port = |ports: &mut Vec<u16>, raw: &str| {
        if let Ok(port) = raw.trim().parse::<u16>() {
            if port > 0 && !ports.contains(&port) {
                ports.push(port);
            }
        }
    };
    let mut index = 0usize;
    while index < args.len() {
        let arg = &args[index];
        if let Some(rest) = arg.strip_prefix("--") {
            let (name, value) = match rest.split_once('=') {
                Some((name, value)) => (name, Some(value.to_string())),
                None if index + 1 < args.len() && !args[index + 1].starts_with("--") => {
                    index += 1;
                    (rest, Some(args[index].clone()))
                }
                None => (rest, None),
            };
            if let Some(value) = value {
                match name {
                    "csrf_token" if !value.trim().is_empty() => csrf = Some(value.trim().to_string()),
                    "extension_server_port" | "port" | "https_server_port" | "server_port" => {
                        push_port(&mut ports, &value);
                    }
                    _ => {}
                }
            }
        }
        index += 1;
    }
    for &port in fallback_ports {
        if port > 0 && !ports.contains(&port) {
            ports.push(port);
        }
    }
    let csrf = csrf.filter(|token| token.bytes().all(|byte| (0x21..=0x7e).contains(&byte)))?;
    (!ports.is_empty()).then_some(LanguageServer { pid, ports, csrf })
}

#[cfg(target_os = "macos")]
fn listening_loopback_ports(pid: u32) -> Vec<u16> {
    let output = Command::new("/usr/sbin/lsof")
        .args(["-nP", "-a", "-p", &pid.to_string(), "-iTCP", "-sTCP:LISTEN", "-Fn"])
        .output();
    let Ok(output) = output else {
        return Vec::new();
    };
    parse_lsof_ports(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(windows)]
fn listening_loopback_ports(pid: u32) -> Vec<u16> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let output = Command::new("netstat.exe")
        .args(["-ano", "-p", "tcp"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    let Ok(output) = output else {
        return Vec::new();
    };
    parse_netstat_ports(&String::from_utf8_lossy(&output.stdout), pid)
}

#[cfg(not(any(target_os = "macos", windows)))]
fn listening_loopback_ports(_pid: u32) -> Vec<u16> {
    Vec::new()
}

#[cfg(any(target_os = "macos", test))]
pub(super) fn parse_lsof_ports(stdout: &str) -> Vec<u16> {
    let mut ports = Vec::new();
    for line in stdout.lines() {
        let Some(addr) = line.strip_prefix('n') else {
            continue;
        };
        let Some((host, port)) = addr.rsplit_once(':') else {
            continue;
        };
        if !matches!(host, "127.0.0.1" | "*" | "[::1]") {
            continue;
        }
        if let Ok(port) = port.trim().parse::<u16>() {
            if port > 0 && !ports.contains(&port) {
                ports.push(port);
            }
        }
    }
    ports
}

#[cfg(any(windows, test))]
pub(super) fn parse_netstat_ports(stdout: &str, pid: u32) -> Vec<u16> {
    let wanted = pid.to_string();
    let mut ports = Vec::new();
    for line in stdout.lines() {
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() < 4 || !cols[0].eq_ignore_ascii_case("tcp") || cols.last() != Some(&wanted.as_str()) {
            continue;
        }
        if !cols[2].ends_with(":0") {
            continue;
        }
        let Some((host, port)) = cols[1].rsplit_once(':') else {
            continue;
        };
        if !matches!(host, "127.0.0.1" | "0.0.0.0" | "[::1]" | "[::]") {
            continue;
        }
        if let Ok(port) = port.parse::<u16>() {
            if port > 0 && !ports.contains(&port) {
                ports.push(port);
            }
        }
    }
    ports
}

async fn call_ls_method(client: &reqwest::Client, port: u16, csrf: &str, method: &str) -> Result<Option<String>, ()> {
    let mut token = HeaderValue::from_str(csrf).map_err(|_| ())?;
    token.set_sensitive(true);
    let url = format!("http://127.0.0.1:{port}/exa.language_server_pb.LanguageServerService/{method}");
    let body = json!({
        "metadata": {
            "ideName": "antigravity",
            "extensionName": "antigravity",
            "ideVersion": "unknown",
            "locale": "en"
        }
    });
    let Ok(response) = client
        .post(url)
        .header(CONTENT_TYPE, "application/json")
        .header("Connect-Protocol-Version", "1")
        .header("x-codeium-csrf-token", token)
        .body(body.to_string())
        .send()
        .await
    else {
        return Ok(None);
    };
    let status = response.status().as_u16();
    if !(200..300).contains(&status) {
        return Err(());
    }
    response.text().await.map(Some).map_err(|_| ())
}

async fn query_language_server(client: &reqwest::Client, port: u16, csrf: &str) -> Result<Option<QuotaWindows>, ()> {
    let mut summary_windows: Option<QuotaWindows> = None;
    match call_ls_method(client, port, csrf, "RetrieveUserQuotaSummary").await {
        Ok(Some(text)) => summary_windows = parse_quota_summary(&text),
        Ok(None) => return Ok(None),
        Err(()) => {}
    }

    if let Ok(Some(status_text)) = call_ls_method(client, port, csrf, "GetUserStatus").await {
        let plan = parse_user_plan(&status_text);
        if let Some(mut windows) = summary_windows {
            windows.plan = plan;
            return Ok(Some(windows));
        }
        if let Some(mut windows) = parse_user_status(&status_text) {
            windows.plan = plan;
            return Ok(Some(windows));
        }
    } else if let Some(windows) = summary_windows {
        return Ok(Some(windows));
    }

    if let Ok(Some(config_text)) = call_ls_method(client, port, csrf, "GetCommandModelConfigs").await {
        if let Some(windows) = parse_command_model_configs(&config_text) {
            return Ok(Some(windows));
        }
    }

    Err(())
}

fn used_from_remaining(remaining: f64) -> Option<f64> {
    remaining
        .is_finite()
        .then(|| ((1.0 - remaining.clamp(0.0, 1.0)) * 100.0).clamp(0.0, 100.0))
}

fn window(name: &str, remaining: f64, reset_time: Option<&str>) -> Option<UsageWindow> {
    Some(UsageWindow {
        name: name.to_string(),
        used: used_from_remaining(remaining)?,
        resets_at: reset_time.and_then(parse_timestamp_ms),
    })
}

pub(super) fn parse_quota_summary(text: &str) -> Option<QuotaWindows> {
    let root = serde_json::from_str::<Value>(text).ok()?;
    let groups = root["response"]["groups"]
        .as_array()
        .or_else(|| root["groups"].as_array())?;
    let mut out = QuotaWindows::default();
    let mut third_party_5h: Option<UsageWindow> = None;
    let mut third_party_7d: Option<UsageWindow> = None;
    let mut fallback_5h: Option<UsageWindow> = None;
    let mut fallback_7d: Option<UsageWindow> = None;
    for group in groups {
        for bucket in group["buckets"].as_array().into_iter().flatten() {
            let Some(remaining) = bucket["remainingFraction"].as_f64() else {
                continue;
            };
            let reset = bucket["resetTime"].as_str();
            match bucket["bucketId"].as_str() {
                Some("gemini-5h") => out.five_hour = window("", remaining, reset),
                Some("gemini-weekly") => out.seven_day = window("", remaining, reset),
                Some("3p-5h") => third_party_5h = window(THIRD_PARTY_5H, remaining, reset),
                Some("3p-weekly") => third_party_7d = window(THIRD_PARTY_7D, remaining, reset),
                _ => match bucket["window"].as_str() {
                    Some("5h") if fallback_5h.is_none() => fallback_5h = window("", remaining, reset),
                    Some("weekly") if fallback_7d.is_none() => fallback_7d = window("", remaining, reset),
                    _ => {}
                },
            }
        }
    }
    out.models.extend(third_party_5h);
    out.models.extend(third_party_7d);
    if out.five_hour.is_none() {
        out.five_hour = fallback_5h;
    }
    if out.seven_day.is_none() {
        out.seven_day = fallback_7d;
    }
    (out.five_hour.is_some() || out.seven_day.is_some() || !out.models.is_empty()).then_some(out)
}

pub(super) fn parse_user_plan(text: &str) -> Option<String> {
    let root = serde_json::from_str::<Value>(text).ok()?;
    let status = &root["userStatus"];
    status["planStatus"]["planInfo"]["planName"]
        .as_str()
        .or_else(|| status["userTier"]["name"].as_str())
        .map(str::trim)
        .filter(|plan| !plan.is_empty())
        .map(str::to_string)
}

fn pool_model_configs<'a>(configs: impl Iterator<Item = (&'a str, &'a Value)>) -> Option<QuotaWindows> {
    let mut gemini: Option<(f64, Option<&str>)> = None;
    let mut third_party: Option<(f64, Option<&str>)> = None;
    for (label, quota) in configs {
        let Some(remaining) = quota["remainingFraction"].as_f64().filter(|v| v.is_finite()) else {
            continue;
        };
        let reset = quota["resetTime"].as_str();
        let is_gemini = label.to_ascii_lowercase().contains("gemini");
        let slot = if is_gemini { &mut gemini } else { &mut third_party };
        if slot.is_none_or(|(best, _)| remaining < best) {
            *slot = Some((remaining, reset));
        }
    }
    let mut out = QuotaWindows::default();
    if let Some((remaining, reset)) = gemini {
        out.five_hour = window("", remaining, reset);
    }
    if let Some((remaining, reset)) = third_party {
        let target = window(THIRD_PARTY_5H, remaining, reset);
        if out.five_hour.is_none() {
            out.five_hour = window("", remaining, reset);
        } else {
            out.models.extend(target);
        }
    }
    (out.five_hour.is_some() || !out.models.is_empty()).then_some(out)
}

pub(super) fn parse_user_status(text: &str) -> Option<QuotaWindows> {
    let root = serde_json::from_str::<Value>(text).ok()?;
    let list = root["userStatus"]["cascadeModelConfigData"]["clientModelConfigs"].as_array()?;
    let items = list.iter().filter_map(|item| {
        let label = item["label"].as_str()?.trim();
        (!label.is_empty()).then_some((label, &item["quotaInfo"]))
    });
    pool_model_configs(items)
}

pub(super) fn parse_command_model_configs(text: &str) -> Option<QuotaWindows> {
    let root = serde_json::from_str::<Value>(text).ok()?;
    let list = root["clientModelConfigs"].as_array()?;
    let items = list.iter().filter_map(|item| {
        let label = item["label"].as_str()?.trim();
        (!label.is_empty()).then_some((label, &item["quotaInfo"]))
    });
    pool_model_configs(items)
}

pub(super) fn parse_cloud_models(text: &str) -> Option<QuotaWindows> {
    let root = serde_json::from_str::<Value>(text).ok()?;
    let models = root["models"].as_object()?;
    let items = models.values().filter_map(|model| {
        if model["isInternal"].as_bool() == Some(true) {
            return None;
        }
        let label = model["displayName"]
            .as_str()
            .or_else(|| model["label"].as_str())?
            .trim();
        (!label.is_empty()).then_some((label, &model["quotaInfo"]))
    });
    pool_model_configs(items)
}

fn gemini_dir() -> Option<PathBuf> {
    super::home_dir().map(|home| home.join(".gemini"))
}

fn read_bounded(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    if file.metadata().ok()?.len() > MAX_TOKEN_FILE_BYTES {
        return None;
    }
    let mut text = String::new();
    file.take(MAX_TOKEN_FILE_BYTES + 1).read_to_string(&mut text).ok()?;
    (text.len() as u64 <= MAX_TOKEN_FILE_BYTES).then_some(text)
}

pub(super) fn parse_token_json(text: &str, now_ms: i64) -> Result<Option<String>, UsageError> {
    let Ok(value) = serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}').trim()) else {
        return Ok(None);
    };
    let inner = value.get("token").filter(|v| v.is_object()).unwrap_or(&value);
    let Some(token) = inner["access_token"]
        .as_str()
        .or_else(|| inner["accessToken"].as_str())
        .map(str::trim)
        .filter(|token| !token.is_empty() && token.bytes().all(|b| (0x21..=0x7e).contains(&b)))
    else {
        return Ok(None);
    };
    let expires_at = inner["expiry"]
        .as_str()
        .or_else(|| inner["expires_at"].as_str())
        .or_else(|| inner["expiresAt"].as_str())
        .and_then(parse_timestamp_ms)
        .or_else(|| inner["expiry_date"].as_i64());
    if expires_at.is_some_and(|expires| expires <= now_ms) {
        return Err(error(
            UsageErrorKind::TokenExpired,
            "The saved Antigravity login token has expired.",
        ));
    }
    Ok(Some(token.to_string()))
}

fn read_saved_token(now_ms: i64) -> Result<String, UsageError> {
    let Some(dir) = gemini_dir() else {
        return Err(error(UsageErrorKind::NoCredentials, "User home directory is unknown."));
    };
    let mut expired: Option<UsageError> = None;
    for name in ["jetski-standalone-oauth-token", "oauth_creds.json"] {
        let Some(text) = read_bounded(&dir.join(name)) else {
            continue;
        };
        match parse_token_json(&text, now_ms) {
            Ok(Some(token)) => return Ok(token),
            Ok(None) => {}
            Err(err) => expired = Some(err),
        }
    }
    Err(expired.unwrap_or_else(|| {
        error(
            UsageErrorKind::NoCredentials,
            "Antigravity is not running and has no saved login token.",
        )
    }))
}

fn cloud_client() -> Result<reqwest::Client, UsageError> {
    let configured = crate::plugin_kernel::builtins::config(background::PLUGIN_ID)
        .get("proxy")
        .and_then(Value::as_str)
        .map(str::to_string);
    let mut builder = reqwest::Client::builder()
        .timeout(CLOUD_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none());
    if let Some(raw_proxy) = source::resolve_proxy(configured.as_deref()) {
        let parsed = source::proxy_url(&raw_proxy)
            .map_err(|err| error(err.kind, err.message))?;
        let proxy = reqwest::Proxy::all(parsed)
            .map_err(|_| error(UsageErrorKind::Network, "Invalid proxy configuration."))?;
        builder = builder.proxy(proxy);
    }
    builder
        .build()
        .map_err(|err| error(UsageErrorKind::Network, format!("Could not build HTTP client: {err}")))
}

async fn cloud_post(client: &reqwest::Client, base: &str, path: &str, token: &str) -> Result<String, UsageError> {
    let mut auth = HeaderValue::from_str(&format!("Bearer {token}"))
        .map_err(|_| error(UsageErrorKind::NoCredentials, "Invalid login token format."))?;
    auth.set_sensitive(true);
    let response = client
        .post(format!("{base}{path}"))
        .header(CONTENT_TYPE, "application/json")
        .header(ACCEPT, "application/json")
        .header(USER_AGENT, "antigravity")
        .header(AUTHORIZATION, auth)
        .body("{}")
        .send()
        .await
        .map_err(|err| {
            error(
                UsageErrorKind::Network,
                format!("Request to Antigravity Cloud Code failed: {}", err.without_url()),
            )
        })?;
    match response.status().as_u16() {
        200..=299 => response.text().await.map_err(|err| {
            error(
                UsageErrorKind::Network,
                format!("Reading Antigravity Cloud Code answer failed: {}", err.without_url()),
            )
        }),
        401 | 403 => Err(error(
            UsageErrorKind::LoginRequired,
            "Antigravity Cloud Code rejected the login token.",
        )),
        404 | 405 | 501 => Err(error(
            UsageErrorKind::EndpointChanged,
            "Antigravity's Cloud Code quota endpoint changed.",
        )),
        429 => Err(error(
            UsageErrorKind::RateLimited,
            "Antigravity Cloud Code rate-limited the request.",
        )),
        status => Err(error(
            UsageErrorKind::Http,
            format!("Antigravity Cloud Code answered HTTP {status}."),
        )),
    }
}

async fn fetch_cloud_code(token: &str) -> Result<QuotaWindows, UsageError> {
    let client = cloud_client()?;
    let mut last_error: Option<UsageError> = None;
    for base in CLOUD_BASES {
        let mut combined: Option<QuotaWindows> = None;
        match cloud_post(&client, base, "/v1internal:retrieveUserQuotaSummary", token).await {
            Ok(body) => combined = parse_quota_summary(&body),
            Err(err) if matches!(err.kind, UsageErrorKind::LoginRequired | UsageErrorKind::RateLimited) => {
                return Err(err);
            }
            Err(err) => last_error = Some(err),
        }
        if combined.as_ref().is_none_or(|windows| windows.five_hour.is_none()) {
            match cloud_post(&client, base, "/v1internal:fetchAvailableModels", token).await {
                Ok(body) => {
                    if let Some(models) = parse_cloud_models(&body) {
                        match &mut combined {
                            Some(existing) => {
                                if existing.five_hour.is_none() {
                                    existing.five_hour = models.five_hour;
                                }
                                if existing.models.is_empty() {
                                    existing.models = models.models;
                                }
                            }
                            None => combined = Some(models),
                        }
                    }
                }
                Err(err) if matches!(err.kind, UsageErrorKind::LoginRequired | UsageErrorKind::RateLimited) => {
                    return Err(err);
                }
                Err(err) => last_error = Some(err),
            }
        }
        if let Some(windows) = combined {
            return Ok(windows);
        }
        last_error.get_or_insert_with(|| {
            error(
                UsageErrorKind::EndpointChanged,
                "Antigravity Cloud Code returned an unrecognized quota payload.",
            )
        });
    }
    Err(last_error.unwrap_or_else(|| {
        error(
            UsageErrorKind::EndpointChanged,
            "Antigravity's quota endpoint is unavailable.",
        )
    }))
}

#[cfg(test)]
#[path = "antigravity_tests.rs"]
mod tests;
