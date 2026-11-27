use super::config::{parse_bypass_list, AutoProxy, ProxyTarget, ResolvedProxy};
use super::pac::PacSource;

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

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct OsProxyConfig {
    pub(crate) auto_detect: bool,
    pub(crate) script_url: Option<String>,
    pub(crate) manual: Option<ProxyTarget>,
}

impl OsProxyConfig {
    pub(crate) fn resolved(self) -> ResolvedProxy {
        if let Some(script) = self.script_url.map(|url| url.trim().to_string()).filter(|url| !url.is_empty()) {
            return ResolvedProxy::Auto(AutoProxy {
                pac: PacSource::Script(script),
                fallback: self.manual,
            });
        }
        if let Some(manual) = self.manual {
            return ResolvedProxy::Proxy(manual);
        }
        if self.auto_detect {
            return ResolvedProxy::Auto(AutoProxy {
                pac: PacSource::Discover,
                fallback: None,
            });
        }
        ResolvedProxy::Direct
    }
}

pub(crate) fn detect_system() -> ResolvedProxy {
    match detect_env_proxy() {
        Some(target) => ResolvedProxy::Proxy(target),
        None => detect_os_config().resolved(),
    }
}

#[cfg(windows)]
pub(crate) fn detect_os_config() -> OsProxyConfig {
    match crate::win32::winhttp_proxy::ie_proxy_config() {
        Some(config) => OsProxyConfig {
            auto_detect: config.auto_detect,
            script_url: config.script_url,
            manual: config.proxy.map(|server| ProxyTarget {
                url: normalize_proxy_entry(&server),
                bypass: config.bypass.map(|raw| parse_bypass_list(&raw)).unwrap_or_default(),
            }),
        },
        None => registry_config(),
    }
}

#[cfg(windows)]
fn registry_config() -> OsProxyConfig {
    let read_string = |name: &str| {
        crate::win32::registry::read_string(HKEY_CURRENT_USER, INTERNET_SETTINGS_SUBKEY, name)
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    };
    let enabled = crate::win32::registry::read_u32(HKEY_CURRENT_USER, INTERNET_SETTINGS_SUBKEY, "ProxyEnable").is_some_and(|value| value != 0);
    let manual = enabled
        .then(|| read_string("ProxyServer"))
        .flatten()
        .map(|server| ProxyTarget {
            url: normalize_proxy_entry(&server),
            bypass: read_string("ProxyOverride").map(|raw| parse_bypass_list(&raw)).unwrap_or_default(),
        });
    OsProxyConfig {
        auto_detect: false,
        script_url: read_string("AutoConfigURL"),
        manual,
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn detect_os_config() -> OsProxyConfig {
    let Ok(output) = std::process::Command::new("/usr/sbin/scutil")
        .arg("--proxy")
        .stdin(std::process::Stdio::null())
        .output()
    else {
        return OsProxyConfig::default();
    };
    if !output.status.success() {
        return OsProxyConfig::default();
    }
    parse_scutil_config(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(not(any(windows, target_os = "macos")))]
pub(crate) fn detect_os_config() -> OsProxyConfig {
    OsProxyConfig::default()
}

#[cfg(any(target_os = "macos", test))]
pub(crate) fn parse_scutil_config(text: &str) -> OsProxyConfig {
    let enabled = |key: &str| scutil_field(text, key).as_deref() == Some("1");
    OsProxyConfig {
        auto_detect: enabled("ProxyAutoDiscoveryEnable"),
        script_url: enabled("ProxyAutoConfigEnable")
            .then(|| scutil_field(text, "ProxyAutoConfigURLString"))
            .flatten(),
        manual: parse_scutil_proxy(text),
    }
}

#[cfg(any(target_os = "macos", test))]
fn scutil_field(text: &str, key: &str) -> Option<String> {
    text.lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        (name.trim() == key)
            .then(|| value.trim().to_string())
            .filter(|value| !value.is_empty())
    })
}

#[cfg(any(target_os = "macos", test))]
pub(crate) fn parse_scutil_proxy(text: &str) -> Option<ProxyTarget> {
    let field = |key: &str| scutil_field(text, key);
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
