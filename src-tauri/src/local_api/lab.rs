use serde_json::{json, Value};
use std::{io::Read, path::Path, thread};
use tauri::AppHandle;
use tiny_http::{Header, Request, Response, Server};

use super::{
    bridge, config, dev_island,
    routes::{self, ApiCall, ApiError, RequestHeaders, MAX_BODY_BYTES},
};

pub(super) const LAB_FILE_NAME: &str = "island-lab.json";
const LAB_OWNER: &str = "island-lab";
const PREFERRED_PORT: u16 = 39281;
const BUILTINS_PATH: &str = "/v1/dev/builtins";

pub(super) fn start(app: AppHandle, home: &Path) -> Result<(), String> {
    let token = config::generate_token()?;
    let server = Server::http(("127.0.0.1", PREFERRED_PORT))
        .or_else(|_| Server::http(("127.0.0.1", 0)))
        .map_err(|error| format!("Could not start the island lab listener: {error}"))?;
    let port = server
        .server_addr()
        .to_ip()
        .map(|address| address.port())
        .ok_or_else(|| "The island lab listener did not get a TCP port.".to_string())?;
    let file = json!({ "port": port, "token": token, "pid": std::process::id() });
    crate::fs_write::replace_file(&home.join(LAB_FILE_NAME), file.to_string().as_bytes())
        .map_err(|error| format!("Could not write {LAB_FILE_NAME}: {error}"))?;
    thread::Builder::new()
        .name("island-lab".into())
        .spawn(move || {
            for request in server.incoming_requests() {
                let app = app.clone();
                let token = token.clone();
                let _ = thread::Builder::new()
                    .name("island-lab-request".into())
                    .spawn(move || respond(&app, request, &token, port));
            }
        })
        .map_err(|error| format!("Could not start the island lab thread: {error}"))?;
    Ok(())
}

fn respond(app: &AppHandle, mut request: Request, token: &str, port: u16) {
    let (status, body) = match answer(app, &mut request, token, port) {
        Ok(data) => (200, json!({ "ok": true, "data": data })),
        Err(error) => (error.status, json!({ "ok": false, "error": error.message })),
    };
    let mut response = Response::from_string(body.to_string()).with_status_code(status);
    if let Ok(header) = Header::from_bytes("Content-Type", "application/json; charset=utf-8") {
        response = response.with_header(header);
    }
    let _ = request.respond(response);
}

pub(super) fn lab_call(method: &str, url: &str, body: &[u8]) -> Result<ApiCall, ApiError> {
    let call = routes::route(method, url, body)?;
    match call.method {
        "health" | "agentStatus.report" | "agentStatus.clear" => Ok(call),
        name if name.starts_with("devIsland.") => Ok(call),
        _ => Err(ApiError::new(404, "The island lab only serves /v1/dev/island and /v1/agent-status.")),
    }
}

fn answer(app: &AppHandle, request: &mut Request, token: &str, port: u16) -> Result<Value, ApiError> {
    let mut headers = RequestHeaders::default();
    for header in request.headers() {
        let value = Some(header.value.as_str().to_string());
        if header.field.equiv("Host") {
            headers.host = value;
        } else if header.field.equiv("Origin") {
            headers.origin = value;
        } else if header.field.equiv("Authorization") {
            headers.authorization = value;
        }
    }
    routes::check_access(&headers, token, port)?;
    let mut body = Vec::new();
    request
        .as_reader()
        .take(MAX_BODY_BYTES as u64 + 1)
        .read_to_end(&mut body)
        .map_err(|error| ApiError::new(400, format!("Could not read the body: {error}")))?;
    if body.len() > MAX_BODY_BYTES {
        return Err(ApiError::new(413, "The body is too large."));
    }
    if let Some(answer) = builtins_route(app, request.method().as_str(), request.url(), &body) {
        return answer;
    }
    let call = lab_call(request.method().as_str(), request.url(), &body)?;
    let to_api_error = |(status, message): (u16, String)| ApiError::new(status, message);
    match call.method {
        "health" => Ok(json!({ "lab": true })),
        "agentStatus.report" => {
            let name = call.params.get("source").and_then(Value::as_str).unwrap_or_default().to_string();
            crate::agent_status::report_external_status(LAB_OWNER, &name, &call.params).map_err(to_api_error)
        }
        "agentStatus.clear" => crate::agent_status::clear_external_status(LAB_OWNER, &call.params).map_err(to_api_error),
        dev_island::NOTCH => dev_island::set_notch(app, &call.params),
        dev_island::EDGE => dev_island::set_edge(app, &call.params),
        _ => bridge::dispatch(app, call),
    }
}

