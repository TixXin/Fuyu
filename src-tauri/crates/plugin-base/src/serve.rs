use std::{
    any::{Any, TypeId},
    cell::Cell,
    cmp::Reverse,
    collections::{BinaryHeap, HashMap},
    fmt,
    future::Future,
    panic::{catch_unwind, AssertUnwindSafe},
    sync::{
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
        mpsc, Arc, Mutex, MutexGuard,
    },
    pin::Pin,
    thread,
    time::{Duration, Instant},
};

use serde_json::{json, Value};

use crate::rpc::Rpc;

pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);
pub const DEFAULT_WORKERS: usize = 4;
pub const DEFAULT_QUEUE: usize = 256;

#[derive(Debug, Clone, PartialEq)]
pub struct ServeError {
    pub code: String,
    pub message: String,
    pub data: Option<Value>,
}

impl ServeError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self { code: code.into(), message: message.into(), data: None }
    }

    pub fn with_data(mut self, data: Value) -> Self {
        self.data = Some(data);
        self
    }

    pub fn bad_params(method: &str, why: impl fmt::Display) -> Self {
        Self::new("bad-params", format!("{method}: {why}"))
    }

    fn to_json(&self) -> Value {
        let mut error = json!({ "code": self.code, "message": self.message });
        if let Some(data) = &self.data {
            error["data"] = data.clone();
        }
        error
    }
}

impl fmt::Display for ServeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{} ({})", self.message, self.code)
    }
}

impl std::error::Error for ServeError {}

pub type Handler = dyn Fn(Value, &Call) -> Result<Value, ServeError> + Send + Sync;
pub type Answer = Result<Value, ServeError>;
pub type LocalFuture<'a> = Pin<Box<dyn Future<Output = Answer> + 'a>>;
type Runtime = dyn for<'a> Fn(LocalFuture<'a>) -> Answer + Send + Sync;

struct Method {
    handler: Arc<Handler>,
    timeout: Duration,
    origin: String,
}

pub struct Serve {
    methods: HashMap<String, Method>,
    states: HashMap<TypeId, Box<dyn Any + Send + Sync>>,
    runtime: Box<Runtime>,
    workers: usize,
    queue: usize,
}

impl Default for Serve {
    fn default() -> Self {
        Self { methods: HashMap::new(), states: HashMap::new(), runtime: Box::new(|future| pollster::block_on(future)), workers: DEFAULT_WORKERS, queue: DEFAULT_QUEUE }
    }
}

impl Serve {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, name: &str, timeout: Duration, handler: impl Fn(Value, &Call) -> Result<Value, ServeError> + Send + Sync + 'static) -> Result<&mut Self, String> {
        self.add_from(name, timeout, "Serve::add", handler)
    }

    pub(crate) fn add_from(&mut self, name: &str, timeout: Duration, origin: &str, handler: impl Fn(Value, &Call) -> Result<Value, ServeError> + Send + Sync + 'static) -> Result<&mut Self, String> {
        if let Some(earlier) = self.methods.get(name) {
            return Err(format!("the Rust method {name} is registered twice: {} and {origin}", earlier.origin));
        }
        self.methods.insert(name.to_owned(), Method { handler: Arc::new(handler), timeout, origin: origin.to_owned() });
        Ok(self)
    }

    pub fn manage<T: Clone + Send + Sync + 'static>(&mut self, state: T) -> &mut Self {
        self.states.insert(TypeId::of::<T>(), Box::new(state));
        self
    }

    pub fn block_on_with(&mut self, runtime: impl for<'a> Fn(LocalFuture<'a>) -> Answer + Send + Sync + 'static) -> &mut Self {
        self.runtime = Box::new(runtime);
        self
    }

    pub fn workers(mut self, workers: usize) -> Self {
        self.workers = workers.max(1);
        self
    }

    pub fn queue(mut self, queue: usize) -> Self {
        self.queue = queue;
        self
    }

    pub fn names(&self) -> Vec<&str> {
        let mut names: Vec<&str> = self.methods.keys().map(String::as_str).collect();
        names.sort_unstable();
        names
    }
}

thread_local! {
    static SERVING: Cell<bool> = const { Cell::new(false) };
}

pub fn in_handler() -> bool {
    SERVING.with(Cell::get)
}

struct Slot {
    done: AtomicBool,
}

