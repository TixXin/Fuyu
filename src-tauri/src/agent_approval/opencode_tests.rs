use super::*;
use crate::agent_approval::decision::HookInput;
use crate::agent_approval::queue::{CloseReason, Outcome};
use crate::agent_approval::server::new_shared;
use std::{
    io::{BufRead, BufReader},
    net::TcpListener,
    sync::Mutex,
};

struct Fake {
    port: u16,
    seen: Arc<Mutex<Vec<(String, String, String)>>>,
}

fn fake(routes: Vec<(&'static str, &'static str, String)>) -> Fake {
    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let port = listener.local_addr().unwrap().port();
    let seen = Arc::new(Mutex::new(Vec::new()));
    let log = Arc::clone(&seen);
    thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { continue };
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut line = String::new();
            reader.read_line(&mut line).unwrap();
            let mut parts = line.split_whitespace();
            let (method, path) = (parts.next().unwrap_or_default().to_string(), parts.next().unwrap_or_default().to_string());
            let mut auth = String::new();
            let mut length = 0;
            loop {
                let mut header = String::new();
                reader.read_line(&mut header).unwrap();
                if header.trim().is_empty() {
                    break;
                }
                let lower = header.to_ascii_lowercase();
                if lower.starts_with("authorization:") {
                    auth = header["authorization:".len()..].trim().to_string();
                }
                if let Some(value) = lower.strip_prefix("content-length:") {
                    length = value.trim().parse().unwrap_or(0);
                }
            }
            let mut body = vec![0; length];
            reader.read_exact(&mut body).unwrap();
            log.lock().unwrap().push((format!("{method} {path}"), auth, String::from_utf8_lossy(&body).into_owned()));
            let reply = routes.iter().find(|(m, p, _)| *m == method && *p == path);
            let response = match reply {
                Some((_, "/api/session/active", body)) => {
                    let chunked: String = body.as_bytes().chunks(7).map(|chunk| format!("{:x}\r\n{}\r\n", chunk.len(), String::from_utf8_lossy(chunk))).collect();
                    format!("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n{chunked}0\r\n\r\n")
                }
                Some((_, _, body)) if body.is_empty() => "HTTP/1.1 204 No Content\r\n\r\n".to_string(),
                Some((_, _, body)) => format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n{body}", body.len()),
                None => "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n".to_string(),
            };
            let _ = stream.write_all(response.as_bytes());
        }
    });
    Fake { port, seen }
}

fn endpoint_for(port: u16) -> Endpoint {
    endpoint_from(&json!({ "url": format!("http://127.0.0.1:{port}"), "password": "s3cret", "pid": 1 })).unwrap()
}

fn sample(id: &str, action: &str, resources: &[&str], metadata: Value) -> Value {
    json!({ "id": id, "sessionID": "ses_1", "action": action, "resources": resources, "metadata": metadata, "source": { "type": "tool", "messageID": "msg_1", "id": "call_1" } })
}

#[test]
fn reads_the_registration_and_keeps_the_password_out_of_debug() {
    let parsed = endpoint_for(49374);
    assert_eq!(parsed.address.port(), 49374);
    assert_eq!(parsed.auth, base64::engine::general_purpose::STANDARD.encode("opencode:s3cret"));
    assert!(!format!("{parsed:?}").contains("s3cret"));
    assert!(!format!("{parsed:?}").contains(&parsed.auth));
    assert!(endpoint_from(&json!({ "url": "http://127.0.0.1:1", "password": "" })).is_none());
    assert!(endpoint_from(&json!({ "url": "https://abc.opencode.ai", "password": "p" })).is_none());
    assert!(endpoint_from(&json!({ "url": "http://192.0.2.1:4096", "password": "p" })).is_none());
    let home = std::env::temp_dir().join(format!("fuyu-opencode-service-{}", std::process::id()));
    let state = home.join("state");
    let env = |name: &str| (name == "XDG_STATE_HOME").then(|| state.clone().into_os_string());
    assert_eq!(service_state(&home, env), ServiceState::Unknown);
    fs::create_dir_all(state.join("opencode")).unwrap();
    fs::write(state.join("opencode/service.json"), json!({ "url": "http://127.0.0.1:1", "password": "p", "pid": u32::MAX - 7 }).to_string()).unwrap();
    assert_eq!(service_state(&home, env), ServiceState::Gone);
    assert!(endpoint(&home, env).is_none());
}

#[test]
fn lists_pending_requests_of_active_sessions() {
    let permissions = json!({ "data": [
        sample("per_01", "bash", &["git push *"], json!({ "command": "git push origin main" })),
        { "id": "", "sessionID": "ses_1" },
    ] });
    let fake = fake(vec![
        ("GET", "/api/session/active", json!({ "data": { "ses_1": { "type": "running" } } }).to_string()),
        ("GET", "/api/session/ses_1/permission", permissions.to_string()),
    ]);
    let found = pending(&endpoint_for(fake.port)).unwrap();
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].id, "per_01");
    assert_eq!(found[0].session_id, "ses_1");
    assert_eq!(found[0].resources, ["git push *"]);
    let seen = fake.seen.lock().unwrap();
    assert_eq!(seen.len(), 2);
    assert!(seen.iter().all(|(_, auth, _)| auth == &format!("Basic {}", base64::engine::general_purpose::STANDARD.encode("opencode:s3cret"))));
}

