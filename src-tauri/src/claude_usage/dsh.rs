use std::{
    ffi::{OsStr, OsString},
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock, PoisonError},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use reqwest::header::{HeaderValue, ACCEPT, AUTHORIZATION};
use serde_json::Value;

use super::{
    background,
    dsh_credentials::{self, DshCredential},
    source, DshWallet, HoverUsage, UsageError, UsageErrorKind,
};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(8);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(4);
const CACHE_MS: i64 = 60_000;
const REFRESH_GAP_MS: i64 = 10_000;
const MAX_CHECKPOINT_BYTES: u64 = 512 * 1024;
const MAX_POINTER_BYTES: u64 = 64 * 1024;
const MAX_CHECKPOINTS_SCANNED: usize = 48;
const API_BALANCE_URL: &str = "https://api.deepseek.com/user/balance";
const ACCOUNT_SUMMARY_URL: &str = "https://platform.deepseek.com/api/v0/users/get_user_summary";

const HOME_VARS: [&str; 2] = ["DSH_HOME", "DSH_DESKTOP_NEXT_HOME"];
const POINTER_FILES: [(&str, &str, &str); 5] = [
    ("DSH NEXT/home", "desktop-next-location.json", "home"),
    ("DSH NEXT/home", "desktop-next-last-home.json", "home"),
    ("DSH Desktop Beta/home", "desktop-next-location.json", "home"),
    ("DSH Desktop Beta/home", "desktop-next-last-home.json", "home"),
    ("DSH Desktop/data-directory", "state.json", "activeHome"),
];

struct CachedEntry {
    key_hash: [u8; 32],
    asked_at: i64,
    usage: HoverUsage,
}

fn cache() -> &'static Mutex<Option<CachedEntry>> {
    static CACHE: OnceLock<Mutex<Option<CachedEntry>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| i64::try_from(since.as_millis()).unwrap_or(i64::MAX))
}

fn error(kind: UsageErrorKind, message: impl Into<String>) -> UsageError {
    UsageError { kind, message: message.into() }
}

fn empty(err: Option<UsageError>) -> HoverUsage {
    HoverUsage {
        provider: "dsh".to_string(),
        updated_at: None,
        source: None,
        available: None,
        credits: None,
        wallets: Vec::new(),
        error: err,
    }
}

pub(super) async fn read(refresh: bool) -> HoverUsage {
    let now = now_ms();
    let located = tauri::async_runtime::spawn_blocking(|| {
        let home = super::home_dir().ok_or_else(|| {
            error(UsageErrorKind::NoSessions, "User home directory is unknown.")
        })?;
        locate_credential(&dsh_roots(&home, |key| std::env::var_os(key)))
    })
    .await;

    let credential = match located {
        Ok(Ok(cred)) => cred,
        Ok(Err(failure)) => return empty(Some(failure)),
        Err(_) => return empty(Some(error(UsageErrorKind::Network, "Could not inspect DSH files."))),
    };

    let key_hash = credential.hash();
    let previous = {
        let guard = cache().lock().unwrap_or_else(PoisonError::into_inner);
        guard.as_ref().filter(|entry| entry.key_hash == key_hash).map(|entry| (entry.asked_at, entry.usage.clone()))
    };
    if let Some((asked_at, cached)) = &previous {
        let ttl = if refresh { REFRESH_GAP_MS } else { CACHE_MS };
        if now.saturating_sub(*asked_at) < ttl {
            return cached.clone();
        }
    }

    let usage = match fetch_wallets(&credential, now).await {
        Ok(usage) => usage,
        Err(failure) => {
            let mut base = previous.map(|(_, cached)| cached).unwrap_or_else(|| empty(None));
            base.error = Some(failure);
            base
        }
    };
    *cache().lock().unwrap_or_else(PoisonError::into_inner) = Some(CachedEntry {
        key_hash,
        asked_at: now,
        usage: usage.clone(),
    });
    usage
}

fn app_data_dir(home: &Path) -> PathBuf {
    if cfg!(windows) {
        home.join("AppData").join("Roaming")
    } else if cfg!(target_os = "macos") {
        home.join("Library").join("Application Support")
    } else {
        home.join(".config")
    }
}

fn expand_home_path(raw: &OsStr, home: &Path) -> Option<PathBuf> {
    let text = raw.to_string_lossy();
    let text = text.trim();
    let path = if text == "~" {
        home.to_path_buf()
    } else if let Some(rest) = text.strip_prefix("~/").or_else(|| text.strip_prefix("~\\")) {
        home.join(rest)
    } else {
        PathBuf::from(text)
    };
    (!text.is_empty() && path.is_absolute()).then_some(path)
}

