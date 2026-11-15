use std::{
    io::{BufRead, BufReader, Write},
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc, Arc,
    },
    thread,
    time::Duration,
};

use plugin_base::{host_service, Call, Rpc, Serve, ServeError, ServiceFailure};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Serialize, Deserialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
struct Greeting {
    text: String,
    shouted_back: bool,
}

#[host_service("test.greet")]
fn greet(name: String, loud: Option<bool>) -> Greeting {
    let loud = loud.unwrap_or(false);
    Greeting { text: if loud { format!("HELLO {}", name.to_uppercase()) } else { format!("hello {name}") }, shouted_back: loud }
}

#[host_service("test.add", timeout_ms = 1500)]
fn add(left: i64, right_side: i64) -> Result<i64, String> {
    left.checked_add(right_side).ok_or_else(|| "the sum does not fit".to_owned())
}

#[derive(Clone)]
struct Counter(Arc<AtomicU64>);

#[host_service("test.count", inject(counter))]
fn count(counter: Counter, by: u64) -> u64 {
    counter.0.fetch_add(by, Ordering::SeqCst) + by
}

#[host_service("test.later")]
async fn later(text: String) -> Result<String, ServeError> {
    let echoed = async { text.repeat(2) }.await;
    Ok(echoed)
}

struct Refused {
    why: String,
}

impl ServiceFailure for Refused {
    fn into_serve_error(self) -> ServeError {
        ServeError::new("refused", format!("refused: {}", self.why)).with_data(json!({ "why": self.why }))
    }
}

#[host_service("test.refuse")]
fn refuse(reason: String) -> Result<(), Refused> {
    Err(Refused { why: reason })
}

#[host_service("test.stream")]
fn stream(call: &Call, pieces: Vec<String>) -> usize {
    for piece in &pieces {
        call.progress(json!({ "piece": piece }));
    }
    pieces.len()
}

#[host_service("test.nothing")]
fn nothing() {}

struct Host {
    to_rust: std::io::PipeWriter,
    from_rust: mpsc::Receiver<Value>,
    next_id: u64,
}

impl Host {
    fn start(serve: Serve) -> Self {
        let (host_reads, rust_writes) = std::io::pipe().unwrap();
        let (rust_reads, to_rust) = std::io::pipe().unwrap();
        let _rpc = Rpc::start_serving(rust_reads, rust_writes, Some(Arc::new(serve)), |_, _| {}, |_| {});
        let (tx, from_rust) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(host_reads).lines().map_while(Result::ok) {
                let _ = tx.send(serde_json::from_str(&line).unwrap());
            }
        });
        Self { to_rust, from_rust, next_id: 0 }
    }

    fn ask(&mut self, method: &str, params: Value) -> (Vec<Value>, Value) {
        self.next_id += 1;
        writeln!(self.to_rust, "{}", json!({ "jsonrpc": "2.0", "id": self.next_id, "method": method, "params": params })).unwrap();
        let mut progress = Vec::new();
        loop {
            let message = self.from_rust.recv_timeout(Duration::from_secs(10)).unwrap();
            if message["method"] == "progress" {
                progress.push(message["params"]["data"].clone());
                continue;
            }
            assert_eq!(message["id"], self.next_id);
            return (progress, message);
        }
    }

    fn result(&mut self, method: &str, params: Value) -> Value {
        let (_, answer) = self.ask(method, params);
        assert!(answer.get("error").is_none(), "{method}: {answer}");
        answer["result"].clone()
    }

    fn error(&mut self, method: &str, params: Value) -> Value {
        self.ask(method, params).1["error"].clone()
    }
}

fn registered() -> Serve {
    let mut serve = Serve::registered().unwrap();
    serve.manage(Counter(Arc::new(AtomicU64::new(10))));
    serve
}

#[test]
fn a_sync_function_gets_its_parameters_by_camel_case_name_and_its_result_as_json() {
    let mut host = Host::start(registered());
    assert_eq!(host.result("test.greet", json!({ "name": "ada" })), json!({ "text": "hello ada", "shoutedBack": false }));
    assert_eq!(host.result("test.greet", json!({ "name": "ada", "loud": true, "extra": 1 })), json!({ "text": "HELLO ADA", "shoutedBack": true }));
    assert_eq!(host.result("test.add", json!({ "left": 2, "rightSide": 3 })), json!(5));
    assert_eq!(host.result("test.nothing", Value::Null), Value::Null);
}

