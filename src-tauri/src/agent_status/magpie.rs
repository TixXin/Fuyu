use std::{
    env, fs,
    path::Path,
    sync::{Mutex, OnceLock, PoisonError},
    time::{Duration, Instant},
};

use serde_json::Value;

use super::sessions::parse_timestamp_ms;
use super::usage::{AgentUsage, UsageSource, UsageWindow};

const QUOTAS_PATH: &str = "/v1/magpie/quotas";
const MIN_GAP: Duration = Duration::from_secs(60);
const NOT_MAGPIE_GAP: Duration = Duration::from_secs(10 * 60);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Gateway {
    pub(super) base_url: String,
    pub(super) token: Option<String>,
}

pub(super) fn gateway_from(settings: Option<&Value>, process_env: &dyn Fn(&str) -> Option<String>) -> Option<Gateway> {
    let read = |key: &str| {
        settings
            .and_then(|settings| settings["env"][key].as_str())
            .map(str::to_string)
            .or_else(|| process_env(key))
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    };
    let base_url = read("ANTHROPIC_BASE_URL")?;
    let url = reqwest::Url::parse(&base_url).ok()?;
    let host = url.host_str()?.trim_start_matches('[').trim_end_matches(']');
    let loopback = host.eq_ignore_ascii_case("localhost")
        || host.parse::<std::net::IpAddr>().is_ok_and(|ip| ip.is_loopback());
    (matches!(url.scheme(), "http" | "https") && loopback).then(|| Gateway {
        base_url: base_url.trim_end_matches('/').to_string(),
        token: read("ANTHROPIC_AUTH_TOKEN").or_else(|| read("ANTHROPIC_API_KEY")),
    })
}

fn gateway(claude_dir: &Path) -> Option<Gateway> {
    let settings = fs::read_to_string(claude_dir.join("settings.json"))
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok());
    gateway_from(settings.as_ref(), &|key| env::var(key).ok())
}

fn pick_account(accounts: &[Value]) -> Option<&Value> {
    let has_windows = |account: &&Value| account["windows"].as_array().is_some_and(|windows| !windows.is_empty());
    accounts
        .iter()
        .filter(has_windows)
        .find(|account| account["last"] == Value::Bool(true))
        .or_else(|| {
            accounts
                .iter()
                .filter(has_windows)
                .find(|account| account["provider"].as_str().is_some_and(|provider| provider.ends_with("/claude")))
        })
        .or_else(|| accounts.iter().find(|account| account["windows"].as_array().is_some_and(|windows| windows.iter().any(|window| window["name"] == "5 hours"))))
}

pub(super) fn parse_quotas(text: &str, now_ms: i64) -> Option<AgentUsage> {
    let answer = serde_json::from_str::<Value>(text).ok()?;
    let account = pick_account(answer["data"].as_array()?)?;
    let window = |value: &Value, name: &str| {
        let used = value["used"].as_f64().filter(|used| used.is_finite())?;
        Some(UsageWindow {
            name: name.to_string(),
            used: used.clamp(0.0, 100.0),
            resets_at: value["resetsAt"].as_str().and_then(parse_timestamp_ms),
        })
    };
    let mut usage = AgentUsage {
        updated_at: Some(now_ms),
        five_hour: None,
        seven_day: None,
        models: Vec::new(),
        plan: account["plan"].as_str().map(plan_label),
        source: UsageSource::Magpie,
        error: None,
    };
    for value in account["windows"].as_array()? {
        let Some(name) = value["name"].as_str().map(str::trim) else { continue };
        if name == "5 hours" {
            usage.five_hour = window(value, "");
        } else if name == "7 days" {
            usage.seven_day = window(value, "");
        } else if let Some(model) = name.strip_prefix("7 days").and_then(|rest| rest.trim_start().strip_prefix('·')) {
            usage.models.extend(window(value, model.trim()));
        }
    }
    (usage.five_hour.is_some() || usage.seven_day.is_some() || !usage.models.is_empty()).then_some(usage)
}

fn plan_label(plan: &str) -> String {
    let mut chars = plan.trim().chars();
    chars.next().map(|first| first.to_uppercase().chain(chars).collect()).unwrap_or_default()
}

#[derive(Default)]
struct Cache {
    gateway: Option<Gateway>,
    asked_at: Option<Instant>,
    usage: Option<AgentUsage>,
    not_magpie: bool,
}

fn cache() -> std::sync::MutexGuard<'static, Cache> {
    static CACHE: OnceLock<Mutex<Cache>> = OnceLock::new();
    CACHE.get_or_init(Mutex::default).lock().unwrap_or_else(PoisonError::into_inner)
}

pub(super) async fn read_usage(claude_dir: &Path) -> Option<AgentUsage> {
    let gateway = gateway(claude_dir)?;
    {
        let cache = cache();
        let gap = if cache.not_magpie { NOT_MAGPIE_GAP } else { MIN_GAP };
        let fresh = cache.gateway.as_ref() == Some(&gateway) && cache.asked_at.is_some_and(|at| at.elapsed() < gap);
        if fresh {
            return cache.usage.clone();
        }
    }
    let answer = ask(&gateway).await;
    let mut cache = cache();
    cache.gateway = Some(gateway);
    cache.asked_at = Some(Instant::now());
    cache.not_magpie = answer == Err(Some(404));
    if let Ok(text) = answer {
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |elapsed| i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX));
        if let Some(usage) = parse_quotas(&text, now_ms) {
            cache.usage = Some(usage);
        }
    } else {
        cache.usage = None;
    }
    cache.usage.clone()
}

async fn ask(gateway: &Gateway) -> Result<String, Option<u16>> {
    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| None)?;
    let mut request = client.get(format!("{}{QUOTAS_PATH}", gateway.base_url));
    if let Some(token) = &gateway.token {
        request = request.bearer_auth(token);
    }
    let response = request.send().await.map_err(|_| None)?;
    if !response.status().is_success() {
        return Err(Some(response.status().as_u16()));
    }
    response.text().await.map_err(|_| None)
}