fn pointer_home(app_data: &Path, (dir, file, key): (&str, &str, &str)) -> Option<PathBuf> {
    let path = dir.split('/').fold(app_data.to_path_buf(), |acc, part| acc.join(part)).join(file);
    let bytes = fs::read(&path).ok().filter(|bytes| bytes.len() as u64 <= MAX_POINTER_BYTES)?;
    let value = serde_json::from_slice::<Value>(&bytes).ok()?;
    let target = PathBuf::from(value[key].as_str()?);
    target.is_absolute().then_some(target)
}

pub(super) fn dsh_roots(home: &Path, var: impl Fn(&str) -> Option<OsString>) -> Vec<PathBuf> {
    let app_data = app_data_dir(home);
    let mut roots = Vec::new();
    let candidates = HOME_VARS
        .iter()
        .filter_map(|name| var(name).and_then(|val| expand_home_path(&val, home)))
        .chain([
            home.join(".dsh"),
            home.join(".dsh-beta"),
            home.join("AppData").join("Roaming").join("dsh-desktop").join("harness"),
            app_data.join("dshed").join("dsh"),
        ])
        .chain(POINTER_FILES.into_iter().filter_map(|spec| pointer_home(&app_data, spec)));
    for root in candidates {
        if !roots.contains(&root) {
            roots.push(root);
        }
    }
    roots
}

fn latest_checkpoint_route(root: &Path) -> Option<(SystemTime, String)> {
    let dir = root.join("storages").join("session_projcache").join("sessions");
    let mut entries: Vec<(SystemTime, PathBuf)> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            (path.extension().and_then(|ext| ext.to_str()) == Some("json"))
                .then(|| Some((entry.metadata().ok()?.modified().ok()?, path)))
                .flatten()
        })
        .collect();
    entries.sort_by_key(|(modified, _)| std::cmp::Reverse(*modified));
    for (modified, path) in entries.into_iter().take(MAX_CHECKPOINTS_SCANNED) {
        let Ok(file) = fs::File::open(&path) else { continue };
        let Ok(meta) = file.metadata() else { continue };
        if meta.len() > MAX_CHECKPOINT_BYTES {
            continue;
        }
        let mut bytes = Vec::new();
        if file.take(MAX_CHECKPOINT_BYTES + 1).read_to_end(&mut bytes).is_err() || bytes.len() as u64 > MAX_CHECKPOINT_BYTES {
            continue;
        }
        let Ok(value) = serde_json::from_slice::<Value>(&bytes) else { continue };
        if value["version"].as_u64().is_none_or(|v| v < 3) {
            continue;
        }
        let rows = &value["record"]["rows"];
        if rows["sessionListMetadata"]["val"]["blank"].as_bool() != Some(false) {
            continue;
        }
        if let Some(provider) = rows["modelSelection"]["val"]["lastUsed"]["provider"]
            .as_str()
            .filter(|s| !s.is_empty())
        {
            return Some((modified, provider.to_string()));
        }
    }
    None
}

pub(super) fn locate_credential(roots: &[PathBuf]) -> Result<DshCredential, UsageError> {
    let existing: Vec<&PathBuf> = roots.iter().filter(|root| root.is_dir()).collect();
    if existing.is_empty() {
        return Err(error(UsageErrorKind::NoSessions, "DeepSeek Harness is not installed."));
    }
    let newest = existing
        .iter()
        .filter_map(|root| latest_checkpoint_route(root).map(|(at, route)| (at, *root, route)))
        .max_by_key(|(at, _, _)| *at);

    if let Some((_, root, route)) = newest {
        if !matches!(route.as_str(), "deepseek-official" | "deepseek-account") {
            return Err(error(
                UsageErrorKind::CustomEndpoint,
                "The active DSH session uses a custom model provider.",
            ));
        }
        if !dsh_credentials::route_is_official(root) {
            return Err(error(
                UsageErrorKind::CustomEndpoint,
                "DSH is configured with a custom gateway endpoint.",
            ));
        }
        return dsh_credentials::read_credential(root, &route).ok_or_else(|| {
            error(
                UsageErrorKind::NoCredentials,
                "No DeepSeek credential found in DSH's .credentials.yaml.",
            )
        });
    }

    for root in &existing {
        if !dsh_credentials::route_is_official(root) {
            return Err(error(
                UsageErrorKind::CustomEndpoint,
                "DSH is configured with a custom gateway endpoint.",
            ));
        }
        for route in ["deepseek-official", "deepseek-account"] {
            if let Some(cred) = dsh_credentials::read_credential(root, route) {
                return Ok(cred);
            }
        }
    }

    let any_cred_file = existing.iter().any(|root| root.join(".credentials.yaml").is_file());
    if any_cred_file {
        Err(error(
            UsageErrorKind::NoCredentials,
            "No DeepSeek API key or account login found in .credentials.yaml.",
        ))
    } else {
        Err(error(
            UsageErrorKind::NoSessions,
            "No DeepSeek Harness sessions or credentials found.",
        ))
    }
}

