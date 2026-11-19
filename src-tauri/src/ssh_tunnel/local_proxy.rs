use std::{
    net::{Ipv4Addr, SocketAddr, TcpStream},
    path::{Path, PathBuf},
    time::Duration,
};

use serde::Serialize;
use serde_json::{Map, Value};

const CLASH_VERGE_PORT: u16 = 7897;
const V2RAYN_PORT: u16 = 10808;
const CONNECT_TIMEOUT: Duration = Duration::from_millis(300);
#[cfg(windows)]
const INTERNET_SETTINGS: &str = r"Software\Microsoft\Windows\CurrentVersion\Internet Settings";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Choice {
    Auto,
    ClashVerge,
    V2rayN,
    Custom(u16),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) enum Found {
    ClashVerge,
    V2rayN,
    SystemProxy,
    ClashVergeDefault,
    V2rayNDefault,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalProxy {
    pub(super) port: u16,
    pub(super) found: Found,
    pub(super) listening: bool,
}

pub(super) fn choice(settings: &Map<String, Value>) -> Result<Choice, String> {
    match settings.get("localProxy").and_then(Value::as_str) {
        Some("clash-verge") => Ok(Choice::ClashVerge),
        Some("v2rayn") => Ok(Choice::V2rayN),
        Some("custom") => match settings.get("customPort") {
            None => Ok(Choice::Custom(CLASH_VERGE_PORT)),
            Some(value) => value
                .as_u64()
                .and_then(|port| u16::try_from(port).ok())
                .filter(|&port| port > 0)
                .map(Choice::Custom)
                .ok_or_else(|| "The local proxy port must be a whole number from 1 to 65535".to_string()),
        },
        _ => Ok(Choice::Auto),
    }
}

pub(super) fn find(choice: Choice, current: Option<LocalProxy>) -> LocalProxy {
    let checked = |(port, found): (u16, Found)| LocalProxy { port, found, listening: listening(port) };
    match choice {
        Choice::Auto => pick(&candidates(), listening, current),
        Choice::ClashVerge => checked(clash_verge_port().map_or((CLASH_VERGE_PORT, Found::ClashVergeDefault), |port| (port, Found::ClashVerge))),
        Choice::V2rayN => checked(v2rayn_port().map_or((V2RAYN_PORT, Found::V2rayNDefault), |port| (port, Found::V2rayN))),
        Choice::Custom(port) => checked((port, Found::Custom)),
    }
}

fn candidates() -> Vec<(u16, Found)> {
    [
        clash_verge_port().map(|port| (port, Found::ClashVerge)),
        v2rayn_port().map(|port| (port, Found::V2rayN)),
        system_proxy_port().map(|port| (port, Found::SystemProxy)),
        Some((CLASH_VERGE_PORT, Found::ClashVergeDefault)),
        Some((V2RAYN_PORT, Found::V2rayNDefault)),
    ]
    .into_iter()
    .flatten()
    .collect()
}

pub(super) fn pick(candidates: &[(u16, Found)], mut listening: impl FnMut(u16) -> bool, current: Option<LocalProxy>) -> LocalProxy {
    let mut down: Vec<u16> = Vec::new();
    for &(port, found) in candidates {
        if down.contains(&port) {
            continue;
        }
        if listening(port) {
            return LocalProxy { port, found, listening: true };
        }
        down.push(port);
    }
    let (port, found) = current
        .map(|current| (current.port, current.found))
        .filter(|current| candidates.contains(current))
        .or_else(|| candidates.first().copied())
        .unwrap_or((CLASH_VERGE_PORT, Found::ClashVergeDefault));
    LocalProxy { port, found, listening: false }
}

fn listening(port: u16) -> bool {
    TcpStream::connect_timeout(&SocketAddr::from((Ipv4Addr::LOCALHOST, port)), CONNECT_TIMEOUT).is_ok()
}

fn clash_verge_port() -> Option<u16> {
    let dir = app_data_dir()?.join("io.github.clash-verge-rev.clash-verge-rev");
    let read = |file: &str, key: &str| std::fs::read_to_string(dir.join(file)).ok().and_then(|text| yaml_port(&text, key));
    read("clash-verge.yaml", "mixed-port").or_else(|| read("verge.yaml", "verge_mixed_port"))
}

pub(super) fn yaml_port(text: &str, key: &str) -> Option<u16> {
    text.lines().find_map(|line| {
        let value = line.strip_prefix(key)?.strip_prefix(':')?;
        let value = value.split('#').next()?.trim().trim_matches(|c| c == '\'' || c == '"');
        value.parse().ok().filter(|&port| port > 0)
    })
}

#[cfg(windows)]
fn app_data_dir() -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(PathBuf::from)
}

#[cfg(target_os = "macos")]
fn app_data_dir() -> Option<PathBuf> {
    Some(crate::system::windows_home_dir().ok()?.join("Library").join("Application Support"))
}

fn v2rayn_port() -> Option<u16> {
    let exe = crate::platform::process::running_executable(&["v2rayN.exe", "v2rayN"])?;
    let beside = Path::new(&exe).parent()?.join("guiConfigs");
    let dirs = [Some(beside), app_data_dir().map(|dir| dir.join("v2rayN").join("guiConfigs"))];
    dirs.into_iter().flatten().find_map(|dir| v2rayn_config_port(&std::fs::read_to_string(dir.join("guiNConfig.json")).ok()?))
}

pub(super) fn v2rayn_config_port(text: &str) -> Option<u16> {
    let config: Value = serde_json::from_str(text.trim_start_matches('\u{feff}')).ok()?;
    let port = config.get("Inbound")?.get(0)?.get("LocalPort")?.as_u64()?;
    u16::try_from(port).ok().filter(|&port| port > 0)
}

#[cfg(windows)]
fn system_proxy_port() -> Option<u16> {
    use windows::Win32::System::Registry::HKEY_CURRENT_USER;
    let enabled = crate::win32::registry::read_u32(HKEY_CURRENT_USER, INTERNET_SETTINGS, "ProxyEnable")?;
    let server = crate::win32::registry::read_string(HKEY_CURRENT_USER, INTERNET_SETTINGS, "ProxyServer")?;
    (enabled != 0).then(|| loopback_port(&server)).flatten()
}

#[cfg(target_os = "macos")]
fn system_proxy_port() -> Option<u16> {
    let output = std::process::Command::new("/usr/sbin/scutil").arg("--proxy").stdin(std::process::Stdio::null()).output().ok()?;
    scutil_http_port(&String::from_utf8_lossy(&output.stdout))
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub(super) fn scutil_http_port(text: &str) -> Option<u16> {
    let field = |key: &str| {
        text.lines().find_map(|line| {
            let (name, value) = line.split_once(':')?;
            (name.trim() == key).then(|| value.trim().to_string())
        })
    };
    if field("HTTPEnable")? != "1" {
        return None;
    }
    loopback_port(&format!("{}:{}", field("HTTPProxy")?, field("HTTPPort")?))
}

pub(super) fn loopback_port(server: &str) -> Option<u16> {
    let entry = if server.contains('=') {
        server.split(';').find_map(|part| {
            let (scheme, address) = part.split_once('=')?;
            scheme.trim().eq_ignore_ascii_case("http").then_some(address)
        })?
    } else {
        server
    };
    let entry = entry.trim();
    let (host, port) = entry.strip_prefix("http://").unwrap_or(entry).rsplit_once(':')?;
    let port = port.trim_end_matches('/').parse().ok().filter(|&port: &u16| port > 0)?;
    matches!(host, "127.0.0.1" | "localhost").then_some(port)
}
