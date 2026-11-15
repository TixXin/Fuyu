use std::{
    path::PathBuf,
    sync::{mpsc, Arc, Mutex},
    time::{Duration, Instant},
};

use plugin_base::{find_node, supervisor::NoContainment, Event, HostSpec, HostState, NodeSearch, NodeVersion, Serve, Supervisor, Timing};
use serde_json::{json, Value};

fn node() -> PathBuf {
    match find_node(&NodeSearch::from_env(), NodeVersion(18, 0, 0)) {
        Ok(found) => found.path,
        Err(tried) => panic!("these tests need Node on this machine: {tried:?}"),
    }
}

fn spec(mode: &str) -> HostSpec {
    spec_speaking(mode, 2)
}

fn spec_speaking(mode: &str, protocol: u32) -> HostSpec {
    let script = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/fake-host.mjs");
    HostSpec { program: node(), args: vec![script.into()], env: vec![("FAKE_HOST_MODE".into(), mode.into()), ("FAKE_HOST_PROTOCOL".into(), protocol.to_string().into())], current_dir: None }
}

fn fast() -> Timing {
    Timing {
        ready_within: Duration::from_secs(20),
        ping_every: Duration::from_millis(100),
        ping_timeout: Duration::from_millis(500),
        first_backoff: Duration::from_millis(100),
        max_backoff: Duration::from_millis(400),
        healthy_after: Duration::from_secs(60),
        stop_grace: Duration::from_secs(2),
    }
}

struct Watched {
    supervisor: Supervisor,
    states: mpsc::Receiver<HostState>,
    stderr: Arc<Mutex<Vec<String>>>,
}

fn start(mode: &str, timing: Timing) -> Watched {
    start_serving(spec(mode), timing, None)
}

fn start_serving(spec: HostSpec, timing: Timing, serve: Option<Serve>) -> Watched {
    let (tx, states) = mpsc::channel();
    let stderr = Arc::new(Mutex::new(Vec::new()));
    let lines = stderr.clone();
    let tx = Mutex::new(tx);
    let supervisor = Supervisor::start_serving(move |_| spec.clone(), Arc::new(NoContainment), timing, serve.map(Arc::new), move |event| match event {
        Event::State(state) => {
            let _ = tx.lock().unwrap().send(state);
        }
        Event::Stderr(line) => lines.lock().unwrap().push(line),
        Event::Notification { .. } => {}
    })
    .unwrap();
    Watched { supervisor, states, stderr }
}

fn wait_for(states: &mpsc::Receiver<HostState>, matches: impl Fn(&HostState) -> bool, within: Duration) -> HostState {
    let deadline = Instant::now() + within;
    loop {
        let left = deadline.saturating_duration_since(Instant::now());
        match states.recv_timeout(left) {
            Ok(state) if matches(&state) => return state,
            Ok(_) => {}
            Err(_) => panic!("the state did not arrive in {within:?}"),
        }
    }
}

fn ready_pid(state: &HostState) -> u32 {
    match state {
        HostState::Ready { pid, .. } => *pid,
        other => panic!("not ready: {other:?}"),
    }
}

fn pid_alive(pid: u32, supervisor: &Supervisor) -> bool {
    supervisor.call("who", Value::Null, Duration::from_millis(500)).ok().and_then(|value| value["pid"].as_u64()) == Some(u64::from(pid))
}

#[test]
fn the_host_becomes_ready_answers_calls_and_its_stderr_is_passed_on() {
    let watched = start("ok", fast());
    let pid = ready_pid(&wait_for(&watched.states, |state| matches!(state, HostState::Ready { .. }), Duration::from_secs(20)));
    assert!(pid_alive(pid, &watched.supervisor));
    assert!(watched.stderr.lock().unwrap().iter().any(|line| line == "fake host started"));
    watched.supervisor.stop();
    assert_eq!(watched.supervisor.state(), HostState::Stopped);
}