impl Slot {
    fn claim(&self) -> bool {
        !self.done.swap(true, Ordering::SeqCst)
    }
}

pub struct Call {
    id: Value,
    method: String,
    slot: Arc<Slot>,
    rpc: Rpc,
    serve: Arc<Serve>,
}

impl Call {
    pub fn method(&self) -> &str {
        &self.method
    }

    pub fn cancelled(&self) -> bool {
        self.slot.done.load(Ordering::SeqCst)
    }

    pub fn progress(&self, data: Value) -> bool {
        !self.cancelled() && self.rpc.notify("progress", json!({ "id": self.id, "data": data })).is_ok()
    }

    pub fn state<T: Clone + Send + Sync + 'static>(&self) -> Result<T, ServeError> {
        self.serve.states.get(&TypeId::of::<T>()).and_then(|state| state.downcast_ref::<T>()).cloned().ok_or_else(|| {
            ServeError::new("failed", format!("Rust has no {} to give to {}; call Serve::manage with it first", std::any::type_name::<T>(), self.method))
        })
    }

    pub fn block_on<'a>(&self, future: LocalFuture<'a>) -> Answer {
        (self.serve.runtime)(future)
    }
}

struct Job {
    call: Call,
    handler: Arc<Handler>,
    params: Value,
}

struct Deadline {
    at: Instant,
    seq: u64,
    id: Value,
    method: String,
    timeout: Duration,
    slot: Arc<Slot>,
}

impl PartialEq for Deadline {
    fn eq(&self, other: &Self) -> bool {
        (self.at, self.seq) == (other.at, other.seq)
    }
}

impl Eq for Deadline {}

impl PartialOrd for Deadline {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Deadline {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        (self.at, self.seq).cmp(&(other.at, other.seq))
    }
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn key(id: &Value) -> String {
    id.to_string()
}

pub(crate) struct Session {
    serve: Arc<Serve>,
    rpc: Rpc,
    jobs: Mutex<Option<mpsc::Sender<Job>>>,
    deadlines: Mutex<Option<mpsc::Sender<Deadline>>>,
    live: Arc<Mutex<HashMap<String, Arc<Slot>>>>,
    busy: Arc<AtomicUsize>,
    seq: AtomicU64,
}

pub(crate) fn answer(rpc: &Rpc, id: &Value, result: Result<Value, ServeError>) {
    let message = match result {
        Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
        Err(error) => json!({ "jsonrpc": "2.0", "id": id, "error": error.to_json() }),
    };
    let _ = rpc.send_raw(&message);
}

fn panic_text(payload: &(dyn Any + Send)) -> String {
    payload.downcast_ref::<&str>().map(|text| (*text).to_owned()).or_else(|| payload.downcast_ref::<String>().cloned()).unwrap_or_else(|| "no message".into())
}

fn run(job: Job, live: &Mutex<HashMap<String, Arc<Slot>>>, busy: &AtomicUsize) {
    let Job { call, handler, params } = job;
    if !call.cancelled() {
        SERVING.with(|serving| serving.set(true));
        let outcome = catch_unwind(AssertUnwindSafe(|| handler(params, &call)));
        SERVING.with(|serving| serving.set(false));
        let result = outcome.unwrap_or_else(|payload| Err(ServeError::new("panic", format!("the Rust handler for {} panicked: {}", call.method, panic_text(payload.as_ref())))));
        if call.slot.claim() {
            answer(&call.rpc, &call.id, result);
        }
    }
    lock(live).remove(&key(&call.id));
    busy.fetch_sub(1, Ordering::SeqCst);
}

fn work(jobs: Arc<Mutex<mpsc::Receiver<Job>>>, live: Arc<Mutex<HashMap<String, Arc<Slot>>>>, busy: Arc<AtomicUsize>) {
    loop {
        let job = lock(&jobs).recv();
        match job {
            Ok(job) => run(job, &live, &busy),
            Err(_) => return,
        }
    }
}

fn watch_deadlines(deadlines: mpsc::Receiver<Deadline>, rpc: Rpc) {
    let mut heap: BinaryHeap<Reverse<Deadline>> = BinaryHeap::new();
    loop {
        let next = heap.peek().map(|Reverse(deadline)| deadline.at.saturating_duration_since(Instant::now()));
        let received = match next {
            Some(wait) => deadlines.recv_timeout(wait),
            None => deadlines.recv().map_err(|_| mpsc::RecvTimeoutError::Disconnected),
        };
        match received {
            Ok(deadline) => heap.push(Reverse(deadline)),
            Err(mpsc::RecvTimeoutError::Disconnected) => return,
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }
        while heap.peek().is_some_and(|Reverse(deadline)| deadline.at <= Instant::now()) {
            let Some(Reverse(deadline)) = heap.pop() else { break };
            if deadline.slot.claim() {
                let message = format!("the Rust handler for {} did not finish in {} ms", deadline.method, deadline.timeout.as_millis());
                answer(&rpc, &deadline.id, Err(ServeError::new("timeout", message).with_data(json!({ "method": deadline.method, "timeoutMs": deadline.timeout.as_millis() as u64 }))));
            }
        }
    }
}

impl Session {
    pub(crate) fn start(serve: Arc<Serve>, rpc: Rpc) -> Self {
        let (jobs_tx, jobs_rx) = mpsc::channel::<Job>();
        let (deadlines_tx, deadlines_rx) = mpsc::channel::<Deadline>();
        let live = Arc::new(Mutex::new(HashMap::new()));
        let busy = Arc::new(AtomicUsize::new(0));
        let jobs_rx = Arc::new(Mutex::new(jobs_rx));
        let mut started = 0;
        for index in 0..serve.workers {
            let (jobs, live, busy) = (jobs_rx.clone(), live.clone(), busy.clone());
            if thread::Builder::new().name(format!("plugin-host-serve-{index}")).spawn(move || work(jobs, live, busy)).is_ok() {
                started += 1;
            }
        }
        let timer = rpc.clone();
        let timed = thread::Builder::new().name("plugin-host-serve-deadlines".into()).spawn(move || watch_deadlines(deadlines_rx, timer)).is_ok();
        let usable = started > 0 && timed;
        Self {
            serve,
            rpc,
            jobs: Mutex::new(usable.then_some(jobs_tx)),
            deadlines: Mutex::new(usable.then_some(deadlines_tx)),
            live,
            busy,
            seq: AtomicU64::new(0),
        }
    }

