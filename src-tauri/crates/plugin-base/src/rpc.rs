use std::{
    collections::HashMap,
    fmt,
    io::{BufRead, BufReader, Read, Write},
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc, Arc, Mutex, MutexGuard,
    },
    thread,
    time::Duration,
};

use serde_json::{json, Value};

#[derive(Debug, Clone, PartialEq)]
pub enum RpcError {
    PeerGone(String),
    Timeout { method: String, after: Duration },
    Remote { code: Value, message: String, data: Option<Value> },
    Io(String),
}

impl fmt::Display for RpcError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::PeerGone(reason) => write!(formatter, "the plugin host is gone: {reason}"),
            Self::Timeout { method, after } => write!(formatter, "the plugin host did not answer {method} in {} ms", after.as_millis()),
            Self::Remote { message, .. } => write!(formatter, "the plugin host answered with an error: {message}"),
            Self::Io(error) => write!(formatter, "could not write to the plugin host: {error}"),
        }
    }
}

impl std::error::Error for RpcError {}

type Reply = mpsc::Sender<Result<Value, RpcError>>;

struct Shared {
    writer: Mutex<Option<Box<dyn Write + Send>>>,
    waiting: Mutex<HashMap<u64, Reply>>,
    gone: Mutex<Option<String>>,
    next: AtomicU64,
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[derive(Clone)]
pub struct Rpc {
    shared: Arc<Shared>,
}

impl Rpc {
    pub fn start(reader: impl Read + Send + 'static, writer: impl Write + Send + 'static, on_notification: impl Fn(&str, Value) + Send + 'static) -> Self {
        Self::start_watched(reader, writer, on_notification, |_| {})
    }

    pub fn start_watched(
        reader: impl Read + Send + 'static,
        writer: impl Write + Send + 'static,
        on_notification: impl Fn(&str, Value) + Send + 'static,
        on_gone: impl FnOnce(&str) + Send + 'static,
    ) -> Self {
        let shared = Arc::new(Shared {
            writer: Mutex::new(Some(Box::new(writer))),
            waiting: Mutex::new(HashMap::new()),
            gone: Mutex::new(None),
            next: AtomicU64::new(0),
        });
        let reading = shared.clone();
        let spawned = thread::Builder::new().name("plugin-host-rpc".into()).spawn(move || {
            let reason = read(reader, &reading, &on_notification);
            close(&reading, reason.clone());
            on_gone(&reason);
        });
        if let Err(error) = spawned {
            close(&shared, format!("could not start the reader: {error}"));
        }
        Self { shared }
    }

    pub fn call(&self, method: &str, params: Value, timeout: Duration) -> Result<Value, RpcError> {
        if let Some(reason) = lock(&self.shared.gone).clone() {
            return Err(RpcError::PeerGone(reason));
        }
        let id = self.shared.next.fetch_add(1, Ordering::SeqCst) + 1;
        let (reply, answer) = mpsc::channel();
        lock(&self.shared.waiting).insert(id, reply);
        if let Err(error) = self.send(&json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params })) {
            lock(&self.shared.waiting).remove(&id);
            return Err(error);
        }
        match answer.recv_timeout(timeout) {
            Ok(result) => result,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                lock(&self.shared.waiting).remove(&id);
                Err(RpcError::Timeout { method: method.into(), after: timeout })
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => Err(RpcError::PeerGone(lock(&self.shared.gone).clone().unwrap_or_default())),
        }
    }

    pub fn notify(&self, method: &str, params: Value) -> Result<(), RpcError> {
        self.send(&json!({ "jsonrpc": "2.0", "method": method, "params": params }))
    }

    pub fn close_input(&self) {
        lock(&self.shared.writer).take();
    }

    pub fn gone(&self) -> Option<String> {
        lock(&self.shared.gone).clone()
    }

    fn send(&self, message: &Value) -> Result<(), RpcError> {
        let mut writer = lock(&self.shared.writer);
        let Some(writer) = writer.as_mut() else {
            return Err(RpcError::PeerGone("the pipe to it is closed".into()));
        };
        writeln!(writer, "{message}").and_then(|()| writer.flush()).map_err(|error| RpcError::Io(error.to_string()))
    }
}

