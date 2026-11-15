use std::{
    path::PathBuf,
    sync::{mpsc, Arc, Mutex},
    time::{Duration, Instant},
};

use plugin_base::{find_node, supervisor::NoContainment, Event, HostSpec, HostState, NodeSearch, NodeVersion, Supervisor, Timing};
use serde_json::Value;

fn node() -> PathBuf {
    match find_node(&NodeSearch::from_env(), NodeVersion(18, 0, 0)) {
        Ok(found) => found.path,
        Err(tried) => panic!("these tests need Node on this machine: {tried:?}"),
    }
}

fn spec(mode: &str) -> HostSpec {
    let script = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/fake-host.mjs");
    HostSpec { program: node(), args: vec![script.into()], env: vec![("FAKE_HOST_MODE".into(), mode.into())], current_dir: None }
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
    let (tx, states) = mpsc::channel();
    let stderr = Arc::new(Mutex::new(Vec::new()));
    let lines = stderr.clone();
    let tx = Mutex::new(tx);
    let supervisor = Supervisor::start(spec(mode), Arc::new(NoContainment), timing, move |event| match event {
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
