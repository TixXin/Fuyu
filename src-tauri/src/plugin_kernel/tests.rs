use std::{
    sync::{mpsc, Mutex},
    time::{Duration, Instant},
};

use plugin_base::{find_node, Event, HostSpec, HostState, NodeSearch, Supervisor, Timing, MINIMUM_NODE};
use serde_json::Value;

use super::{containment, safe_mode::{self, Cause, Tracker}, enabled, host_args, host_env, host_script, memory_of, window_origins, HostMode, MEMORY_MEASURE};

#[test]
fn on_windows_the_host_gets_a_smaller_threadpool_unless_the_user_already_chose_one() {
    let env = host_env(true, None);
    assert_eq!(env.len(), 1);
    assert_eq!((env[0].0.to_str(), env[0].1.to_str()), (Some("UV_THREADPOOL_SIZE"), Some("2")));
    assert!(host_env(true, Some("8")).is_empty(), "an explicit size from the environment is passed through unchanged");
    assert!(host_env(false, None).is_empty(), "other systems do not commit thread stacks up front");
}

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

fn mode(development: bool, variable: Option<&str>) -> HostMode {
    HostMode { development, safe: safe_mode::choose(variable, false, 0).map(|safe| safe.mode) }
}

fn args_for(mode: &HostMode) -> Vec<String> {
    host_args("/data".into(), &[], mode).iter().map(|arg| arg.to_string_lossy().into_owned()).collect()
}

#[test]
fn a_development_host_hot_reloads_and_a_release_host_never_does() {
    let release = args_for(&mode(false, None));
    assert!(!release.iter().any(|arg| arg == "--dev" || arg == "--expose-internals"), "{release:?}");
    let development = args_for(&mode(true, None));
    assert_eq!(&development[..2], ["--disallow-code-generation-from-strings", "--expose-internals"], "Node flags come before the script");
    assert!(development.iter().position(|arg| arg == "--dev") > development.iter().position(|arg| arg.ends_with("main.mjs")), "--dev is the host's own flag, after the script");
}

#[test]
fn safe_mode_is_passed_on_only_when_it_names_a_known_mode() {
    assert!(args_for(&mode(true, Some("third-party"))).windows(2).any(|pair| pair == ["--safe", "third-party"]));
    assert!(args_for(&mode(true, Some(" minimal "))).windows(2).any(|pair| pair == ["--safe", "minimal"]));
    for odd in ["", "everything", "1"] {
        assert!(!args_for(&mode(true, Some(odd))).iter().any(|arg| arg == "--safe"), "{odd}");
    }
}

#[test]
fn the_host_gets_the_built_in_plugin_list_and_the_app_version() {
    let args = args_for(&HostMode::default());
    let builtins = args.windows(2).find(|pair| pair[0] == "--builtins").map(|pair| std::path::PathBuf::from(&pair[1])).expect("--builtins is passed");
    assert!(builtins.join("builtins.json").is_file(), "{}", builtins.display());
    assert!(args.windows(2).any(|pair| pair == ["--app-version", env!("CARGO_PKG_VERSION")]), "{args:?}");
    assert!(args.iter().position(|arg| arg == "--app-version") > args.iter().position(|arg| arg.ends_with("main.mjs")), "--app-version is the host's own flag, after the script");
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
    std::fs::write(dir.join("asks.mjs"), "import { writeFileSync } from \"node:fs\";\nexport const name = \"asks\";\nexport async function apply(ctx) {\n  const version = await ctx.rust.call(\"app.version\");\n  const echo = await ctx.rust.call(\"app.echo\", { value: [1] });\n  const platform = await ctx.rust.call(\"app.platformSupport\");\n  const missing = await ctx.rust.call(\"app.nope\").catch((error) => error.code);\n  writeFileSync(new URL(\"./asked.json\", import.meta.url), JSON.stringify({ version, echo, missing, platform: platform.os }));\n}\n").unwrap();
    std::fs::write(dir.join("plugins.yml"), "- id: hello\n  name: ./hello.mjs\n- id: asks\n  name: ./asks.mjs\n").unwrap();
    let spec = HostSpec {
        program: node.path,
        args: vec!["--disallow-code-generation-from-strings".into(), host_script().into(), "--dir".into(), dir.clone().into()],
        env: Vec::new(),
        current_dir: None,
    };
    let (tx, states) = mpsc::channel();
    let tx = Mutex::new(tx);
    let serve = std::sync::Arc::new(super::methods::registered().unwrap());
    let timing = Timing { ping_every: Duration::from_millis(200), ..Timing::default() };
    let supervisor = Supervisor::start_serving(move |_| spec.clone(), containment::shared(), timing, Some(serve), move |event| {
        if let Event::State(state) = event {
            let _ = tx.lock().map(|tx| tx.send(state));
        }
    })
    .unwrap();

    let HostState::Ready { pid, ready, .. } = wait_for(&states, true) else { unreachable!() };
    assert_eq!(ready["protocol"], 2);
    assert_eq!(ready["plugins"][0]["id"], "hello");
    assert_eq!(ready["plugins"][0]["state"], "running");
    assert!(ready["windows"]["port"].as_u64().is_some_and(|port| port > 0));
    assert_eq!(ready["windows"]["token"].as_str().map(str::len), Some(64));
    let status = supervisor.call("status", Value::Null, Duration::from_secs(5)).unwrap();
    assert_eq!(status[0]["state"], "running");
    let deadline = Instant::now() + Duration::from_secs(10);
    while !dir.join("asked.json").exists() && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(20));
    }
    let asked: Value = serde_json::from_str(&std::fs::read_to_string(dir.join("asked.json")).unwrap()).unwrap();
    assert_eq!(asked, serde_json::json!({ "version": { "version": env!("CARGO_PKG_VERSION"), "platform": std::env::consts::OS }, "echo": { "echo": [1] }, "missing": "no-method", "platform": if cfg!(target_os = "macos") { "macos" } else { "windows" } }));

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