fn decimal_amount(value: &Value) -> Option<String> {
    let raw = match value {
        Value::String(text) => text.trim().to_string(),
        Value::Number(num) => num.to_string(),
        _ => return None,
    };
    let parsed = raw.parse::<f64>().ok()?;
    (raw.len() <= 64 && parsed.is_finite()).then_some(raw)
}

pub(super) fn sum_decimal_strings(left: &str, right: &str) -> Option<String> {
    let parse_scaled = |text: &str| -> Option<(i128, u32)> {
        let text = text.trim();
        let negative = text.starts_with('-');
        let unsigned = text.trim_start_matches(['-', '+']);
        let (whole, frac) = unsigned.split_once('.').unwrap_or((unsigned, ""));
        let digits = format!("{whole}{frac}");
        if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) || frac.len() > 18 {
            return None;
        }
        let coeff = digits.parse::<i128>().ok()?;
        Some((if negative { coeff.checked_neg()? } else { coeff }, frac.len() as u32))
    };
    let (a, scale_a) = parse_scaled(left)?;
    let (b, scale_b) = parse_scaled(right)?;
    let scale = scale_a.max(scale_b);
    let total = a
        .checked_mul(10_i128.checked_pow(scale - scale_a)?)?
        .checked_add(b.checked_mul(10_i128.checked_pow(scale - scale_b)?)?)?;
    if total == 0 {
        return Some("0.00".to_string());
    }
    let sign = if total < 0 { "-" } else { "" };
    let mut digits = total.unsigned_abs().to_string();
    if scale == 0 {
        return Some(format!("{sign}{digits}"));
    }
    while digits.len() <= scale as usize {
        digits.insert(0, '0');
    }
    digits.insert(digits.len() - scale as usize, '.');
    Some(format!("{sign}{digits}"))
}

pub(super) fn parse_api_balance(text: &str, now: i64) -> Result<HoverUsage, UsageError> {
    let invalid = || error(UsageErrorKind::InvalidResponse, "Unrecognized DeepSeek API balance response.");
    let root = serde_json::from_str::<Value>(text).map_err(|_| invalid())?;
    let available = root["is_available"].as_bool().ok_or_else(invalid)?;
    let infos = root["balance_infos"].as_array().ok_or_else(invalid)?;
    let mut wallets = Vec::new();
    for item in infos {
        let Some(currency) = item["currency"].as_str().filter(|c| matches!(*c, "CNY" | "USD")) else {
            continue;
        };
        wallets.push(DshWallet {
            currency: currency.to_string(),
            total: decimal_amount(&item["total_balance"]).ok_or_else(invalid)?,
            topped_up: decimal_amount(&item["topped_up_balance"]).ok_or_else(invalid)?,
            granted: decimal_amount(&item["granted_balance"]).ok_or_else(invalid)?,
        });
    }
    if wallets.is_empty() {
        return Err(invalid());
    }
    Ok(HoverUsage {
        provider: "dsh".to_string(),
        updated_at: Some(now),
        source: Some("dshApi".to_string()),
        available: Some(available),
        credits: None,
        wallets,
        error: None,
    })
}