#[test]
fn a_host_that_dies_is_started_again_at_once() {
    let watched = start("ok", fast());
    let first = ready_pid(&wait_for(&watched.states, |state| matches!(state, HostState::Ready { .. }), Duration::from_secs(20)));
    let killed = Instant::now();
    let _ = watched.supervisor.call("die", Value::Null, Duration::from_millis(500));
    let down = wait_for(&watched.states, |state| matches!(state, HostState::Down { .. }), Duration::from_secs(5));
    assert!(matches!(&down, HostState::Down { reason, retry_in, .. } if reason.contains("exited") && retry_in.is_zero()), "{down:?}");
    let second = ready_pid(&wait_for(&watched.states, |state| matches!(state, HostState::Ready { .. }), Duration::from_secs(20)));
    assert_ne!(first, second);
    assert!(killed.elapsed() < Duration::from_secs(10), "back after {:?}", killed.elapsed());
    watched.supervisor.stop();
}

#[test]
fn a_host_that_stops_answering_heartbeats_is_replaced() {
    let watched = start("ok", fast());
    let first = ready_pid(&wait_for(&watched.states, |state| matches!(state, HostState::Ready { .. }), Duration::from_secs(20)));
    let _ = watched.supervisor.call("hang", Value::Null, Duration::from_millis(500));
    let down = wait_for(&watched.states, |state| matches!(state, HostState::Down { .. }), Duration::from_secs(5));
    assert!(matches!(&down, HostState::Down { reason, .. } if reason.contains("heartbeat")), "{down:?}");
    let second = ready_pid(&wait_for(&watched.states, |state| matches!(state, HostState::Ready { .. }), Duration::from_secs(20)));
    assert_ne!(first, second);
    watched.supervisor.stop();
}

#[test]
fn a_host_that_keeps_failing_waits_longer_each_time() {
    let watched = start("exit-at-once", fast());
    let mut waits = Vec::new();
    while waits.len() < 4 {
        if let HostState::Down { retry_in, reason, .. } = wait_for(&watched.states, |state| matches!(state, HostState::Down { .. }), Duration::from_secs(20)) {
            assert!(reason.contains("before it was ready"), "{reason}");
            waits.push(retry_in.as_millis());
        }
    }
    assert_eq!(waits, [0, 100, 200, 400]);
    watched.supervisor.stop();
}

#[test]
fn a_host_that_is_never_ready_is_given_up_on_after_the_deadline() {
    let watched = start("slow-ready", Timing { ready_within: Duration::from_millis(500), ..fast() });
    let down = wait_for(&watched.states, |state| matches!(state, HostState::Down { .. }), Duration::from_secs(10));
    assert!(matches!(&down, HostState::Down { reason, .. } if reason.contains("not ready")), "{down:?}");
    watched.supervisor.stop();
}

#[test]
fn stopping_asks_the_host_to_stop_and_calls_fail_afterwards() {
    let watched = start("ok", fast());
    wait_for(&watched.states, |state| matches!(state, HostState::Ready { .. }), Duration::from_secs(20));
    let started = Instant::now();
    watched.supervisor.stop();
    assert!(started.elapsed() < Duration::from_secs(3));
    assert!(watched.supervisor.call("who", Value::Null, Duration::from_millis(200)).is_err());
}

#[test]
fn a_host_that_dies_is_noticed_without_waiting_for_the_next_heartbeat() {
    let watched = start("ok", Timing { ping_every: Duration::from_secs(5), ..fast() });
    wait_for(&watched.states, |state| matches!(state, HostState::Ready { .. }), Duration::from_secs(20));
    let killed = Instant::now();
    let _ = watched.supervisor.call("die", Value::Null, Duration::from_millis(500));
    wait_for(&watched.states, |state| matches!(state, HostState::Down { .. }), Duration::from_secs(4));
    assert!(killed.elapsed() < Duration::from_secs(2), "noticed after {:?}, the heartbeat is every 5 s", killed.elapsed());
    watched.supervisor.stop();
}

