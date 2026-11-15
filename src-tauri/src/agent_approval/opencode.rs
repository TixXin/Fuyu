use std::{
    collections::HashSet,
    ffi::OsString,
    fmt,
    fs,
    io::{Read, Write},
    net::{SocketAddr, TcpStream, ToSocketAddrs},
    path::{Path, PathBuf},
    sync::Arc,
    thread,
    time::Duration,
};

use base64::Engine;
use serde_json::{json, Map, Value};

use super::decision::{Agent, Decision};
use super::external::{self, ExternalRequest};

const USERNAME: &str = "opencode";
const CONNECT_TIMEOUT: Duration = Duration::from_millis(400);
const IO_TIMEOUT: Duration = Duration::from_secs(2);
const MAX_RESPONSE_BYTES: u64 = 4 * 1024 * 1024;
const POLL_RUNNING: Duration = Duration::from_millis(1500);
const POLL_IDLE: Duration = Duration::from_secs(5);
const MISSES_BEFORE_CLEARING: u32 = 3;
const NOTIFICATIONS_DIR: &str = "agent-notifications";
const WAITING_PREFIX: &str = "opencode-permission-";
const DEFAULT_DENY_MESSAGE: &str = "Denied in Fuyu";

#[derive(Clone)]
pub(crate) struct Endpoint {
    address: SocketAddr,
    host: String,
    auth: String,
}

