use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock, PoisonError},
    time::{Duration, Instant},
};

use tauri::Url;

use super::config::{redact_url, Hop};

const ROUTE_TTL: Duration = Duration::from_secs(300);
const FAILURE_TTL: Duration = Duration::from_secs(600);
const CACHE_LIMIT: usize = 512;
#[cfg(any(windows, target_os = "macos"))]
const EVALUATE_TIMEOUT: Duration = Duration::from_secs(8);
#[cfg(target_os = "macos")]
const WPAD_SCRIPT_URL: &str = "http://wpad/wpad.dat";

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) enum PacSource {
    Script(String),
    Discover,
}

impl PacSource {
    pub(crate) fn script_label(&self) -> Option<String> {
        match self {
            PacSource::Script(url) => Some(redact_url(url)),
            PacSource::Discover => None,
        }
    }
}

#[derive(Default)]
struct Cache {
    routes: HashMap<(PacSource, String), (Instant, Vec<Hop>)>,
    failures: HashMap<PacSource, Instant>,
}

static CACHE: OnceLock<Mutex<Cache>> = OnceLock::new();

fn cache() -> std::sync::MutexGuard<'static, Cache> {
    CACHE.get_or_init(Mutex::default).lock().unwrap_or_else(PoisonError::into_inner)
}

pub(crate) fn clear_cache() {
    let mut guard = cache();
    guard.routes.clear();
    guard.failures.clear();
}

pub(crate) fn target_url(scheme: &str, host: &str, port: u16) -> String {
    let bare = host.trim().trim_start_matches('[').trim_end_matches(']').to_ascii_lowercase();
    let host_text = if bare.contains(':') { format!("[{bare}]") } else { bare };
    let default_port = match scheme {
        "http" => 80,
        _ => 443,
    };
    if port == default_port {
        format!("{scheme}://{host_text}/")
    } else {
        format!("{scheme}://{host_text}:{port}/")
    }
}

pub(crate) fn url_parts(url: &Url) -> Option<(&str, &str, u16)> {
    let scheme = match url.scheme() {
        "http" => "http",
        _ => "https",
    };
    Some((scheme, url.host_str()?, url.port_or_known_default()?))
}

pub(crate) fn resolve(source: &PacSource, url: &str) -> Option<Vec<Hop>> {
    resolve_with(source, url, evaluate)
}

pub(crate) fn resolve_with(
    source: &PacSource,
    url: &str,
    evaluator: impl FnOnce(&PacSource, &str) -> Result<String, String>,
) -> Option<Vec<Hop>> {
    let now = Instant::now();
    let key = (source.clone(), url.to_string());
    {
        let guard = cache();
        if guard.failures.get(source).is_some_and(|at| now.duration_since(*at) < FAILURE_TTL) {
            return None;
        }
        if let Some((at, hops)) = guard.routes.get(&key) {
            if now.duration_since(*at) < ROUTE_TTL {
                return Some(hops.clone());
            }
        }
    }
    match evaluator(source, url) {
        Ok(raw) => {
            let hops = parse_pac_result(&raw);
            let mut guard = cache();
            if guard.routes.len() >= CACHE_LIMIT {
                guard.routes.retain(|_, (at, _)| now.duration_since(*at) < ROUTE_TTL);
                if guard.routes.len() >= CACHE_LIMIT {
                    guard.routes.clear();
                }
            }
            guard.failures.remove(source);
            guard.routes.insert(key, (now, hops.clone()));
            Some(hops)
        }
        Err(error) => {
            eprintln!(
                "[proxy] automatic proxy configuration {} failed: {error}",
                source.script_label().unwrap_or_else(|| "(WPAD)".to_string())
            );
            cache().failures.insert(source.clone(), now);
            None
        }
    }
}

pub(crate) fn parse_pac_result(raw: &str) -> Vec<Hop> {
    let mut hops = Vec::new();
    for entry in raw.split(';') {
        let tokens: Vec<&str> = entry.split_whitespace().collect();
        let mut index = 0;
        while index < tokens.len() {
            let keyword = tokens[index].to_ascii_uppercase();
            let next = tokens.get(index + 1).copied();
            let (hop, used) = match keyword.as_str() {
                "DIRECT" => (Some(Hop::Direct), 1),
                "PROXY" | "HTTP" => (next.and_then(|server| proxy_hop("http", server)), 2),
                "HTTPS" => (next.and_then(|server| proxy_hop("https", server)), 2),
                "SOCKS" | "SOCKS5" => (next.and_then(|server| proxy_hop("socks5h", server)), 2),
                "SOCKS4" | "SOCKS4A" | "QUIC" => (None, 2),
                _ => (bare_hop(tokens[index]), 1),
            };
            if let Some(hop) = hop {
                if !hops.contains(&hop) {
                    hops.push(hop);
                }
            }
            index += used;
        }
    }
    hops
}

fn bare_hop(token: &str) -> Option<Hop> {
    if let Some((kind, server)) = token.split_once('=') {
        return match kind.to_ascii_lowercase().as_str() {
            "http" | "https" => proxy_hop("http", server),
            "socks" | "socks5" => proxy_hop("socks5h", server),
            _ => None,
        };
    }
    if let Some((scheme, server)) = token.split_once("://") {
        return match scheme.to_ascii_lowercase().as_str() {
            "http" => proxy_hop("http", server),
            "https" => proxy_hop("https", server),
            "socks" | "socks5" | "socks5h" => proxy_hop("socks5h", server),
            _ => None,
        };
    }
    proxy_hop("http", token)
}

fn proxy_hop(scheme: &str, server: &str) -> Option<Hop> {
    let server = server.trim().trim_end_matches('/');
    let server = server.split_once("://").map_or(server, |(_, rest)| rest);
    if server.is_empty() || server.contains(['/', '@', '?', '#']) {
        return None;
    }
    let candidate = format!("{scheme}://{server}");
    let parsed = Url::parse(&candidate).ok()?;
    parsed.host_str().filter(|host| !host.is_empty())?;
    Some(Hop::Proxy(candidate))
}

#[cfg(windows)]
fn evaluate(source: &PacSource, url: &str) -> Result<String, String> {
    let script = match source {
        PacSource::Script(script) => Some(script.as_str()),
        PacSource::Discover => None,
    };
    crate::win32::winhttp_proxy::proxy_for_url(script, url, EVALUATE_TIMEOUT)
}

#[cfg(target_os = "macos")]
fn evaluate(source: &PacSource, url: &str) -> Result<String, String> {
    let script = match source {
        PacSource::Script(script) => script.as_str(),
        PacSource::Discover => WPAD_SCRIPT_URL,
    };
    crate::macos::pac::proxy_for_url(script, url, EVALUATE_TIMEOUT)
}

#[cfg(not(any(windows, target_os = "macos")))]
fn evaluate(_source: &PacSource, _url: &str) -> Result<String, String> {
    Err("automatic proxy configuration is not supported on this platform".to_string())
}
