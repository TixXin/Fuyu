pub(crate) mod config;
pub(crate) mod pac;
pub(crate) mod system_detect;
pub(crate) mod tunnel;
#[cfg(test)]
mod pac_tests;
#[cfg(test)]
mod tests;

use std::{
    io,
    path::PathBuf,
    sync::{Mutex, OnceLock, PoisonError},
    time::{Duration, Instant},
};

use serde_json::{json, Value};
use tauri::{AppHandle, Manager, Url};

use crate::user_error::UserError;

pub use config::{NetworkProxyTestResult, NetworkProxyView, ProxyMode, ProxySettings, SaveNetworkProxyInput};
use pac::Wait;
use config::{build_proxy_url, delete_password, invalid_proxy_input, load_file, parse_bypass_list, read_password, redact_url, save_file, save_password, validate_settings, ProxyTarget, ResolvedProxy};
pub(crate) use tunnel::{connect_fault, ConnectError, ConnectFault, Connected};

const TEST_TARGETS: [&str; 4] = [
    "https://cp.cloudflare.com/generate_204",
    "https://www.apple.com/library/test/success.html",
    "https://www.gstatic.com/generate_204",
    "https://raw.githubusercontent.com/TixXin/fuyu-plugins/main/index.v3.json",
];
const TEST_TIMEOUT: Duration = Duration::from_secs(6);
const SAMPLE_HOSTS: [&str; 3] = ["github.com", "www.google.com", "api.anthropic.com"];
const NETWORK_CHANGE_DEBOUNCE: Duration = Duration::from_secs(2);

struct ProxyState {
    file_path: Option<PathBuf>,
    settings: ProxySettings,
}

static STATE: OnceLock<Mutex<ProxyState>> = OnceLock::new();

fn state() -> &'static Mutex<ProxyState> {
    STATE.get_or_init(|| {
        Mutex::new(ProxyState {
            file_path: None,
            settings: ProxySettings::default(),
        })
    })
}

pub(crate) fn init(app: &AppHandle) {
    let Ok(home) = crate::home_dir::fuyu_home(app.path()) else {
        return;
    };
    let path = home.join(config::FILE_NAME);
    let loaded = load_file(&path);
    let mut guard = state().lock().unwrap_or_else(PoisonError::into_inner);
    guard.file_path = Some(path);
    guard.settings = loaded;
    drop(guard);
    let _ = std::thread::Builder::new().name("proxy-watch".into()).spawn(|| {
        pac::watch_network_changes(on_network_change);
        warm_samples();
    });
}

fn warm_samples() {
    if let Ok(resolved) = resolve_current() {
        let _ = sample_proxy(&resolved, Wait::Block);
    }
}

fn on_network_change() {
    static LAST: Mutex<Option<Instant>> = Mutex::new(None);
    {
        let mut last = LAST.lock().unwrap_or_else(PoisonError::into_inner);
        if last.is_some_and(|at| at.elapsed() < NETWORK_CHANGE_DEBOUNCE) {
            return;
        }
        *last = Some(Instant::now());
    }
    pac::clear_cache();
    let _ = std::thread::Builder::new().name("proxy-warm".into()).spawn(warm_samples);
}

fn current_settings() -> ProxySettings {
    state().lock().unwrap_or_else(PoisonError::into_inner).settings.clone()
}

pub(crate) fn resolve_current() -> Result<ResolvedProxy, UserError> {
    let settings = current_settings();
    let password = if settings.mode == ProxyMode::Manual && !settings.username.is_empty() {
        read_password().ok().flatten()
    } else {
        None
    };
    resolve_for(&settings, password.as_deref())
}

fn resolve_for(settings: &ProxySettings, password: Option<&str>) -> Result<ResolvedProxy, UserError> {
    match settings.mode {
        ProxyMode::Direct => Ok(ResolvedProxy::Direct),
        ProxyMode::System => Ok(system_detect::detect_system()),
        ProxyMode::Manual => {
            let Some(port) = settings.port.filter(|port| *port > 0) else {
                return Ok(ResolvedProxy::Direct);
            };
            if settings.host.trim().is_empty() {
                return Ok(ResolvedProxy::Direct);
            }
            let url = build_proxy_url(settings.scheme, settings.host.trim(), port, &settings.username, password)?;
            Ok(ResolvedProxy::Proxy(ProxyTarget {
                url: url.to_string(),
                bypass: parse_bypass_list(&settings.bypass),
            }))
        }
    }
}

