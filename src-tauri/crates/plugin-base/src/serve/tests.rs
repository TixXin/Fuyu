use std::{
    collections::HashSet,
    io::{BufRead, BufReader, Write},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

use serde_json::{json, Value};

use super::{Serve, ServeError};
use crate::rpc::{Rpc, RpcError};

const PATIENT: Duration = Duration::from_secs(30);

struct Host {
    to_rust: Option<std::io::PipeWriter>,
    from_rust: mpsc::Receiver<Value>,
    rpc: Rpc,
}

impl Host {
    fn start(serve: Serve) -> Self {
        let (host_reads, rust_writes) = std::io::pipe().unwrap();
        let (rust_reads, host_writes) = std::io::pipe().unwrap();
        let rpc = Rpc::start_serving(rust_reads, rust_writes, Some(Arc::new(serve)), |_, _| {}, |_| {});
        let (tx, from_rust) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(host_reads).lines().map_while(Result::ok) {
                if tx.send(serde_json::from_str(&line).unwrap()).is_err() {
                    return;
                }
            }
        });
        Self { to_rust: Some(host_writes), from_rust, rpc }
    }

    fn send(&mut self, message: Value) {
        let writer = self.to_rust.as_mut().unwrap();
        writeln!(writer, "{message}").unwrap();
    }

    fn call(&mut self, id: u64, method: &str, params: Value) {
        self.send(json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params }));
    }

    fn next(&self) -> Value {
        self.from_rust.recv_timeout(PATIENT).expect("Rust answered")
    }

    fn quiet_for(&self, wait: Duration) -> Option<Value> {
        self.from_rust.recv_timeout(wait).ok()
    }
}

fn echo(params: Value, _call: &super::Call) -> Result<Value, ServeError> {
    Ok(json!({ "echo": params }))
}

fn table() -> Serve {
    let mut serve = Serve::new();
    serve.add("app.echo", PATIENT, echo).unwrap();
    serve
        .add("test.sleepy", PATIENT, |params, _| {
            thread::sleep(Duration::from_millis(params["ms"].as_u64().unwrap_or(10)));
            Ok(params)
        })
        .unwrap();
    serve.add("test.panic", PATIENT, |_, _| panic!("boom")).unwrap();
    serve.add("test.fail", PATIENT, |_, _| Err(ServeError::new("no-secret", "no key").with_data(json!({ "engine": "x" })))).unwrap();
    serve
        .add("test.slow", Duration::from_millis(50), |_, call| {
            let started = Instant::now();
            while !call.cancelled() && started.elapsed() < Duration::from_secs(5) {
                thread::sleep(Duration::from_millis(5));
            }
            Ok(json!("late"))
        })
        .unwrap();
    serve
        .add("test.stream", PATIENT, |params, call| {
            for piece in 0..params["pieces"].as_u64().unwrap_or(0) {
                call.progress(json!({ "piece": piece }));
            }
            Ok(json!("done"))
        })
        .unwrap();
    serve
}

struct Watch {
    started: mpsc::Receiver<()>,
    finished: mpsc::Receiver<bool>,
}

impl Watch {
    fn started(&self) {
        self.started.recv_timeout(PATIENT).expect("the handler started");
    }

    fn saw_cancel(&self) -> bool {
        self.finished.recv_timeout(PATIENT).expect("the handler finished")
    }
}

fn until_cancelled(serve: &mut Serve) -> Watch {
    let (started, started_rx) = mpsc::channel();
    let (finished, finished_rx) = mpsc::channel();
    let (started, finished) = (Mutex::new(started), Mutex::new(finished));
    serve
        .add("test.until-cancelled", PATIENT, move |_, call| {
            let _ = started.lock().unwrap().send(());
            let since = Instant::now();
            while !call.cancelled() && since.elapsed() < Duration::from_secs(20) {
                thread::sleep(Duration::from_millis(5));
            }
            let _ = finished.lock().unwrap().send(call.cancelled());
            Ok(json!("late"))
        })
        .unwrap();
    Watch { started: started_rx, finished: finished_rx }
}

#[test]
fn a_hundred_calls_at_once_all_get_their_own_answer() {
    let mut host = Host::start(table());
    for id in 1..=100u64 {
        host.call(id, "test.sleepy", json!({ "ms": 5, "n": id }));
    }
    let mut seen = HashSet::new();
    for _ in 0..100 {
        let answer = host.next();
        assert_eq!(answer["result"]["n"], answer["id"], "{answer}");
        seen.insert(answer["id"].as_u64().unwrap());
    }
    assert_eq!(seen.len(), 100);
}

#[test]
fn a_panicking_handler_fails_only_its_own_call() {
    let mut host = Host::start(table());
    host.call(1, "test.panic", Value::Null);
    let answer = host.next();
    assert_eq!(answer["id"], 1);
    assert_eq!(answer["error"]["code"], "panic");
    assert!(answer["error"]["message"].as_str().unwrap().contains("test.panic"), "{answer}");
    assert!(answer["error"]["message"].as_str().unwrap().contains("boom"), "{answer}");
    for id in 2..=10 {
        host.call(id, "app.echo", json!(id));
        assert_eq!(host.next()["result"]["echo"], id);
    }
}