#[test]
fn the_plugin_page_gets_the_hosts_private_memory_only_while_it_runs() {
    assert_eq!(memory_of(None, |_| Some(1)), None);
    assert_eq!(memory_of(Some(7), |_| None), None);
    let memory = memory_of(Some(7), |pid| Some(u64::from(pid) * 1024)).map(|memory| serde_json::to_value(memory).unwrap_or_default());
    assert_eq!(memory, Some(serde_json::json!({ "pid": 7, "bytes": 7168, "measure": MEMORY_MEASURE })));
    assert_eq!(MEMORY_MEASURE, if cfg!(windows) { "private-working-set" } else { "phys-footprint" });
    assert!(crate::platform::private_memory::private_bytes(std::process::id()).is_some());
}

#[test]
fn safe_mode_comes_from_the_variable_then_repeated_failures_then_shift() {
    let pick = |variable, shift, failures| safe_mode::choose(variable, shift, failures).map(|safe| (safe.mode, safe.cause));
    assert_eq!(pick(None, false, 0), None);
    assert_eq!(pick(None, false, 1), None);
    assert_eq!(pick(None, true, 0), Some(("third-party".into(), Cause::Shift)));
    assert_eq!(pick(None, false, 2), Some(("third-party".into(), Cause::Failures)));
    assert_eq!(pick(None, true, 4), Some(("minimal".into(), Cause::Failures)));
    assert_eq!(pick(Some("minimal"), true, 9), Some(("minimal".into(), Cause::Variable)));
    assert_eq!(pick(Some("third-party"), false, 9), Some(("third-party".into(), Cause::Variable)));
    assert_eq!(pick(Some("bogus"), false, 2), Some(("third-party".into(), Cause::Failures)));
}