pub(crate) fn sample_proxy(resolved: &ResolvedProxy, wait: Wait) -> Option<String> {
    match resolved {
        ResolvedProxy::Direct => None,
        ResolvedProxy::Proxy(target) => Some(target.url.clone()),
        ResolvedProxy::Auto(_) => SAMPLE_HOSTS
            .iter()
            .find_map(|host| resolved.first_proxy_for("https", host, 443, wait)),
    }
}

pub(crate) fn effective_proxy_url() -> Option<String> {
    sample_proxy(&resolve_current().ok()?, Wait::here())
}

pub(crate) fn proxy_url() -> Result<Option<Url>, UserError> {
    sample_proxy(&resolve_current()?, Wait::here())
        .map(|url| Url::parse(&url).map_err(|error| invalid_proxy_input().detail(error)))
        .transpose()
}

pub(crate) fn reqwest_proxy() -> Result<Option<reqwest::Proxy>, UserError> {
    reqwest_proxy_from(&resolve_current()?)
}

fn reqwest_proxy_from(resolved: &ResolvedProxy) -> Result<Option<reqwest::Proxy>, UserError> {
    match resolved {
        ResolvedProxy::Direct => Ok(None),
        ResolvedProxy::Proxy(target) => {
            let no_proxy = reqwest::NoProxy::from_string(&target.no_proxy_header());
            let proxy = reqwest::Proxy::all(&target.url)
                .map_err(|error| invalid_proxy_input().detail(error.without_url()))?
                .no_proxy(no_proxy);
            Ok(Some(proxy))
        }
        ResolvedProxy::Auto(_) => {
            let resolved = resolved.clone();
            Ok(Some(reqwest::Proxy::custom(move |url| {
                let (scheme, host, port) = pac::url_parts(url)?;
                let proxy = resolved.first_proxy_for(scheme, host, port, Wait::here())?;
                reqwest::Url::parse(&proxy).ok()
            })))
        }
    }
}

pub(crate) fn apply_reqwest(builder: reqwest::ClientBuilder) -> Result<reqwest::ClientBuilder, UserError> {
    let resolved = resolve_current()?;
    apply_reqwest_resolved(builder, &resolved)
}

fn apply_reqwest_resolved(
    builder: reqwest::ClientBuilder,
    resolved: &ResolvedProxy,
) -> Result<reqwest::ClientBuilder, UserError> {
    match reqwest_proxy_from(resolved)? {
        Some(proxy) => Ok(builder.proxy(proxy)),
        None => Ok(builder.no_proxy()),
    }
}

pub(crate) fn should_use_proxy_for(host: &str, port: u16) -> bool {
    resolve_current().is_ok_and(|resolved| resolved.first_proxy_for("https", host, port, Wait::here()).is_some())
}

pub(crate) fn connect_tcp_traced(host: &str, port: u16, timeout: Duration) -> io::Result<Connected> {
    let resolved = resolve_current().map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, error.to_string()))?;
    tunnel::connect_hops(&resolved.hops_for(host, port), host, port, timeout)
}

pub(crate) fn host_payload() -> Value {
    match resolve_current() {
        Ok(ResolvedProxy::Proxy(target)) => json!({
            "url": target.url,
            "bypass": target.bypass,
        }),
        Ok(resolved @ ResolvedProxy::Auto(_)) => match sample_proxy(&resolved, Wait::here()) {
            Some(url) => json!({ "url": url, "bypass": [] }),
            None => Value::Null,
        },
        _ => Value::Null,
    }
}

fn build_view(settings: &ProxySettings) -> NetworkProxyView {
    let has_password = read_password().ok().flatten().is_some();
    let system = system_detect::detect_system();
    let system_proxy = sample_proxy(&system, Wait::Block).map(|url| redact_url(&url));
    let (system_pac, system_wpad) = match &system {
        ResolvedProxy::Auto(auto) => (auto.pac.script_label(), auto.pac == pac::PacSource::Discover),
        _ => (None, false),
    };
    NetworkProxyView {
        mode: settings.mode,
        scheme: settings.scheme,
        host: settings.host.clone(),
        port: settings.port,
        username: settings.username.clone(),
        has_password,
        bypass: settings.bypass.clone(),
        system_proxy,
        system_pac,
        system_wpad,
    }
}

