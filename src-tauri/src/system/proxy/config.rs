use std::net::IpAddr;
use std::path::Path;

use keyring::{Entry, Error as KeyringError};
use serde::{Deserialize, Serialize};
use tauri::Url;

use crate::user_error::{credential as cred_err, UserError};

pub(crate) const FILE_NAME: &str = "network-proxy.json";
const CREDENTIAL_SERVICE: &str = "com.tixxin.fuyu.network-proxy";
const CREDENTIAL_ACCOUNT: &str = "proxy";
const LOOPBACK_BYPASS: [&str; 3] = ["localhost", "127.0.0.1", "::1"];

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProxyMode {
    #[default]
    System,
    Manual,
    Direct,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProxyScheme {
    #[default]
    Http,
    Socks5,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxySettings {
    #[serde(default)]
    pub mode: ProxyMode,
    #[serde(default)]
    pub scheme: ProxyScheme,
    #[serde(default)]
    pub host: String,
    #[serde(default)]
    pub port: Option<u16>,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub bypass: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProxyView {
    pub mode: ProxyMode,
    pub scheme: ProxyScheme,
    pub host: String,
    pub port: Option<u16>,
    pub username: String,
    pub has_password: bool,
    pub bypass: String,
    pub system_proxy: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveNetworkProxyInput {
    #[serde(default)]
    pub mode: ProxyMode,
    #[serde(default)]
    pub scheme: ProxyScheme,
    #[serde(default)]
    pub host: String,
    #[serde(default)]
    pub port: Option<u16>,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub bypass: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProxyTestResult {
    pub ok: bool,
    pub latency_ms: u64,
    pub target: String,
    pub via: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ProxyTarget {
    pub(crate) url: String,
    pub(crate) bypass: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ResolvedProxy {
    Direct,
    Proxy(ProxyTarget),
}

impl ProxyTarget {
    pub(crate) fn no_proxy_header(&self) -> String {
        let mut entries = Vec::with_capacity(self.bypass.len() + LOOPBACK_BYPASS.len());
        for entry in LOOPBACK_BYPASS {
            entries.push(entry.to_string());
        }
        for entry in &self.bypass {
            if !entries.iter().any(|existing| existing.eq_ignore_ascii_case(entry)) {
                entries.push(entry.clone());
            }
        }
        entries.join(",")
    }

    pub(crate) fn should_bypass(&self, host: &str) -> bool {
        let host = host.trim().trim_start_matches('[').trim_end_matches(']').to_ascii_lowercase();
        if host.is_empty() || is_loopback_host(&host) {
            return true;
        }
        self.bypass.iter().any(|pattern| matches_bypass(&host, pattern))
    }
}

pub(crate) fn is_loopback_host(host: &str) -> bool {
    let normalized = host.trim().trim_start_matches('[').trim_end_matches(']');
    if normalized.eq_ignore_ascii_case("localhost") || normalized.ends_with(".localhost") {
        return true;
    }
    normalized.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback())
}

pub(crate) fn parse_bypass_list(raw: &str) -> Vec<String> {
    let mut list = Vec::new();
    for item in raw.split([',', ';', '\n', '\r']) {
        let trimmed = item.trim();
        if trimmed.is_empty() {
            continue;
        }
        let cleaned = trimmed
            .split_once("://")
            .map_or(trimmed, |(_, rest)| rest)
            .split('/')
            .next()
            .unwrap_or(trimmed)
            .trim();
        if cleaned.is_empty() {
            continue;
        }
        if !list.iter().any(|existing: &String| existing.eq_ignore_ascii_case(cleaned)) {
            list.push(cleaned.to_string());
        }
    }
    list
}

fn matches_bypass(host: &str, pattern: &str) -> bool {
    let pattern = pattern.trim().to_ascii_lowercase();
    if pattern.is_empty() {
        return false;
    }
    if pattern == "*" {
        return true;
    }
    if pattern == "<local>" {
        return !host.contains('.');
    }
    let pattern = match pattern.rsplit_once(':') {
        Some((before, port)) if !before.contains(':') && port.chars().all(|c| c.is_ascii_digit()) => before,
        _ => pattern.as_str(),
    };
    let pattern = pattern.trim_start_matches('[').trim_end_matches(']');
    if let Some(suffix) = pattern.strip_prefix("*.") {
        return host == suffix || host.ends_with(&format!(".{suffix}"));
    }
    if let Some(suffix) = pattern.strip_prefix('.') {
        return host == suffix || host.ends_with(&format!(".{suffix}"));
    }
    if let Some(prefix) = pattern.strip_suffix(".*") {
        return host.starts_with(&format!("{prefix}."));
    }
    host == pattern
}

pub(crate) fn normalize_host_and_port(
    scheme: ProxyScheme,
    raw_host: &str,
    raw_port: Option<u16>,
) -> Result<(ProxyScheme, String, Option<u16>), UserError> {
    let trimmed = raw_host.trim();
    if trimmed.is_empty() {
        return Ok((scheme, String::new(), raw_port.filter(|port| *port > 0)));
    }
    let (detected_scheme, rest) = if let Some(rest) = trimmed.strip_prefix("socks5h://").or_else(|| trimmed.strip_prefix("socks5://")).or_else(|| trimmed.strip_prefix("socks://")) {
        (ProxyScheme::Socks5, rest)
    } else if let Some(rest) = trimmed.strip_prefix("http://").or_else(|| trimmed.strip_prefix("https://")) {
        (ProxyScheme::Http, rest)
    } else {
        (scheme, trimmed)
    };
    let authority = rest.split('/').next().unwrap_or(rest).trim();
    let authority = authority.rsplit_once('@').map_or(authority, |(_, right)| right);
    let (host_part, parsed_port) = split_host_port(authority)?;
    let port = raw_port.filter(|port| *port > 0).or(parsed_port);
    validate_host(&host_part)?;
    Ok((detected_scheme, host_part, port))
}

fn split_host_port(authority: &str) -> Result<(String, Option<u16>), UserError> {
    if let Some(rest) = authority.strip_prefix('[') {
        let Some((inside, after)) = rest.split_once(']') else {
            return Err(invalid_proxy_input());
        };
        let port = if let Some(port_str) = after.strip_prefix(':') {
            Some(parse_port(port_str)?)
        } else if after.is_empty() {
            None
        } else {
            return Err(invalid_proxy_input());
        };
        return Ok((inside.to_string(), port));
    }
    if let Some((host, port_str)) = authority.rsplit_once(':') {
        if !host.contains(':') {
            return Ok((host.to_string(), Some(parse_port(port_str)?)));
        }
    }
    Ok((authority.to_string(), None))
}

fn parse_port(raw: &str) -> Result<u16, UserError> {
    raw.trim()
        .parse::<u16>()
        .ok()
        .filter(|port| *port > 0)
        .ok_or_else(invalid_proxy_port)
}

fn validate_host(host: &str) -> Result<(), UserError> {
    if host.is_empty()
        || host.len() > 253
        || host.chars().any(|ch| ch.is_whitespace() || ch.is_control() || matches!(ch, '/' | '\\' | '?' | '#' | '@'))
    {
        return Err(invalid_proxy_input());
    }
    let formatted = if host.contains(':') { format!("[{host}]") } else { host.to_string() };
    Url::parse(&format!("http://{formatted}:80")).map_err(|_| invalid_proxy_input())?;
    Ok(())
}

pub(crate) fn validate_settings(input: &SaveNetworkProxyInput) -> Result<ProxySettings, UserError> {
    let (scheme, host, port) = normalize_host_and_port(input.scheme, &input.host, input.port)?;
    let username = input.username.trim().to_string();
    let bypass = parse_bypass_list(&input.bypass).join(", ");
    if input.mode == ProxyMode::Manual {
        if host.is_empty() {
            return Err(UserError::new("net.proxyHostRequired", "Enter a proxy server address."));
        }
        if port.is_none() {
            return Err(invalid_proxy_port());
        }
    }
    Ok(ProxySettings {
        mode: input.mode,
        scheme,
        host,
        port,
        username,
        bypass,
    })
}

pub(crate) fn build_proxy_url(
    scheme: ProxyScheme,
    host: &str,
    port: u16,
    username: &str,
    password: Option<&str>,
) -> Result<Url, UserError> {
    let prefix = match scheme {
        ProxyScheme::Http => "http",
        ProxyScheme::Socks5 => "socks5h",
    };
    let host_text = if host.contains(':') && !host.starts_with('[') {
        format!("[{host}]")
    } else {
        host.to_string()
    };
    let mut url = Url::parse(&format!("{prefix}://{host_text}:{port}")).map_err(|_| invalid_proxy_input())?;
    if !username.is_empty() {
        url.set_username(username).map_err(|_| invalid_proxy_input())?;
        if let Some(secret) = password.filter(|secret| !secret.is_empty()) {
            url.set_password(Some(secret)).map_err(|_| invalid_proxy_input())?;
        }
    }
    Ok(url)
}

pub(crate) fn redact_url(raw: &str) -> String {
    if let Ok(mut parsed) = Url::parse(raw) {
        if !parsed.username().is_empty() || parsed.password().is_some() {
            let _ = parsed.set_username("");
            let _ = parsed.set_password(None);
        }
        return parsed.to_string().trim_end_matches('/').to_string();
    }
    let start = raw.find("://").map_or(0, |index| index + 3);
    let rest = &raw[start..];
    let authority_end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    if let Some(at) = rest[..authority_end].rfind('@') {
        format!("{}{}", &raw[..start], &rest[at + 1..])
    } else {
        raw.to_string()
    }
}

pub(crate) fn invalid_proxy_input() -> UserError {
    UserError::new("net.proxy", "The proxy address is not valid.")
}

fn invalid_proxy_port() -> UserError {
    UserError::new("net.proxyPort", "Enter a proxy port from 1 to 65535.")
}

fn credential() -> Result<Entry, UserError> {
    Entry::new(&crate::dev_lane::service(CREDENTIAL_SERVICE), CREDENTIAL_ACCOUNT).map_err(cred_err::open)
}

pub(crate) fn read_password() -> Result<Option<String>, UserError> {
    match credential()?.get_password() {
        Ok(secret) if !secret.is_empty() => Ok(Some(secret)),
        Ok(_) | Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(cred_err::read(error)),
    }
}

pub(crate) fn save_password(secret: &str) -> Result<(), UserError> {
    if secret.is_empty() {
        delete_password()
    } else {
        credential()?.set_password(secret).map_err(cred_err::save)
    }
}

pub(crate) fn delete_password() -> Result<(), UserError> {
    match credential()?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(cred_err::delete(error)),
    }
}

pub(crate) fn load_file(path: &Path) -> ProxySettings {
    let Ok(text) = std::fs::read_to_string(path) else {
        return ProxySettings::default();
    };
    serde_json::from_str::<ProxySettings>(&text).unwrap_or_default()
}

pub(crate) fn save_file(path: &Path, settings: &ProxySettings) -> Result<(), UserError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| UserError::new("internal", "Could not save proxy settings.").detail(error))?;
    }
    let text = serde_json::to_string_pretty(settings)
        .map_err(|error| UserError::new("internal", "Could not save proxy settings.").detail(error))?;
    crate::fs_write::replace_file(path, text.as_bytes())
        .map_err(|error| UserError::new("internal", "Could not save proxy settings.").detail(error))
}