#[test]
fn bad_parameters_name_the_method_and_the_field() {
    let mut host = Host::start(registered());
    let error = host.error("test.add", json!({ "left": 2, "rightSide": "three" }));
    assert_eq!(error["code"], "bad-params");
    assert!(error["message"].as_str().unwrap().starts_with("test.add: rightSide: invalid type"), "{error}");
    assert_eq!(error["data"], json!({ "method": "test.add", "field": "rightSide" }));
    assert_eq!(host.error("test.greet", json!({}))["data"]["field"], "name");
    assert_eq!(host.error("test.greet", json!(["ada"]))["code"], "bad-params");
}

#[test]
fn errors_keep_their_own_code_and_strings_become_failed() {
    let mut host = Host::start(registered());
    assert_eq!(host.error("test.add", json!({ "left": i64::MAX, "rightSide": 1 })), json!({ "code": "failed", "message": "the sum does not fit" }));
    assert_eq!(host.error("test.refuse", json!({ "reason": "no key" })), json!({ "code": "refused", "message": "refused: no key", "data": { "why": "no key" } }));
}

#[test]
fn injected_state_comes_from_serve_manage_and_its_absence_is_named() {
    let mut host = Host::start(registered());
    assert_eq!(host.result("test.count", json!({ "by": 5 })), json!(15));
    assert_eq!(host.result("test.count", json!({ "by": 1 })), json!(16));
    let mut bare = Host::start(Serve::registered().unwrap());
    let error = bare.error("test.count", json!({ "by": 1 }));
    assert_eq!(error["code"], "failed");
    assert!(error["message"].as_str().unwrap().contains("Counter"), "{error}");
}

#[test]
fn an_async_function_runs_on_the_runtime_the_app_gives() {
    let mut host = Host::start(registered());
    assert_eq!(host.result("test.later", json!({ "text": "ab" })), json!("abab"));
    let used = Arc::new(AtomicU64::new(0));
    let counted = used.clone();
    let mut serve = registered();
    serve.block_on_with(move |future| {
        counted.fetch_add(1, Ordering::SeqCst);
        pollster::block_on(future)
    });
    let mut host = Host::start(serve);
    assert_eq!(host.result("test.later", json!({ "text": "c" })), json!("cc"));
    assert_eq!(used.load(Ordering::SeqCst), 1);
}

#[test]
fn a_function_taking_the_call_streams_progress() {
    let mut host = Host::start(registered());
    let (progress, answer) = host.ask("test.stream", json!({ "pieces": ["a", "b"] }));
    assert_eq!(progress, [json!({ "piece": "a" }), json!({ "piece": "b" })]);
    assert_eq!(answer["result"], 2);
}

#[test]
fn every_marked_function_is_registered_once_with_where_it_lives() {
    let names: Vec<&str> = plugin_base::registrations().iter().map(|registration| registration.name).collect();
    assert_eq!(names, ["test.add", "test.count", "test.greet", "test.later", "test.nothing", "test.refuse", "test.stream"]);
    let add = plugin_base::registrations().into_iter().find(|registration| registration.name == "test.add").unwrap();
    assert_eq!(add.timeout_ms, Some(1500));
    assert_eq!(add.function, "macros::add");
    assert!(add.file.ends_with("macros.rs"));
}

#[test]
fn typescript_types_come_from_the_parameters_and_the_result() {
    let methods = plugin_base::ts::described();
    let text = plugin_base::ts::declarations(&methods);
    assert!(text.contains("export type Greeting = { text: string, shoutedBack: boolean, };"), "{text}");
    assert!(text.contains("  \"test.greet\": { params: { name: string; loud?: boolean | null }; result: Greeting };"), "{text}");
    assert!(text.contains("  \"test.add\": { params: { left: number; rightSide: number }; result: number };"), "{text}");
    assert!(text.contains("  \"test.count\": { params: { by: number }; result: number };"), "{text}");
    assert!(text.contains("  \"test.stream\": { params: { pieces: Array<string> }; result: number };"), "{text}");
    assert!(text.contains("  \"test.nothing\": { params: Record<string, never> | null; result: null };"), "{text}");
    assert!(plugin_base::ts::method_list(&methods).contains("  \"test.greet\",\n"));
}