    pub(crate) fn request(&self, id: Value, method: &str, params: Value) {
        let Some(found) = self.serve.methods.get(method) else {
            return answer(&self.rpc, &id, Err(ServeError::new("no-method", format!("Rust has no method {method}")).with_data(json!({ "method": method }))));
        };
        let limit = self.serve.workers + self.serve.queue;
        if self.busy.fetch_add(1, Ordering::SeqCst) >= limit {
            self.busy.fetch_sub(1, Ordering::SeqCst);
            return answer(&self.rpc, &id, Err(ServeError::new("busy", format!("Rust is already handling {limit} calls; {method} was turned away"))));
        }
        let slot = Arc::new(Slot { done: AtomicBool::new(false) });
        lock(&self.live).insert(key(&id), slot.clone());
        let deadline = Deadline { at: Instant::now() + found.timeout, seq: self.seq.fetch_add(1, Ordering::SeqCst), id: id.clone(), method: method.to_owned(), timeout: found.timeout, slot: slot.clone() };
        let call = Call { id: id.clone(), method: method.to_owned(), slot: slot.clone(), rpc: self.rpc.clone(), serve: self.serve.clone() };
        let job = Job { call, handler: found.handler.clone(), params };
        let queued = lock(&self.deadlines).as_ref().is_some_and(|deadlines| deadlines.send(deadline).is_ok()) && lock(&self.jobs).as_ref().is_some_and(|jobs| jobs.send(job).is_ok());
        if !queued {
            lock(&self.live).remove(&key(&id));
            self.busy.fetch_sub(1, Ordering::SeqCst);
            if slot.claim() {
                answer(&self.rpc, &id, Err(ServeError::new("failed", format!("Rust could not start {method}"))));
            }
        }
    }

    pub(crate) fn cancel(&self, id: &Value) {
        if let Some(slot) = lock(&self.live).get(&key(id)) {
            slot.claim();
        }
    }

    pub(crate) fn close(&self) {
        lock(&self.jobs).take();
        lock(&self.deadlines).take();
        for slot in lock(&self.live).values() {
            slot.claim();
        }
    }
}

#[cfg(test)]
mod tests;