#[test]
fn a_slow_handler_times_out_naming_the_method_and_its_late_result_is_dropped() {
    let mut host = Host::start(table());
    host.call(7, "test.slow", Value::Null);
    let answer = host.next();
    assert_eq!(answer["id"], 7);
    assert_eq!(answer["error"]["code"], "timeout");
    assert_eq!(answer["error"]["message"], "the Rust handler for test.slow did not finish in 50 ms");
    assert_eq!(answer["error"]["data"], json!({ "method": "test.slow", "timeoutMs": 50 }));
    assert_eq!(host.quiet_for(Duration::from_millis(200)), None);
}

#[test]
fn unknown_methods_and_handler_errors_come_back_as_code_message_and_data() {
    let mut host = Host::start(table());
    host.call(1, "nope", Value::Null);
    let answer = host.next();
    assert_eq!(answer["error"]["code"], "no-method");
    assert_eq!(answer["error"]["message"], "Rust has no method nope");
    host.call(2, "test.fail", Value::Null);
    assert_eq!(host.next()["error"], json!({ "code": "no-secret", "message": "no key", "data": { "engine": "x" } }));
    host.send(json!({ "jsonrpc": "2.0", "id": "text-id", "method": "app.echo", "params": 1 }));
    assert_eq!(host.next(), json!({ "jsonrpc": "2.0", "id": "text-id", "result": { "echo": 1 } }));
}

#[test]
fn progress_goes_out_with_the_call_id_before_the_answer() {
    let mut host = Host::start(table());
    host.call(3, "test.stream", json!({ "pieces": 3 }));
    for piece in 0..3 {
        assert_eq!(host.next(), json!({ "jsonrpc": "2.0", "method": "progress", "params": { "id": 3, "data": { "piece": piece } } }));
    }
    assert_eq!(host.next()["result"], "done");
}

#[test]
fn calls_beyond_the_workers_and_the_queue_are_turned_away() {
    let (open, gate) = mpsc::channel::<()>();
    let gate = Mutex::new(gate);
    let mut serve = table().workers(1).queue(1);
    serve
        .add("test.gated", PATIENT, move |_, _| {
            let _ = gate.lock().unwrap().recv_timeout(PATIENT);
            Ok(Value::Null)
        })
        .unwrap();
    let mut host = Host::start(serve);
    for id in 1..=3 {
        host.call(id, "test.gated", Value::Null);
    }
    let answer = host.next();
    assert_eq!((answer["id"].clone(), answer["error"]["code"].clone()), (json!(3), json!("busy")), "{answer}");
    open.send(()).unwrap();
    assert_eq!(host.next()["id"], 1);
    open.send(()).unwrap();
    assert_eq!(host.next()["id"], 2);
}

#[test]
fn the_host_can_cancel_a_call_and_gets_no_answer_for_it() {
    let mut serve = table().workers(1);
    let watch = until_cancelled(&mut serve);
    let mut host = Host::start(serve);
    host.call(9, "test.until-cancelled", Value::Null);
    watch.started();
    host.send(json!({ "jsonrpc": "2.0", "method": "cancel", "params": { "id": 9 } }));
    assert!(watch.saw_cancel(), "the handler saw the cancel");
    host.call(10, "app.echo", json!("after"));
    assert_eq!(host.next()["id"], 10);
    assert_eq!(host.quiet_for(Duration::from_millis(150)), None);
}

#[test]
fn a_handler_cannot_wait_for_the_host_it_is_answering() {
    let seen = Arc::new(Mutex::new(None));
    let saw = seen.clone();
    let mut serve = Serve::new();
    serve
        .add("test.cycle", PATIENT, move |_, call| {
            *saw.lock().unwrap() = Some(call.rpc.call("ping", Value::Null, Duration::from_secs(5)));
            Ok(Value::Null)
        })
        .unwrap();
    let mut host = Host::start(serve);
    host.call(1, "test.cycle", Value::Null);
    assert_eq!(host.next()["result"], Value::Null);
    assert_eq!(seen.lock().unwrap().clone(), Some(Err(RpcError::WouldWait { method: "ping".into() })));
}

#[test]
fn when_the_host_goes_away_running_handlers_are_cancelled_and_nothing_hangs() {
    let mut serve = table();
    let watch = until_cancelled(&mut serve);
    let mut host = Host::start(serve);
    host.call(1, "test.until-cancelled", Value::Null);
    host.call(2, "test.until-cancelled", Value::Null);
    watch.started();
    watch.started();
    let started = Instant::now();
    host.to_rust.take();
    while host.rpc.gone().is_none() {
        assert!(started.elapsed() < PATIENT, "the reader noticed");
        thread::sleep(Duration::from_millis(5));
    }
    assert_eq!([watch.saw_cancel(), watch.saw_cancel()], [true, true], "both handlers saw the host go");
    assert!(matches!(host.rpc.notify("event", Value::Null), Err(RpcError::PeerGone(_))));
    assert_eq!(host.quiet_for(Duration::from_millis(300)), None);
}

#[test]
fn registering_a_method_twice_is_an_error_naming_it() {
    let mut serve = Serve::new();
    serve.add("app.echo", Duration::from_secs(1), echo).unwrap();
    assert_eq!(serve.add("app.echo", Duration::from_secs(1), echo).err(), Some("the Rust method app.echo is registered twice: Serve::add and Serve::add".into()));
    assert_eq!(serve.names(), ["app.echo"]);
}
