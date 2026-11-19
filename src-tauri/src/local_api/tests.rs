use serde_json::json;

use super::config::{generate_token, is_valid_token, load_config, LocalApiConfig, PREFERRED_PORT};
use super::routes::{check_access, route, RequestHeaders};

const TOKEN: &str = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

fn headers(host: &str, authorization: Option<&str>) -> RequestHeaders {
    RequestHeaders {
        host: Some(host.to_string()),
        origin: None,
        authorization: authorization.map(str::to_string),
    }
}

#[test]
fn access_needs_the_token_and_a_local_host() {
    let bearer = format!("Bearer {TOKEN}");
    assert!(check_access(&headers("127.0.0.1:4000", Some(&bearer)), TOKEN, 4000).is_ok());
    assert!(check_access(&headers("localhost:4000", Some(&bearer)), TOKEN, 4000).is_ok());

    let wrong = check_access(&headers("127.0.0.1:4000", Some("Bearer nope")), TOKEN, 4000);
    assert_eq!(wrong.map_err(|error| error.status), Err(401));
    let missing = check_access(&headers("127.0.0.1:4000", None), TOKEN, 4000);
    assert_eq!(missing.map_err(|error| error.status), Err(401));

    let rebinding = check_access(&headers("evil.example:4000", Some(&bearer)), TOKEN, 4000);
    assert_eq!(rebinding.map_err(|error| error.status), Err(403));
    let other_port = check_access(&headers("127.0.0.1:4001", Some(&bearer)), TOKEN, 4000);
    assert_eq!(other_port.map_err(|error| error.status), Err(403));
}

#[test]
fn access_rejects_browser_requests() {
    let mut request = headers("127.0.0.1:4000", Some(&format!("Bearer {TOKEN}")));
    request.origin = Some("https://example.com".into());
    assert_eq!(check_access(&request, TOKEN, 4000).map_err(|error| error.status), Err(403));
}

