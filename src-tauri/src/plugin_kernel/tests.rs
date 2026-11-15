use std::{
    sync::{mpsc, Mutex},
    time::{Duration, Instant},
};

use plugin_base::{find_node, Event, HostSpec, HostState, NodeSearch, Supervisor, Timing, MINIMUM_NODE};
use serde_json::Value;

use super::{containment, enabled, host_args, host_script, window_origins, HostMode};

#[test]
fn the_host_only_starts_in_a_development_build_with_the_switch_on() {
    assert!(enabled(true, Some("1")));
    assert!(!enabled(true, None));
    assert!(!enabled(true, Some("0")));
    assert!(!enabled(false, Some("1")));
}

#[test]
fn the_development_host_script_is_the_one_in_the_repository() {
    assert!(host_script().is_file(), "{}", host_script().display());
}

#[test]
fn windows_from_the_release_build_and_the_dev_server_may_connect() {
    assert_eq!(window_origins(None), ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"]);
    assert_eq!(window_origins(Some("http://localhost:1420/")).last().map(String::as_str), Some("http://localhost:1420"));
    let args = host_args("/data".into(), &window_origins(Some("http://localhost:1420")), &HostMode::default());
    let text: Vec<String> = args.iter().map(|arg| arg.to_string_lossy().into_owned()).collect();
    assert_eq!(text.iter().filter(|arg| *arg == "--origin").count(), 4);
    assert!(text.windows(2).any(|pair| pair == ["--origin", "http://localhost:1420"]));
    assert_eq!(text[0], "--disallow-code-generation-from-strings");
}

fn args_for(mode: &HostMode) -> Vec<String> {
    host_args("/data".into(), &[], mode).iter().map(|arg| arg.to_string_lossy().into_owned()).collect()
}

#[test]
fn a_development_host_hot_reloads_and_a_release_host_never_does() {
    let release = args_for(&HostMode::from(false, None));
    assert!(!release.iter().any(|arg| arg == "--dev" || arg == "--expose-internals"), "{release:?}");
    let development = args_for(&HostMode::from(true, None));
    assert_eq!(&development[..2], ["--disallow-code-generation-from-strings", "--expose-internals"], "Node flags come before the script");
    assert!(development.iter().position(|arg| arg == "--dev") > development.iter().position(|arg| arg.ends_with("main.mjs")), "--dev is the host's own flag, after the script");
}

#[test]
fn safe_mode_is_passed_on_only_when_it_names_a_known_mode() {
    assert!(args_for(&HostMode::from(true, Some("third-party"))).windows(2).any(|pair| pair == ["--safe", "third-party"]));
    assert!(args_for(&HostMode::from(true, Some(" minimal "))).windows(2).any(|pair| pair == ["--safe", "minimal"]));
    for odd in ["", "everything", "1"] {
        assert!(!args_for(&HostMode::from(true, Some(odd))).iter().any(|arg| arg == "--safe"), "{odd}");
    }
}

fn wait_for(states: &mpsc::Receiver<HostState>, ready: bool) -> HostState {
    let deadline = Instant::now() + Duration::from_secs(60);
    loop {
        let state = states.recv_timeout(deadline.saturating_duration_since(Instant::now())).expect("the host's state did not change in time");
        match (&state, ready) {
            (HostState::Ready { .. }, true) | (HostState::Down { .. }, false) => return state,
            _ => {}
        }
    }
}

#[test]
#[ignore = "needs `pnpm install` and Node 22.15 or newer; run with `cargo test -- --ignored plugin_kernel`"]
fn the_real_host_starts_under_the_supervisor_reports_its_plugins_and_comes_back_after_a_crash() {
    let node = find_node(&NodeSearch::from_env(), MINIMUM_NODE).expect("Node 22.15 or newer");
    let dir = std::env::temp_dir().join(format!("fuyu-plugin-kernel-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("hello.mjs"), "export const name = \"hello\";\nexport function apply(ctx) {\n  ctx.effect(() => {\n    const timer = setInterval(() => {}, 1000);\n    return () => clearInterval(timer);\n  });\n}\n").unwrap();
    std::fs::write(dir.join("plugins.yml"), "- id: hello\n  name: ./hello.mjs\n").unwrap();
    let spec = HostSpec {
        program: node.path,
        args: vec!["--disallow-code-generation-from-strings".into(), host_script().into(), "--dir".into(), dir.clone().into()],
        env: Vec::new(),
        current_dir: None,
    };
    let (tx, states) = mpsc::channel();
    let tx = Mutex::new(tx);
    let supervisor = Supervisor::start(spec, containment::shared(), Timing { ping_every: Duration::from_millis(200), ..Timing::default() }, move |event| {
        if let Event::State(state) = event {
            let _ = tx.lock().map(|tx| tx.send(state));
        }
    })
    .unwrap();

    let HostState::Ready { pid, ready, .. } = wait_for(&states, true) else { unreachable!() };
    assert_eq!(ready["protocol"], 1);
    assert_eq!(ready["plugins"][0]["id"], "hello");
    assert_eq!(ready["plugins"][0]["state"], "running");
    assert!(ready["windows"]["port"].as_u64().is_some_and(|port| port > 0));
    assert_eq!(ready["windows"]["token"].as_str().map(str::len), Some(64));
    let status = supervisor.call("status", Value::Null, Duration::from_secs(5)).unwrap();
    assert_eq!(status[0]["state"], "running");

    let killed = Instant::now();
    #[cfg(unix)]
    let _ = std::process::Command::new("kill").args(["-9", &pid.to_string()]).status();
    #[cfg(windows)]
    let _ = std::process::Command::new("taskkill").args(["/F", "/PID", &pid.to_string()]).status();
    wait_for(&states, false);
    let HostState::Ready { pid: again, .. } = wait_for(&states, true) else { unreachable!() };
    assert_ne!(pid, again);
    assert!(killed.elapsed() < Duration::from_secs(10), "back after {:?}", killed.elapsed());

    supervisor.stop();
    assert_eq!(supervisor.state(), HostState::Stopped);
    let _ = std::fs::remove_dir_all(dir);
}

mod protocol_and_command {
    use std::sync::Mutex;

    use plugin_base::HostState;
    use serde_json::json;
    use tauri::http::{Method, Request, StatusCode};

    use super::super::{connection_from, connection_now, protocol};

    fn get(root: Option<&std::path::Path>, path: &str, method: Method) -> tauri::http::Response<Vec<u8>> {
        let request = Request::builder().method(method).uri(format!("fuyu-plugin://localhost{path}")).body(Vec::new()).unwrap();
        protocol::respond(root, &request)
    }

    #[test]
    fn plugin_files_are_served_with_their_type_and_cors_and_nothing_outside_the_folder() {
        let dir = std::env::temp_dir().join(format!("fuyu-plugin-protocol-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("hello")).unwrap();
        std::fs::write(dir.join("hello/island.js"), "export default () => {};").unwrap();
        std::fs::write(dir.join("hello/style.css"), "a{}").unwrap();
        std::fs::write(dir.with_extension("secret"), "secret").unwrap();
        let ok = get(Some(&dir), "/hello/island.js", Method::GET);
        assert_eq!(ok.status(), StatusCode::OK);
        assert_eq!(ok.headers()["content-type"], "text/javascript; charset=utf-8");
        assert_eq!(ok.headers()["access-control-allow-origin"], "*");
        assert_eq!(ok.body(), b"export default () => {};");
        assert_eq!(get(Some(&dir), "/hello/style.css", Method::GET).headers()["content-type"], "text/css; charset=utf-8");
        let head = get(Some(&dir), "/hello/island.js", Method::HEAD);
        assert_eq!((head.status(), head.body().len()), (StatusCode::OK, 0));
        for path in ["/hello/missing.js", "/../secret", "/hello/..%2F..%2Fsecret", "/hello\\island.js", "/"] {
            let response = get(Some(&dir), path, Method::GET);
            assert_eq!(response.status(), StatusCode::NOT_FOUND, "{path}");
            assert_eq!(response.headers()["content-type"], "text/plain; charset=utf-8");
        }
        assert_eq!(get(None, "/hello/island.js", Method::GET).status(), StatusCode::NOT_FOUND, "nothing is served while the host is off");
        assert_eq!(get(Some(&dir), "/hello/island.js", Method::POST).status(), StatusCode::METHOD_NOT_ALLOWED);
        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_file(dir.with_extension("secret"));
    }

    #[test]
    fn the_shared_react_modules_come_from_the_app_itself() {
        let dir = std::env::temp_dir();
        let react = get(Some(&dir), "/__shared/react.js", Method::GET);
        assert_eq!(react.status(), StatusCode::OK);
        assert!(String::from_utf8_lossy(react.body()).contains("__FUYU_SHARED__.react"));
        assert_eq!(get(Some(&dir), "/__shared/react-jsx-runtime.js", Method::GET).status(), StatusCode::OK);
    }

    #[test]
    fn a_window_learns_the_port_and_token_only_once_the_host_is_ready() {
        assert!(!connection_from(false, None).enabled);
        let preparing = connection_from(true, None);
        assert!(preparing.enabled && preparing.port.is_none(), "Node is still being found or downloaded");
        let starting = connection_from(true, Some(&HostState::Starting { generation: 1 }));
        assert!(starting.enabled && starting.port.is_none() && starting.token.is_none());
        let ready = connection_from(true, Some(&HostState::Ready { generation: 3, pid: 9, ready: json!({ "windows": { "port": 51234, "token": "abc" } }) }));
        assert_eq!((ready.port, ready.token.as_deref(), ready.generation), (Some(51234), Some("abc"), Some(3)));
    }

    #[test]
    fn a_window_that_asks_before_the_kernel_is_set_up_is_told_to_wait_not_that_it_is_off() {
        let early = connection_now(true, None);
        assert!(early.enabled && early.port.is_none(), "the island window can load before setup reaches the plugin kernel");
        assert!(!connection_now(false, None).enabled);
        let empty = Mutex::new(None);
        assert!(connection_now(true, Some(&empty)).enabled);
    }
}