#[test]
fn a_failing_service_is_an_error_not_an_empty_list() {
    let fake = fake(vec![]);
    assert!(pending(&endpoint_for(fake.port)).is_err());
}

#[test]
fn replies_once_or_reject_and_hands_back_without_a_request() {
    let fake = fake(vec![("POST", "/api/session/ses_1/permission/per_01/reply", String::new())]);
    let endpoint = endpoint_for(fake.port);
    reply(&endpoint, "ses_1", "per_01", Decision::Allow, None).unwrap();
    reply(&endpoint, "ses_1", "per_01", Decision::Deny, Some("  ")).unwrap();
    reply(&endpoint, "ses_1", "per_01", Decision::Deny, Some("use the staging branch")).unwrap();
    reply(&endpoint, "ses_1", "per_01", Decision::Terminal, None).unwrap();
    assert!(reply(&endpoint, "ses_1", "per_02", Decision::Allow, None).is_err());
    let seen = fake.seen.lock().unwrap();
    let bodies: Vec<Value> = seen.iter().take(3).map(|(_, _, body)| serde_json::from_str(body).unwrap()).collect();
    assert_eq!(bodies[0], json!({ "decision": "once" }));
    assert_eq!(bodies[1], json!({ "decision": "reject", "message": "Denied in Fuyu" }));
    assert_eq!(bodies[2], json!({ "decision": "reject", "message": "use the staging branch" }));
    assert_eq!(seen.len(), 4);
}

#[test]
fn maps_actions_to_the_card_preview() {
    let parse = |value: Value| tool_call(&permission(&value).unwrap());
    assert_eq!(parse(sample("per_1", "bash", &["git push *"], json!({ "command": "git push origin main" }))), ("Bash".into(), json!({ "command": "git push origin main" })));
    assert_eq!(parse(sample("per_2", "bash", &["rm -rf build"], json!({}))), ("Bash".into(), json!({ "command": "rm -rf build" })));
    assert_eq!(parse(sample("per_3", "edit", &["src/app.ts"], json!({ "filepath": "/w/src/app.ts" }))), ("Edit".into(), json!({ "file_path": "/w/src/app.ts" })));
    assert_eq!(parse(sample("per_4", "webfetch", &["https://example.com"], json!({}))), ("WebFetch".into(), json!({ "url": "https://example.com" })));
    let mut other = sample("per_5", "external_directory", &["/etc/*"], json!({}));
    other["message"] = json!("Read outside the project");
    assert_eq!(parse(other), ("external_directory".into(), json!({ "resources": ["/etc/*"], "description": "Read outside the project" })));
}

#[test]
fn waiting_files_follow_the_open_requests() {
    let app_dir = std::env::temp_dir().join(format!("fuyu-opencode-waiting-{}", std::process::id()));
    let _ = fs::remove_dir_all(&app_dir);
    let dir = app_dir.join(NOTIFICATIONS_DIR);
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("claude-x.json"), "{}").unwrap();
    let one = permission(&sample("per_01", "bash", &[], json!({}))).unwrap();
    let two = permission(&sample("per/02", "edit", &[], json!({}))).unwrap();
    sync_waiting(&app_dir, &[one.clone(), two]);
    let saved: Value = serde_json::from_str(&fs::read_to_string(dir.join("opencode-permission-per_01.json")).unwrap()).unwrap();
    assert_eq!(saved, json!({ "hook_event_name": "PermissionRequest", "session_id": "ses_1" }));
    assert!(dir.join("opencode-permission-per%2F02.json").exists());
    sync_waiting(&app_dir, &[one]);
    assert!(!dir.join("opencode-permission-per%2F02.json").exists());
    sync_waiting(&app_dir, &[]);
    assert!(!dir.join("opencode-permission-per_01.json").exists());
    assert!(dir.join("claude-x.json").exists());
}

#[test]
fn offered_requests_close_when_answered_on_either_side() {
    let shared = new_shared(Duration::from_secs(5), Arc::new(|_| {}));
    let input = || HookInput {
        session_id: "ses_1".into(),
        cwd: None,
        tool_name: "Bash".into(),
        tool_input: json!({ "command": "ls" }),
        permission_suggestions: None,
        agent_id: None,
        remote_host: None,
    };
    assert!(shared.offer(Agent::Opencode, input()).is_none());
    shared.set_enabled(true);
    let first = shared.offer(Agent::Opencode, input()).unwrap();
    assert_eq!(first.agent, Agent::Opencode);
    shared.close_elsewhere(first.id);
    assert_eq!(shared.wait_for(first.id), (None, CloseReason::AnsweredElsewhere));
    shared.close(first.id, CloseReason::AnsweredElsewhere);
    let second = shared.offer(Agent::Opencode, input()).unwrap();
    let outcome = Outcome { decision: Decision::Deny, message: Some("no".into()), answers: None };
    shared.decide(second.id, outcome.clone()).unwrap();
    assert_eq!(shared.wait_for(second.id), (Some(outcome), CloseReason::Decided));
    shared.close(second.id, CloseReason::Decided);
    assert!(shared.pending().is_empty());
}

#[test]
fn dechunks_split_bodies() {
    let (status, body) = parse_response(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\n{\"a\"\r\n3\r\n:1}\r\n0\r\n\r\n").unwrap();
    assert_eq!((status, body.as_str()), (200, "{\"a\":1}"));
    assert!(parse_response(b"garbage").is_err());
}