fn scratch(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-safe-mode-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn two_starts_that_fail_early_put_the_next_start_in_safe_mode_and_the_count_survives_a_relaunch() {
    let dir = scratch("count");
    let mut tracker = Tracker::new(Some(&dir), None, false);
    assert_eq!(tracker.starting(1), None);
    tracker.went_down_after(1, Some(Duration::from_secs(3)));
    assert_eq!(tracker.starting(2), None);
    tracker.went_down_after(2, Some(Duration::from_secs(59)));
    let safe = tracker.starting(3).unwrap();
    assert_eq!((safe.mode.as_str(), safe.cause, safe.failures), ("third-party", Cause::Failures, 2));
    let saved: serde_json::Value = serde_json::from_slice(&std::fs::read(dir.join(safe_mode::FILE)).unwrap()).unwrap();
    assert_eq!(saved["failures"], 2);
    assert!(saved["updatedAt"].as_u64().unwrap() > 0);

    let mut relaunched = Tracker::new(Some(&dir), None, false);
    assert_eq!(relaunched.starting(1).map(|safe| safe.failures), Some(2), "a new run picks the count up from the file");
    relaunched.went_down_after(1, Some(Duration::from_secs(1)));
    relaunched.went_down_after(2, Some(Duration::from_secs(1)));
    assert_eq!(relaunched.starting(3).map(|safe| safe.mode), Some("minimal".into()), "still failing in safe mode goes down to the minimal set");
    relaunched.went_down_after(3, Some(Duration::from_secs(61)));
    assert_eq!(relaunched.starting(4), None, "a start that ran a full minute clears the count");
    let saved: serde_json::Value = serde_json::from_slice(&std::fs::read(dir.join(safe_mode::FILE)).unwrap()).unwrap();
    assert_eq!(saved["failures"], 0);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_down_for_a_start_that_is_not_the_current_one_is_not_counted() {
    let mut tracker = Tracker::new(None, None, false);
    tracker.starting(5);
    tracker.went_down(4, "the plugin host exited (exit status: 1)");
    tracker.went_down(5, "the plugin host exited (exit status: 1)");
    tracker.went_down(5, "the plugin host exited (exit status: 1)");
    assert_eq!(tracker.starting(6), None, "only the first down of start 5 counts, and one failure is not enough");
}

#[test]
fn shift_holds_only_this_run_and_leaving_safe_mode_clears_shift_and_failures_but_not_the_variable() {
    let dir = scratch("leave");
    let mut held = Tracker::new(Some(&dir), None, true);
    assert_eq!(held.starting(1).map(|safe| safe.cause), Some(Cause::Shift));
    assert!(!dir.join(safe_mode::FILE).exists(), "holding Shift is not written down");
    assert!(held.leave());
    held.went_down(1, "asked to restart");
    assert_eq!(held.starting(2), None, "the restart after leaving is a normal start and its down is not a failure");
    assert_eq!(Tracker::new(Some(&dir), None, false).starting(1), None, "the next launch without Shift is normal");

    let mut failing = Tracker::new(Some(&dir), None, false);
    failing.starting(1);
    failing.went_down_after(1, Some(Duration::from_secs(1)));
    failing.starting(2);
    failing.went_down_after(2, Some(Duration::from_secs(1)));
    assert!(failing.starting(3).is_some());
    assert!(failing.leave());
    assert_eq!(failing.starting(4), None);
    assert_eq!(Tracker::new(Some(&dir), None, false).starting(1), None, "leaving clears the saved count too");

    let mut variable = Tracker::new(Some(&dir), Some("third-party".into()), false);
    assert_eq!(variable.starting(1).map(|safe| safe.cause), Some(Cause::Variable));
    assert!(!variable.leave(), "safe mode from the variable stays until the variable is removed");
    assert!(variable.starting(2).is_some());
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn restarts_that_were_asked_for_and_heartbeats_missed_across_sleep_are_not_failures() {
    let second = Duration::from_secs(1);
    assert!(safe_mode::counts_as_failure("the plugin host exited (exit status: 1)", 3 * second, 3 * second));
    assert!(safe_mode::counts_as_failure("the plugin host was not ready in 60000 ms", 59 * second, 59 * second));
    assert!(safe_mode::counts_as_failure("the plugin host did not answer a heartbeat in 2000 ms", 10 * second, 11 * second), "a host that hangs while the computer is awake counts");
    assert!(!safe_mode::counts_as_failure("asked to restart", second, second), "restarting from the plugin page is not a failure");
    assert!(!safe_mode::counts_as_failure("the plugin host did not answer a heartbeat in 2000 ms", 10 * second, 40 * second), "the wall clock ran ahead of the monotonic one: the computer slept, so the missed heartbeat does not count");
    assert!(!safe_mode::counts_as_failure("the plugin host did not answer a heartbeat in 2000 ms", 70 * second, 70 * second), "a host that ran a full minute is healthy however it went down");

    let mut tracker = Tracker::new(None, None, false);
    for generation in 1..=3 {
        tracker.starting(generation);
        tracker.went_down(generation, "asked to restart");
    }
    assert_eq!(tracker.starting(4), None, "restarts on request never add up to safe mode");
    tracker.went_down(4, "the plugin host exited (exit status: 1)");
    tracker.starting(5);
    tracker.went_down(5, "the plugin host exited (exit status: 1)");
    assert_eq!(tracker.starting(6).map(|safe| safe.cause), Some(Cause::Failures));
}

const GENERATED: &str = "../packages/plugin-services/src/generated";

#[test]
fn the_apps_own_rust_methods_are_registered_once() {
    let serve = super::methods::registered().unwrap();
    for name in ["app.echo", "app.platformSupport", "app.version"] {
        assert!(serve.names().contains(&name), "{name} is missing from {:?}", serve.names());
    }
}

#[test]
fn the_generated_typescript_for_rust_methods_is_up_to_date() {
    let (declarations, list) = plugin_base::ts::typescript(&plugin_base::ts::described());
    let dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(GENERATED);
    let files = [("rust.d.mts", declarations), ("rust.mjs", list)];
    if std::env::var("FUYU_WRITE_RUST_TYPES").as_deref() == Ok("1") {
        std::fs::create_dir_all(&dir).unwrap();
        for (name, text) in &files {
            std::fs::write(dir.join(name), text).unwrap();
        }
        return;
    }
    for (name, text) in &files {
        let written = std::fs::read_to_string(dir.join(name)).unwrap_or_default().replace("\r\n", "\n");
        assert!(&written == text, "packages/plugin-services/src/generated/{name} is out of date; run pnpm gen:rust-types\n--- expected ---\n{text}");
    }
}