#[test]
fn each_start_asks_for_its_own_spec_so_a_failing_host_can_come_back_differently() {
    let (tx, states) = mpsc::channel();
    let tx = Mutex::new(tx);
    let asked = Arc::new(Mutex::new(Vec::new()));
    let seen = asked.clone();
    let supervisor = Supervisor::start_with(
        move |generation| {
            seen.lock().unwrap().push(generation);
            spec(if generation < 3 { "exit-at-once" } else { "ok" })
        },
        Arc::new(NoContainment),
        fast(),
        move |event| {
            if let Event::State(state) = event {
                let _ = tx.lock().unwrap().send(state);
            }
        },
    )
    .unwrap();
    let ready = wait_for(&states, |state| matches!(state, HostState::Ready { .. }), Duration::from_secs(20));
    assert!(matches!(ready, HostState::Ready { generation: 3, .. }), "{ready:?}");
    assert_eq!(*asked.lock().unwrap(), [1, 2, 3]);
    supervisor.stop();
}

fn slow_table(finished: Arc<Mutex<Vec<&'static str>>>) -> Serve {
    let mut serve = Serve::new();
    serve.add("app.echo", Duration::from_secs(5), |params, _| Ok(json!({ "echo": params }))).unwrap();
    serve
        .add("test.slow", Duration::from_secs(10), move |_, call| {
            std::thread::sleep(Duration::from_millis(300));
            finished.lock().unwrap().push(if call.cancelled() { "cancelled" } else { "answered" });
            Ok(json!("late"))
        })
        .unwrap();
    serve
}

#[test]
fn the_host_calls_rust_through_the_supervisor() {
    let watched = start_serving(spec("ok"), fast(), Some(slow_table(Arc::default())));
    wait_for(&watched.states, |state| matches!(state, HostState::Ready { .. }), Duration::from_secs(20));
    let answer = watched.supervisor.call("ask", json!({ "method": "app.echo", "params": [1, 2] }), Duration::from_secs(5)).unwrap();
    assert_eq!(answer, json!({ "result": { "echo": [1, 2] } }));
    let answer = watched.supervisor.call("ask", json!({ "method": "nope" }), Duration::from_secs(5)).unwrap();
    assert_eq!(answer["error"]["code"], "no-method");
    watched.supervisor.stop();
}

#[test]
fn a_host_killed_while_rust_works_for_it_comes_back_and_the_late_result_is_dropped() {
    let finished = Arc::new(Mutex::new(Vec::new()));
    let watched = start_serving(spec("ok"), fast(), Some(slow_table(finished.clone())));
    let first = ready_pid(&wait_for(&watched.states, |state| matches!(state, HostState::Ready { .. }), Duration::from_secs(20)));
    let _ = watched.supervisor.call("ask-then-die", json!({ "method": "test.slow" }), Duration::from_millis(500));
    wait_for(&watched.states, |state| matches!(state, HostState::Down { .. }), Duration::from_secs(5));
    let second = ready_pid(&wait_for(&watched.states, |state| matches!(state, HostState::Ready { .. }), Duration::from_secs(20)));
    assert_ne!(first, second);
    let answer = watched.supervisor.call("ask", json!({ "method": "app.echo", "params": "again" }), Duration::from_secs(5)).unwrap();
    assert_eq!(answer, json!({ "result": { "echo": "again" } }));
    let deadline = Instant::now() + Duration::from_secs(5);
    while finished.lock().unwrap().is_empty() && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(20));
    }
    assert_eq!(*finished.lock().unwrap(), ["cancelled"]);
    watched.supervisor.stop();
}

#[test]
fn a_host_speaking_another_protocol_is_refused_with_both_versions() {
    let watched = start_serving(spec_speaking("ok", 1), fast(), None);
    let down = wait_for(&watched.states, |state| matches!(state, HostState::Down { .. }), Duration::from_secs(20));
    assert!(matches!(&down, HostState::Down { reason, .. } if reason.contains("protocol 1") && reason.contains("protocol 2")), "{down:?}");
    watched.supervisor.stop();
}

#[test]
fn rust_events_reach_the_host_only_while_it_runs() {
    let watched = start("ok", fast());
    assert!(watched.supervisor.emit("changed", json!(1)).is_err() || matches!(watched.supervisor.state(), HostState::Ready { .. }));
    wait_for(&watched.states, |state| matches!(state, HostState::Ready { .. }), Duration::from_secs(20));
    assert!(watched.supervisor.emit("changed", json!({ "n": 1 })).is_ok());
    watched.supervisor.stop();
    assert!(watched.supervisor.emit("changed", json!({ "n": 2 })).is_err());
}