impl fmt::Debug for Endpoint {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.debug_struct("Endpoint").field("address", &self.address).finish_non_exhaustive()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ServiceState {
    Unknown,
    Running,
    Gone,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Permission {
    pub id: String,
    pub session_id: String,
    pub action: String,
    pub resources: Vec<String>,
    pub metadata: Map<String, Value>,
    pub message: Option<String>,
}

pub(crate) fn state_dir(home_dir: &Path, env: impl Fn(&str) -> Option<OsString>) -> PathBuf {
    env("XDG_STATE_HOME")
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
        .unwrap_or_else(|| home_dir.join(".local").join("state"))
        .join("opencode")
}

fn registration(home_dir: &Path, env: impl Fn(&str) -> Option<OsString>) -> Option<Value> {
    let text = fs::read_to_string(state_dir(home_dir, env).join("service.json")).ok()?;
    serde_json::from_str(&text).ok()
}

pub(crate) fn service_state(home_dir: &Path, env: impl Fn(&str) -> Option<OsString>) -> ServiceState {
    match registration(home_dir, env).and_then(|info| pid_of(&info)) {
        None => ServiceState::Unknown,
        Some(pid) if service_alive(pid) => ServiceState::Running,
        Some(_) => ServiceState::Gone,
    }
}

fn pid_of(info: &Value) -> Option<u32> {
    info["pid"].as_u64().and_then(|pid| u32::try_from(pid).ok())
}

fn service_alive(pid: u32) -> bool {
    crate::platform::process::image_path(pid)
        .and_then(|exe| Path::new(&exe).file_name().map(|name| name.to_string_lossy().to_lowercase()))
        .is_some_and(|name| name.contains("opencode"))
}

pub(crate) fn endpoint(home_dir: &Path, env: impl Fn(&str) -> Option<OsString>) -> Option<Endpoint> {
    let info = registration(home_dir, env)?;
    if !pid_of(&info).is_some_and(service_alive) {
        return None;
    }
    endpoint_from(&info)
}

pub(super) fn endpoint_from(info: &Value) -> Option<Endpoint> {
    let url = info["url"].as_str()?;
    let password = info["password"].as_str().filter(|password| !password.is_empty())?;
    let rest = url.strip_prefix("http://")?;
    let host = rest.split('/').next().filter(|host| !host.is_empty())?;
    let address = host.to_socket_addrs().ok()?.find(|address| address.ip().is_loopback())?;
    let auth = base64::engine::general_purpose::STANDARD.encode(format!("{USERNAME}:{password}"));
    Some(Endpoint { address, host: host.to_string(), auth })
}

fn request(endpoint: &Endpoint, method: &str, path: &str, body: Option<&str>) -> Result<(u16, String), String> {
    let mut stream = TcpStream::connect_timeout(&endpoint.address, CONNECT_TIMEOUT).map_err(|error| error.to_string())?;
    stream.set_read_timeout(Some(IO_TIMEOUT)).map_err(|error| error.to_string())?;
    stream.set_write_timeout(Some(IO_TIMEOUT)).map_err(|error| error.to_string())?;
    let body = body.unwrap_or_default();
    let head = format!(
        "{method} {path} HTTP/1.1\r\nHost: {}\r\nAuthorization: Basic {}\r\nAccept: application/json\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        endpoint.host,
        endpoint.auth,
        body.len()
    );
    stream.write_all(head.as_bytes()).and_then(|()| stream.write_all(body.as_bytes())).map_err(|error| error.to_string())?;
    let mut raw = Vec::new();
    stream.take(MAX_RESPONSE_BYTES).read_to_end(&mut raw).map_err(|error| error.to_string())?;
    parse_response(&raw)
}

pub(super) fn parse_response(raw: &[u8]) -> Result<(u16, String), String> {
    let split = raw.windows(4).position(|window| window == b"\r\n\r\n").ok_or("The response has no header end.")?;
    let head = String::from_utf8_lossy(&raw[..split]);
    let status = head
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok())
        .ok_or("The response has no status.")?;
    let chunked = head.lines().any(|line| {
        let line = line.to_ascii_lowercase();
        line.starts_with("transfer-encoding:") && line.contains("chunked")
    });
    let body = &raw[split + 4..];
    let body = if chunked { dechunk(body) } else { body.to_vec() };
    Ok((status, String::from_utf8_lossy(&body).into_owned()))
}

fn dechunk(mut body: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    while let Some(line_end) = body.windows(2).position(|window| window == b"\r\n") {
        let size = String::from_utf8_lossy(&body[..line_end]);
        let Ok(size) = usize::from_str_radix(size.split(';').next().unwrap_or_default().trim(), 16) else { break };
        let start = line_end + 2;
        if size == 0 || body.len() < start + size {
            break;
        }
        out.extend_from_slice(&body[start..start + size]);
        body = body.get(start + size + 2..).unwrap_or_default();
    }
    out
}

fn get_json(endpoint: &Endpoint, path: &str) -> Result<Value, String> {
    let (status, body) = request(endpoint, "GET", path, None)?;
    if status != 200 {
        return Err(format!("opencode answered {status} for {path}"));
    }
    serde_json::from_str(&body).map_err(|error| error.to_string())
}

fn segment(text: &str) -> String {
    text.bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (byte as char).to_string(),
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

pub(crate) fn pending(endpoint: &Endpoint) -> Result<Vec<Permission>, String> {
    let active = get_json(endpoint, "/api/session/active")?;
    let mut sessions: Vec<&String> = active["data"].as_object().map(|data| data.keys().collect()).unwrap_or_default();
    sessions.sort();
    let mut out = Vec::new();
    for session in sessions {
        let listed = get_json(endpoint, &format!("/api/session/{}/permission", segment(session)))?;
        out.extend(listed["data"].as_array().into_iter().flatten().filter_map(permission));
    }
    Ok(out)
}

fn permission(value: &Value) -> Option<Permission> {
    let text = |key: &str| value[key].as_str().filter(|text| !text.is_empty()).map(str::to_string);
    Some(Permission {
        id: text("id")?,
        session_id: text("sessionID")?,
        action: text("action").unwrap_or_default(),
        resources: value["resources"].as_array().into_iter().flatten().filter_map(Value::as_str).map(str::to_string).collect(),
        metadata: value["metadata"].as_object().cloned().unwrap_or_default(),
        message: text("message"),
    })
}

pub(crate) fn reply(endpoint: &Endpoint, session_id: &str, request_id: &str, decision: Decision, message: Option<&str>) -> Result<(), String> {
    let body = match decision {
        Decision::Allow | Decision::AllowAlways => json!({ "decision": "once" }),
        Decision::Deny => json!({
            "decision": "reject",
            "message": message.map(str::trim).filter(|text| !text.is_empty()).unwrap_or(DEFAULT_DENY_MESSAGE),
        }),
        Decision::Terminal | Decision::Answer => return Ok(()),
    };
    let path = format!("/api/session/{}/permission/{}/reply", segment(session_id), segment(request_id));
    let (status, _) = request(endpoint, "POST", &path, Some(&body.to_string()))?;
    if (200..300).contains(&status) { Ok(()) } else { Err(format!("opencode answered {status} to the reply")) }
}

pub(super) fn tool_call(permission: &Permission) -> (String, Value) {
    let meta = |keys: &[&str]| keys.iter().find_map(|key| permission.metadata.get(*key).and_then(Value::as_str)).map(str::to_string);
    let first = permission.resources.first().cloned();
    let mut input = Map::new();
    let name = match permission.action.as_str() {
        "bash" | "shell" => {
            let command = meta(&["command"]).or_else(|| Some(permission.resources.join("\n")).filter(|text| !text.is_empty()));
            input.insert("command".into(), json!(command));
            "Bash"
        }
        "edit" | "write" | "read" | "patch" => {
            input.insert("file_path".into(), json!(meta(&["filepath", "filePath", "path"]).or(first)));
            match permission.action.as_str() {
                "read" => "Read",
                "write" => "Write",
                _ => "Edit",
            }
        }
        "webfetch" => {
            input.insert("url".into(), json!(meta(&["url"]).or(first)));
            "WebFetch"
        }
        other => {
            input.insert("resources".into(), json!(permission.resources));
            other
        }
    };
    if let Some(note) = permission.message.clone().or_else(|| meta(&["description"])) {
        input.insert("description".into(), json!(note));
    }
    let name = if name.is_empty() { "opencode" } else { name };
    (name.to_string(), Value::Object(input))
}

fn waiting_file(dir: &Path, request_id: &str) -> PathBuf {
    dir.join(format!("{WAITING_PREFIX}{}.json", segment(request_id)))
}

pub(super) fn sync_waiting(app_dir: &Path, open: &[Permission]) {
    let dir = app_dir.join(NOTIFICATIONS_DIR);
    let keep: HashSet<PathBuf> = open.iter().map(|permission| waiting_file(&dir, &permission.id)).collect();
    for entry in fs::read_dir(&dir).into_iter().flatten().flatten() {
        let path = entry.path();
        let ours = entry.file_name().to_string_lossy().starts_with(WAITING_PREFIX);
        if ours && !keep.contains(&path) {
            let _ = fs::remove_file(path);
        }
    }
    if open.is_empty() || fs::create_dir_all(&dir).is_err() {
        return;
    }
    for permission in open {
        let path = waiting_file(&dir, &permission.id);
        if !path.exists() {
            let body = json!({ "hook_event_name": "PermissionRequest", "session_id": permission.session_id });
            let _ = crate::fs_write::replace_file(&path, body.to_string().as_bytes());
        }
    }
}

fn external_requests(open: &[Permission]) -> Vec<ExternalRequest> {
    open.iter()
        .map(|permission| {
            let (tool_name, tool_input) = tool_call(permission);
            ExternalRequest { key: permission.id.clone(), session_id: permission.session_id.clone(), cwd: None, tool_name, tool_input }
        })
        .collect()
}

pub(super) fn watch(app_dir: PathBuf, home_dir: PathBuf) {
    let spawned = thread::Builder::new().name("opencode-permissions".into()).spawn(move || {
        let env = |name: &str| std::env::var_os(name);
        let mut open: Vec<Permission> = Vec::new();
        let mut misses = 0;
        loop {
            let Some(endpoint) = endpoint(&home_dir, env) else {
                if !open.is_empty() {
                    open.clear();
                    publish(&app_dir, &open, None);
                }
                thread::sleep(POLL_IDLE);
                continue;
            };
            match pending(&endpoint) {
                Ok(now) => {
                    misses = 0;
                    open = now;
                    publish(&app_dir, &open, Some(endpoint));
                }
                Err(_) => {
                    misses += 1;
                    if misses >= MISSES_BEFORE_CLEARING && !open.is_empty() {
                        open.clear();
                        publish(&app_dir, &open, None);
                    }
                }
            }
            thread::sleep(POLL_RUNNING);
        }
    });
    if let Err(error) = spawned {
        eprintln!("could not watch opencode permission requests: {error}");
    }
}

fn publish(app_dir: &Path, open: &[Permission], endpoint: Option<Endpoint>) {
    sync_waiting(app_dir, open);
    let answer: external::Answer = Arc::new(move |request: &ExternalRequest, decision, message: Option<&str>| {
        let Some(endpoint) = endpoint.as_ref() else { return };
        if let Err(error) = reply(endpoint, &request.session_id, &request.key, decision, message) {
            eprintln!("could not answer the opencode permission request: {error}");
        }
    });
    external::sync(Agent::Opencode, external_requests(open), answer);
}

#[cfg(test)]
#[path = "opencode_tests.rs"]
mod tests;
