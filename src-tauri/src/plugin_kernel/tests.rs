use std::{
    sync::{mpsc, Mutex},
    time::{Duration, Instant},
};

use plugin_base::{find_node, Event, HostSpec, HostState, NodeSearch, Supervisor, Timing, MINIMUM_NODE};
use serde_json::Value;

use super::{containment, enabled, host_args, host_script, window_origins};

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
    let args = host_args("/data".into(), &window_origins(Some("http://localhost:1420")));
    let text: Vec<String> = args.iter().map(|arg| arg.to_string_lossy().into_owned()).collect();
    assert_eq!(text.iter().filter(|arg| *arg == "--origin").count(), 4);
    assert!(text.windows(2).any(|pair| pair == ["--origin", "http://localhost:1420"]));
    assert_eq!(text[0], "--disallow-code-generation-from-strings");
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