fn read(reader: impl Read, shared: &Shared, on_notification: &dyn Fn(&str, Value)) -> String {
    for line in BufReader::new(reader).lines() {
        let line = match line {
            Ok(line) => line,
            Err(error) => return format!("reading its output failed: {error}"),
        };
        let Ok(mut message) = serde_json::from_str::<Value>(&line) else { continue };
        if let Some(method) = message.get("method").and_then(Value::as_str).map(str::to_owned) {
            on_notification(&method, message.get_mut("params").map(Value::take).unwrap_or(Value::Null));
            continue;
        }
        let Some(id) = message.get("id").and_then(Value::as_u64) else { continue };
        let Some(reply) = lock(&shared.waiting).remove(&id) else { continue };
        let result = match message.get_mut("error").map(Value::take) {
            Some(mut error) => Err(RpcError::Remote {
                code: error.get_mut("code").map(Value::take).unwrap_or(Value::Null),
                message: error.get("message").and_then(Value::as_str).unwrap_or_default().to_owned(),
                data: error.get_mut("data").map(Value::take),
            }),
            None => Ok(message.get_mut("result").map(Value::take).unwrap_or(Value::Null)),
        };
        let _ = reply.send(result);
    }
    "its output ended".into()
}

fn close(shared: &Shared, reason: String) {
    lock(&shared.gone).get_or_insert(reason.clone());
    for (_, reply) in lock(&shared.waiting).drain() {
        let _ = reply.send(Err(RpcError::PeerGone(reason.clone())));
    }
}

#[cfg(test)]
mod tests {
    use std::{
        io::{BufRead, BufReader, Write},
        sync::mpsc,
        thread,
        time::{Duration, Instant},
    };

    use serde_json::{json, Value};

    use super::{Rpc, RpcError};

    fn pipe() -> (std::io::PipeReader, std::io::PipeWriter) {
        std::io::pipe().unwrap()
    }

    #[test]
    fn calls_get_their_answers_and_notifications_reach_the_callback() {
        let (host_reads, rust_writes) = pipe();
        let (rust_reads, mut host_writes) = pipe();
        let (seen, notes) = mpsc::channel();
        let rpc = Rpc::start(rust_reads, rust_writes, move |method, params| {
            let _ = seen.send((method.to_owned(), params));
        });
        let host = thread::spawn(move || {
            let mut lines = BufReader::new(host_reads).lines();
            writeln!(host_writes, "{}", json!({ "jsonrpc": "2.0", "method": "ready", "params": { "pid": 1 } })).unwrap();
            let request: Value = serde_json::from_str(&lines.next().unwrap().unwrap()).unwrap();
            writeln!(host_writes, "{}", json!({ "jsonrpc": "2.0", "id": request["id"], "result": { "echo": request["params"] } })).unwrap();
            let request: Value = serde_json::from_str(&lines.next().unwrap().unwrap()).unwrap();
            writeln!(host_writes, "{}", json!({ "jsonrpc": "2.0", "id": request["id"], "error": { "code": 7, "message": "nope" } })).unwrap();
        });
        assert_eq!(notes.recv_timeout(Duration::from_secs(5)).unwrap(), ("ready".into(), json!({ "pid": 1 })));
        assert_eq!(rpc.call("ping", json!(42), Duration::from_secs(5)).unwrap(), json!({ "echo": 42 }));
        assert!(matches!(rpc.call("fail", Value::Null, Duration::from_secs(5)), Err(RpcError::Remote { message, .. }) if message == "nope"));
        host.join().unwrap();
    }

    #[test]
    fn a_waiting_call_fails_at_once_when_the_host_goes_away() {
        let (_host_reads, rust_writes) = pipe();
        let (rust_reads, host_writes) = pipe();
        let rpc = Rpc::start(rust_reads, rust_writes, |_, _| {});
        let started = Instant::now();
        let closer = thread::spawn(move || {
            thread::sleep(Duration::from_millis(100));
            drop(host_writes);
        });
        let result = rpc.call("slow", Value::Null, Duration::from_secs(30));
        closer.join().unwrap();
        assert!(matches!(result, Err(RpcError::PeerGone(_))), "{result:?}");
        assert!(started.elapsed() < Duration::from_secs(2));
        assert!(rpc.gone().is_some());
        assert!(matches!(rpc.call("again", Value::Null, Duration::from_secs(1)), Err(RpcError::PeerGone(_))));
    }

    #[test]
    fn a_call_without_an_answer_times_out() {
        let (_host_reads, rust_writes) = pipe();
        let (rust_reads, _host_writes) = pipe();
        let rpc = Rpc::start(rust_reads, rust_writes, |_, _| {});
        let result = rpc.call("slow", Value::Null, Duration::from_millis(50));
        assert!(matches!(result, Err(RpcError::Timeout { .. })), "{result:?}");
    }
}
