use super::config::{parse_bypass_list, ProxyTarget};

#[cfg(windows)]
use windows::Win32::System::Registry::HKEY_CURRENT_USER;

#[cfg(windows)]
const INTERNET_SETTINGS_SUBKEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Internet Settings";

pub(crate) fn normalize_proxy_entry(raw: &str) -> String {
    let entries: Vec<&str> = raw
        .split(';')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .collect();
    if let Some(server) = ["https=", "http="]
        .iter()
        .find_map(|prefix| entries.iter().find_map(|entry| entry.strip_prefix(prefix)))
    {
        return ensure_scheme(server, "http");
    }
    if let Some(server) = ["socks5=", "socks="]
        .iter()
        .find_map(|prefix| entries.iter().find_map(|entry| entry.strip_prefix(prefix)))
    {
        return ensure_scheme(server, "socks5h");
    }
    let first = entries.first().copied().unwrap_or("");
    ensure_scheme(first, "http")
}

fn ensure_scheme(server: &str, default_scheme: &str) -> String {
    let server = server.trim();
    if let Some(rest) = server.strip_prefix("socks5://") {
        return format!("socks5h://{rest}");
    }
    if let Some(rest) = server.strip_prefix("socks://") {
        return format!("socks5h://{rest}");
    }
    if server.contains("://") {
        server.to_string()
    } else {
        format!("{default_scheme}://{server}")
    }
}

pub(crate) fn detect_env_proxy() -> Option<ProxyTarget> {
    for key in ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"] {
        if let Ok(value) = std::env::var(key) {
            let value = value.trim();
            if !value.is_empty() {
                let bypass = ["NO_PROXY", "no_proxy"]
                    .iter()
                    .find_map(|name| std::env::var(name).ok())
                    .map(|raw| parse_bypass_list(&raw))
                    .unwrap_or_default();
                return Some(ProxyTarget {
                    url: normalize_proxy_entry(value),
                    bypass,
                });
            }
        }
    }
    None
}

pub(crate) fn detect_system_or_env_proxy() -> Option<ProxyTarget> {
    detect_env_proxy().or_else(detect_os_proxy)
}

#[cfg(windows)]
pub(crate) fn detect_os_proxy() -> Option<ProxyTarget> {
    if crate::win32::registry::read_u32(HKEY_CURRENT_USER, INTERNET_SETTINGS_SUBKEY, "ProxyEnable")? == 0 {
        return None;
    }
    let server = crate::win32::registry::read_string(HKEY_CURRENT_USER, INTERNET_SETTINGS_SUBKEY, "ProxyServer")?;
    if server.trim().is_empty() {
        return None;
    }
    let bypass = crate::win32::registry::read_string(HKEY_CURRENT_USER, INTERNET_SETTINGS_SUBKEY, "ProxyOverride")
        .map(|raw| parse_bypass_list(&raw))
        .unwrap_or_default();
    Some(ProxyTarget {
        url: normalize_proxy_entry(&server),
        bypass,
    })
}

#[cfg(target_os = "macos")]
pub(crate) fn detect_os_proxy() -> Option<ProxyTarget> {
    let output = std::process::Command::new("/usr/sbin/scutil")
        .arg("--proxy")
        .stdin(std::process::Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    parse_scutil_proxy(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(not(any(windows, target_os = "macos")))]
pub(crate) fn detect_os_proxy() -> Option<ProxyTarget> {
    None
}

#[cfg(any(target_os = "macos", test))]
pub(crate) fn parse_scutil_proxy(text: &str) -> Option<ProxyTarget> {
    let field = |key: &str| {
        text.lines().find_map(|line| {
            let (name, value) = line.split_once(':')?;
            (name.trim() == key)
                .then(|| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
    };
    let entry = |prefix: &str, scheme: &str| {
        if field(&format!("{prefix}Enable"))?.as_str() != "1" {
            return None;
        }
        let host = field(&format!("{prefix}Proxy"))?;
        let port = field(&format!("{prefix}Port"))?;
        let host_text = if host.contains(':') && !host.starts_with('[') {
            format!("[{host}]")
        } else {
            host
        };
        Some(format!("{scheme}://{host_text}:{port}"))
    };
    let url = entry("HTTPS", "http")
        .or_else(|| entry("HTTP", "http"))
        .or_else(|| entry("SOCKS", "socks5h"))?;
    let bypass = parse_scutil_exceptions(text);
    Some(ProxyTarget { url, bypass })
}

#[cfg(any(target_os = "macos", test))]
fn parse_scutil_exceptions(text: &str) -> Vec<String> {
    let mut in_list = false;
    let mut items = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if !in_list {
            if trimmed.starts_with("ExceptionsList") && trimmed.contains('{') {
                in_list = true;
            }
            continue;
        }
        if trimmed == "}" {
            break;
        }
        if let Some((_, value)) = trimmed.split_once(':') {
            let entry = value.trim();
            if !entry.is_empty() {
                items.push(entry.to_string());
            }
        }
    }
    parse_bypass_list(&items.join(","))
}