#[test]
fn routes_map_to_methods() {
    let list = route("GET", "/v1/todos?x=1", b"").expect("list");
    assert_eq!((list.method, list.writes), ("todos.list", false));

    let add = route("POST", "/v1/todos", br#"{"title":"Buy milk"}"#).expect("add");
    assert_eq!((add.method, add.writes), ("todos.add", true));
    assert_eq!(add.params, json!({ "title": "Buy milk" }));

    let update = route("PATCH", "/v1/todos/abc-123", br#"{"completed":true}"#).expect("update");
    assert_eq!(update.method, "todos.update");
    assert_eq!(update.params, json!({ "completed": true, "id": "abc-123" }));

    let remove = route("DELETE", "/v1/todos/abc-123/", b"").expect("remove");
    assert_eq!(remove.params, json!({ "id": "abc-123" }));

    assert_eq!(route("GET", "/v1/note", b"").expect("note").method, "note.get");
    let clipboard = route("GET", "/v1/clipboard?limit=5", b"").expect("clipboard");
    assert_eq!((clipboard.method, clipboard.params["limit"].as_u64(), clipboard.writes), ("clipboard.list", Some(5), false));
    assert_eq!(route("PUT", "/v1/note", br#"{"note":"hi"}"#).expect("note").method, "note.set");
    assert_eq!(route("GET", "/v1/health", b"").expect("health").method, "health");

    let report = route("PUT", "/v1/agent-status/aider", br#"{"phase":"running","source":"other"}"#).expect("report");
    assert_eq!((report.method, report.writes), ("agentStatus.report", true));
    assert_eq!(report.params, json!({ "phase": "running", "source": "aider" }));
    let clear = route("DELETE", "/v1/agent-status/aider", b"").expect("clear");
    assert_eq!((clear.method, clear.params), ("agentStatus.clear", json!({ "source": "aider" })));
    assert_eq!(route("GET", "/v1/agent-status/aider", b"").map_err(|error| error.status), Err(405));
}

#[test]
fn routes_reject_bad_requests() {
    let status = |method: &str, url: &str, body: &[u8]| route(method, url, body).map_err(|error| error.status);
    assert_eq!(status("GET", "/v2/todos", b""), Err(404));
    assert_eq!(status("PUT", "/v1/todos", b""), Err(405));
    assert_eq!(status("POST", "/v1/todos", b"not json"), Err(400));
    assert_eq!(status("POST", "/v1/todos", b"[1,2]"), Err(400));
    assert_eq!(status("DELETE", "/v1/todos/..%2F", b""), Err(404));
    let update = route("PATCH", "/v1/todos/a", br#"{"id":"b"}"#).expect("update");
    assert_eq!(update.params["id"], "a");
}

#[test]
fn config_fills_in_a_token_and_keeps_saved_values() {
    let dir = std::env::temp_dir().join(format!("fuyu-local-api-{}", std::process::id()));
    std::fs::create_dir_all(&dir).expect("temp dir");
    let path = dir.join("local-api.json");

    std::fs::write(&path, "not json").expect("write");
    let (config, changed) = load_config(&path).expect("load");
    assert!(changed);
    assert!(!config.enabled);
    assert_eq!(config.port, PREFERRED_PORT);
    assert!(is_valid_token(&config.token));

    let saved = LocalApiConfig { enabled: true, allow_write: true, allow_notify: true, port: 40000, token: TOKEN.into() };
    std::fs::write(&path, serde_json::to_string(&saved).expect("json")).expect("write");
    assert_eq!(load_config(&path).expect("load"), (saved, false));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn tokens_are_random_hex() {
    let first = generate_token().expect("token");
    assert!(is_valid_token(&first));
    assert_ne!(first, generate_token().expect("token"));
}

#[test]
fn dev_island_routes_need_no_write_permission() {
    let emit = route("POST", "/v1/dev/island/emit", br#"{"event":"device-alert","payload":{}}"#).expect("emit");
    assert_eq!((emit.method, emit.writes), ("devIsland.emit", false));
    assert_eq!(route("POST", "/v1/dev/island/action", br#"{"action":"collapse"}"#).expect("action").method, "devIsland.action");
    assert_eq!(route("PUT", "/v1/dev/island/notch", br#"{"width":208,"height":37.5}"#).expect("notch").params["width"], 208);
    assert_eq!(route("DELETE", "/v1/dev/island/notch", b"").expect("clear").params, serde_json::Value::Null);
    assert_eq!(route("PUT", "/v1/dev/island/edge", br#"{"edge":"left"}"#).expect("edge").method, "devIsland.edge");
    assert_eq!(route("POST", "/v1/dev/island/edge", b"{}").map_err(|error| error.status), Err(405));
    assert_eq!(route("GET", "/v1/dev/island/emit", b"").map_err(|error| error.status), Err(405));
    assert_eq!(route("POST", "/v1/dev/island/emit", b"[]").map_err(|error| error.status), Err(400));
}

#[test]
fn island_lab_serves_only_dev_island_and_agent_status() {
    use super::lab::lab_call;
    assert_eq!(lab_call("POST", "/v1/dev/island/emit", b"{}").expect("emit").method, "devIsland.emit");
    assert_eq!(lab_call("PUT", "/v1/agent-status/lab", br#"{"phase":"running"}"#).expect("status").method, "agentStatus.report");
    assert_eq!(lab_call("GET", "/v1/health", b"").expect("health").method, "health");
    assert_eq!(lab_call("GET", "/v1/todos", b"").map_err(|error| error.status), Err(404));
    assert_eq!(lab_call("POST", "/v1/dev/plugins", br#"{"path":"/tmp"}"#).map_err(|error| error.status), Err(404));
}

#[test]
fn routes_to_a_switched_off_feature_answer_503() {
    use super::switches::check_with;
    let off = |plugin: &str| plugin != "todos" && plugin != "agents" && plugin != "clipboard" && plugin != "messages";
    for method in ["todos.list", "todos.add", "note.get", "note.set", "agentStatus.report", "agentStatus.clear", "clipboard.list", "notify"] {
        let error = check_with(method, off).expect_err(method);
        assert_eq!(error.status, 503, "{method}");
        assert!(error.message.contains("switched off"), "{method}");
    }
    for method in ["health", "devIsland.emit"] {
        assert!(check_with(method, off).is_ok(), "{method}");
    }
    assert!(check_with("todos.list", |plugin| plugin == "todos").is_ok());
    assert!(check_with("agentStatus.report", |plugin| plugin == "todos").is_err());
}

#[test]
fn the_server_is_the_background_listed_for_local_api() {
    use super::background::{PLUGIN_ID, SERVER};
    let catalog = crate::plugin_kernel::builtins::catalog();
    let plugin = catalog.iter().find(|plugin| plugin.id == PLUGIN_ID).expect("local-api is a built-in plugin");
    assert_eq!(plugin.background.as_deref(), Some(&[SERVER.to_owned()][..]));
}

#[test]
fn allow_write_reads_only_a_boolean() {
    use super::background::allow_write;
    let config = |value: serde_json::Value| value.as_object().cloned().unwrap_or_default();
    assert!(allow_write(&config(json!({ "allowWrite": true }))));
    assert!(!allow_write(&config(json!({ "allowWrite": "true" }))));
    assert!(!allow_write(&config(json!({}))));
}

#[test]
fn notify_is_a_route_of_its_own_that_does_not_need_the_write_switch() {
    let call = route("POST", "/v1/notify", br#"{"source":"ci","title":"Build passed"}"#).expect("notify");
    assert_eq!((call.method, call.writes), ("notify", false));
    assert_eq!(call.params, json!({ "source": "ci", "title": "Build passed" }));
    assert_eq!(route("GET", "/v1/notify", b"").map_err(|error| error.status), Err(405));
    assert_eq!(route("POST", "/v1/notify", b"[]").map_err(|error| error.status), Err(400));
}

#[test]
fn a_message_needs_a_source_and_a_title_and_stays_within_its_limits() {
    use super::notify::{island_params, parse};
    let status = |body: serde_json::Value| parse(&body).map_err(|error| error.status);

    let notice = parse(&json!({ "source": "ci", "title": "  Build passed  ", "body": "main is green", "name": "CI", "durationMs": 8000 })).expect("notice");
    assert_eq!((notice.source.as_str(), notice.title.as_str(), notice.body.as_str(), notice.name.as_deref(), notice.duration_ms), ("ci", "Build passed", "main is green", Some("CI"), 8000));
    assert_eq!(
        island_params("local-api", &notice, "CI"),
        json!({ "source": "local-api/ci", "name": "CI", "title": "Build passed", "body": "main is green", "durationMs": 8000 })
    );

    let plain = parse(&json!({ "source": "ci", "title": "Done" })).expect("plain");
    assert_eq!((plain.body.as_str(), plain.name, plain.duration_ms), ("", None, 5000));

    assert_eq!(status(json!({ "title": "No source" })), Err(400));
    assert_eq!(status(json!({ "source": "Bad Source", "title": "x" })), Err(400));
    assert_eq!(status(json!({ "source": "ci" })), Err(400));
    assert_eq!(status(json!({ "source": "ci", "title": "   " })), Err(400));
    assert_eq!(status(json!({ "source": "ci", "title": 5 })), Err(400));
    assert_eq!(status(json!({ "source": "ci", "title": "字".repeat(120) })).map(|notice| notice.title.chars().count()), Ok(120));
    assert_eq!(status(json!({ "source": "ci", "title": "字".repeat(121) })), Err(400));
    assert_eq!(status(json!({ "source": "ci", "title": "x", "body": "字".repeat(501) })), Err(400));
    assert_eq!(status(json!({ "source": "ci", "title": "x", "name": "n".repeat(41) })), Err(400));
    assert_eq!(status(json!({ "source": "ci", "title": "x", "durationMs": 999 })), Err(400));
    assert_eq!(status(json!({ "source": "ci", "title": "x", "durationMs": 30001 })), Err(400));
    assert_eq!(status(json!({ "source": "ci", "title": "x", "durationMs": "5000" })), Err(400));

    let unknown = parse(&json!({ "source": "ci", "title": "x", "actions": ["Open"] })).expect_err("actions are not taken yet");
    assert_eq!(unknown.status, 400);
    assert!(unknown.message.contains("actions"));
    let icon = parse(&json!({ "source": "ci", "title": "x", "iconUrl": "https://example.com/a.png" })).expect_err("no remote icons");
    assert_eq!(icon.status, 400);
}

#[test]
fn a_source_is_held_to_ten_messages_a_minute_and_keeps_its_name() {
    use super::notify::{Senders, MAX_PER_WINDOW, WINDOW};
    use std::time::{Duration, Instant};
    let start = Instant::now();
    let mut senders = Senders::default();

    assert_eq!(senders.admit("ci", None, start).expect("first"), "ci");
    assert_eq!(senders.admit("ci", Some("CI"), start).expect("named"), "CI");
    assert_eq!(senders.admit("ci", None, start).expect("name is kept"), "CI");
    for _ in 3..MAX_PER_WINDOW {
        senders.admit("ci", None, start).expect("within the limit");
    }
    assert_eq!(senders.admit("ci", None, start + Duration::from_secs(30)).map_err(|error| error.status), Err(429));
    assert_eq!(senders.admit("deploy", None, start + Duration::from_secs(30)).expect("another source is not held back"), "deploy");
    assert_eq!(senders.admit("ci", None, start + WINDOW).expect("a minute later"), "CI");
}

#[test]
fn only_sixteen_sources_send_at_once_and_a_quiet_one_makes_room() {
    use super::notify::{Senders, MAX_SOURCES, WINDOW};
    use std::time::{Duration, Instant};
    let start = Instant::now();
    let mut senders = Senders::default();
    for index in 0..MAX_SOURCES {
        senders.admit(&format!("s{index}"), None, start + Duration::from_secs(index as u64)).expect("room");
    }
    let busy = start + Duration::from_secs(30);
    assert_eq!(senders.admit("late", None, busy).map_err(|error| error.status), Err(429));
    senders.admit("s3", None, busy).expect("a known source still sends");

    let later = start + WINDOW + Duration::from_secs(1);
    senders.admit("late", None, later).expect("s0 and s1 went quiet, so there is room");
    assert_eq!(senders.admit("s0", None, later).expect("s0 was dropped first and comes back as new"), "s0");
}

#[test]
fn allow_notify_reads_only_a_boolean() {
    use super::background::allow_notify;
    let config = |value: serde_json::Value| value.as_object().cloned().unwrap_or_default();
    assert!(allow_notify(&config(json!({ "allowNotify": true }))));
    assert!(!allow_notify(&config(json!({ "allowNotify": 1 }))));
    assert!(!allow_notify(&config(json!({ "allowWrite": true }))));
}