pub(super) fn parse_account_summary(text: &str, now: i64) -> Result<HoverUsage, UsageError> {
    let invalid = || error(UsageErrorKind::InvalidResponse, "Unrecognized DeepSeek account wallet response.");
    let root = serde_json::from_str::<Value>(text).map_err(|_| invalid())?;
    if root["code"].as_i64() != Some(0) || root["data"]["biz_code"].as_i64() != Some(0) {
        return Err(error(
            UsageErrorKind::LoginRequired,
            "DeepSeek account login token has expired or been revoked.",
        ));
    }
    let data = &root["data"]["biz_data"];
    let normal = data["normal_wallets"].as_array().ok_or_else(invalid)?;
    let bonus = data["bonus_wallets"].as_array().ok_or_else(invalid)?;
    let mut wallets = Vec::new();
    for currency in ["CNY", "USD"] {
        if !normal.iter().chain(bonus).any(|w| w["currency"].as_str() == Some(currency)) {
            continue;
        }
        let pick = |list: &[Value]| -> Option<String> {
            match list.iter().find(|w| w["currency"].as_str() == Some(currency)) {
                Some(entry) => decimal_amount(&entry["balance"]),
                None => Some("0.00".to_string()),
            }
        };
        let topped_up = pick(normal).ok_or_else(invalid)?;
        let granted = pick(bonus).ok_or_else(invalid)?;
        let total = sum_decimal_strings(&topped_up, &granted).ok_or_else(invalid)?;
        wallets.push(DshWallet {
            currency: currency.to_string(),
            total,
            topped_up,
            granted,
        });
    }
    if wallets.is_empty() {
        return Err(invalid());
    }
    let available = wallets
        .iter()
        .any(|w| w.total.parse::<f64>().is_ok_and(|v| v > 0.0));
    Ok(HoverUsage {
        provider: "dsh".to_string(),
        updated_at: Some(now),
        source: Some("dshAccount".to_string()),
        available: Some(available),
        credits: None,
        wallets,
        error: None,
    })
}

async fn send_once(client: &reqwest::Client, credential: &DshCredential, now: i64) -> Result<HoverUsage, UsageError> {
    let request = match credential {
        DshCredential::ApiKey(key) => {
            let mut auth = HeaderValue::from_str(&format!("Bearer {key}"))
                .map_err(|_| error(UsageErrorKind::NoCredentials, "Invalid API key format."))?;
            auth.set_sensitive(true);
            client.get(API_BALANCE_URL).header(AUTHORIZATION, auth).header(ACCEPT, "application/json")
        }
        DshCredential::AccountToken(token) => {
            let mut header = HeaderValue::from_str(token)
                .map_err(|_| error(UsageErrorKind::NoCredentials, "Invalid account token format."))?;
            header.set_sensitive(true);
            client.get(ACCOUNT_SUMMARY_URL).header("x-dsh-auth-token", header).header(ACCEPT, "application/json")
        }
    };
    let response = request.send().await.map_err(|err| {
        error(
            UsageErrorKind::Network,
            format!("Request to DeepSeek failed: {}", err.without_url()),
        )
    })?;
    match response.status().as_u16() {
        200..=299 => {}
        401 | 403 => {
            return Err(error(
                UsageErrorKind::LoginRequired,
                "DeepSeek rejected the credential.",
            ))
        }
        429 => {
            return Err(error(
                UsageErrorKind::RateLimited,
                "DeepSeek rate-limited the balance request.",
            ))
        }
        status => {
            return Err(error(
                UsageErrorKind::Http,
                format!("DeepSeek answered HTTP {status}."),
            ))
        }
    }
    let text = response.text().await.map_err(|err| {
        error(
            UsageErrorKind::Network,
            format!("Reading DeepSeek balance failed: {}", err.without_url()),
        )
    })?;
    match credential {
        DshCredential::ApiKey(_) => parse_api_balance(&text, now),
        DshCredential::AccountToken(_) => parse_account_summary(&text, now),
    }
}

async fn fetch_wallets(credential: &DshCredential, now: i64) -> Result<HoverUsage, UsageError> {
    let direct = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|err| error(UsageErrorKind::Network, format!("Could not build HTTP client: {err}")))?;

    match send_once(&direct, credential, now).await {
        Err(first) if first.kind == UsageErrorKind::Network => {
            let configured = crate::plugin_kernel::builtins::config(background::PLUGIN_ID)
                .get("proxy")
                .and_then(Value::as_str)
                .map(str::to_string);
            if let Some(raw_proxy) = source::resolve_proxy(configured.as_deref()) {
                if let Ok(parsed) = source::proxy_url(&raw_proxy) {
                    if let Ok(proxy) = reqwest::Proxy::all(parsed) {
                        if let Ok(proxied) = reqwest::Client::builder()
                            .connect_timeout(CONNECT_TIMEOUT)
                            .timeout(REQUEST_TIMEOUT)
                            .proxy(proxy)
                            .redirect(reqwest::redirect::Policy::none())
                            .build()
                        {
                            return send_once(&proxied, credential, now).await;
                        }
                    }
                }
            }
            Err(first)
        }
        other => other,
    }
}

#[cfg(test)]
#[path = "dsh_tests.rs"]
mod tests;