#[tauri::command]
pub async fn get_network_proxy() -> Result<NetworkProxyView, UserError> {
    let settings = current_settings();
    tauri::async_runtime::spawn_blocking(move || build_view(&settings))
        .await
        .map_err(|error| UserError::new("internal", "Could not read proxy settings.").detail(error))
}

#[tauri::command]
pub async fn save_network_proxy(app: AppHandle, input: SaveNetworkProxyInput) -> Result<NetworkProxyView, UserError> {
    let validated = validate_settings(&input)?;
    let password_update = input.password;
    let view = tauri::async_runtime::spawn_blocking(move || -> Result<NetworkProxyView, UserError> {
        if validated.username.is_empty() {
            if matches!(password_update.as_deref(), Some("")) {
                delete_password()?;
            }
        } else if let Some(secret) = password_update {
            save_password(&secret)?;
        }
        let path = {
            let guard = state().lock().unwrap_or_else(PoisonError::into_inner);
            guard.file_path.clone()
        }
        .or_else(|| crate::home_dir::fuyu_home(app.path()).ok().map(|home| home.join(config::FILE_NAME)))
        .ok_or_else(|| UserError::new("internal", "Could not locate the data folder."))?;
        save_file(&path, &validated)?;
        {
            let mut guard = state().lock().unwrap_or_else(PoisonError::into_inner);
            guard.file_path = Some(path);
            guard.settings = validated.clone();
        }
        pac::clear_cache();
        Ok(build_view(&validated))
    })
    .await
    .map_err(|error| UserError::new("internal", "Could not save proxy settings.").detail(error))??;
    crate::plugin_kernel::notify_proxy_changed();
    Ok(view)
}

#[tauri::command]
pub async fn test_network_proxy(input: SaveNetworkProxyInput) -> Result<NetworkProxyTestResult, UserError> {
    let validated = validate_settings(&input)?;
    let password = match input.password {
        Some(secret) if !secret.is_empty() => Some(secret),
        Some(_) => None,
        None => tauri::async_runtime::spawn_blocking(read_password)
            .await
            .map_err(|error| UserError::new("internal", "Could not read saved proxy password.").detail(error))?
            .ok()
            .flatten(),
    };
    let resolved = resolve_for(&validated, password.as_deref())?;
    let (resolved, via) = tauri::async_runtime::spawn_blocking(move || {
        let via = sample_proxy(&resolved, Wait::Block).map(|url| redact_url(&url));
        (resolved, via)
    })
    .await
    .map_err(|error| UserError::new("internal", "Could not read proxy settings.").detail(error))?;
    let builder = reqwest::Client::builder()
        .timeout(TEST_TIMEOUT)
        .user_agent(concat!("Fuyu/", env!("CARGO_PKG_VERSION")));
    let client = apply_reqwest_resolved(builder, &resolved)?
        .build()
        .map_err(|error| UserError::new("http.client", "Could not set up the connection.").detail(error.without_url()))?;
    probe_targets(&client, &TEST_TARGETS, via).await
}

pub(super) async fn probe_targets(
    client: &reqwest::Client,
    targets: &[&str],
    via: Option<String>,
) -> Result<NetworkProxyTestResult, UserError> {
    let mut last_error: Option<String> = None;
    for &target in targets {
        let cold_start = Instant::now();
        match client.get(target).send().await {
            Ok(response) if response.status().as_u16() < 500 => {
                let _ = response.bytes().await;
                let cold_ms = cold_start.elapsed().as_millis() as u64;
                let warm_start = Instant::now();
                let latency_ms = match client.get(target).send().await {
                    Ok(warm) if warm.status().as_u16() < 500 => {
                        let _ = warm.bytes().await;
                        warm_start.elapsed().as_millis() as u64
                    }
                    _ => cold_ms,
                };
                return Ok(NetworkProxyTestResult {
                    ok: true,
                    latency_ms,
                    target: target.to_string(),
                    via,
                });
            }
            Ok(response) => {
                let status = response.status().as_u16();
                let _ = response.bytes().await;
                last_error = Some(format!("HTTP {status}"));
            }
            Err(error) => {
                last_error = Some(error.without_url().to_string());
            }
        }
    }
    Err(UserError::new("net.proxyTestFailed", "Could not reach the network through this proxy.")
        .detail(last_error.unwrap_or_else(|| "connection failed".to_string())))
}