#[derive(Debug, PartialEq)]
enum BuiltinsCall<'a> {
    Read,
    Switch(&'a str),
}

fn builtins_call<'a>(method: &str, url: &'a str) -> Option<Result<BuiltinsCall<'a>, ApiError>> {
    let path = url.split('?').next().unwrap_or(url);
    let rest = path.strip_prefix(BUILTINS_PATH)?;
    if !rest.is_empty() && !rest.starts_with('/') {
        return None;
    }
    let id = rest.trim_start_matches('/');
    Some(match (method, id) {
        ("GET", "") => Ok(BuiltinsCall::Read),
        ("PUT", id) if !id.is_empty() && !id.contains('/') => Ok(BuiltinsCall::Switch(id)),
        _ => Err(ApiError::new(405, "Read the built-in plugins with GET /v1/dev/builtins, or switch one with PUT /v1/dev/builtins/<id> { \"enabled\": bool }.")),
    })
}

fn builtins_route(app: &AppHandle, method: &str, url: &str, body: &[u8]) -> Option<Result<Value, ApiError>> {
    Some(match builtins_call(method, url)? {
        Ok(BuiltinsCall::Read) => Ok(crate::plugin_kernel::diagnostics::collect(app)),
        Ok(BuiltinsCall::Switch(id)) => switch_builtin(id, body),
        Err(error) => Err(error),
    })
}

fn switch_builtin(id: &str, body: &[u8]) -> Result<Value, ApiError> {
    let enabled = serde_json::from_slice::<Value>(body)
        .ok()
        .and_then(|params| params.get("enabled").and_then(Value::as_bool))
        .ok_or_else(|| ApiError::new(400, "Give \"enabled\": true or false."))?;
    let plugins = tauri::async_runtime::block_on(crate::plugin_kernel::builtins::set_builtin_plugin_enabled(id.to_string(), enabled))
        .map_err(|error| ApiError::new(400, error.to_string()))?;
    serde_json::to_value(plugins).map_err(|error| ApiError::new(500, error.to_string()))
}

#[cfg(test)]
mod builtins_tests {
    use super::{builtins_call, BuiltinsCall};

    #[test]
    fn the_lab_reads_and_switches_built_in_plugins() {
        assert_eq!(builtins_call("GET", "/v1/dev/builtins").map(|call| call.ok()), Some(Some(BuiltinsCall::Read)));
        assert_eq!(builtins_call("GET", "/v1/dev/builtins/?x=1").map(|call| call.ok()), Some(Some(BuiltinsCall::Read)));
        assert_eq!(builtins_call("PUT", "/v1/dev/builtins/timer").map(|call| call.ok()), Some(Some(BuiltinsCall::Switch("timer"))));
        assert_eq!(builtins_call("PUT", "/v1/dev/builtins/a/b").map(|call| call.map_err(|error| error.status).err()), Some(Some(405)));
        assert_eq!(builtins_call("DELETE", "/v1/dev/builtins/timer").map(|call| call.map_err(|error| error.status).err()), Some(Some(405)));
        assert!(builtins_call("GET", "/v1/dev/builtinsx").is_none());
        assert!(builtins_call("GET", "/v1/dev/island/emit").is_none());
    }
}
