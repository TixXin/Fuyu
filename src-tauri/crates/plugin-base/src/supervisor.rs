use std::{
    ffi::OsString,
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{mpsc, Arc, Condvar, Mutex, MutexGuard},
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use serde_json::{json, Value};

use crate::{
    rpc::{Rpc, RpcError, PROTOCOL},
    serve::Serve,
};

#[derive(Debug, Clone, Default)]
pub struct HostSpec {
    pub program: PathBuf,
    pub args: Vec<OsString>,
    pub env: Vec<(OsString, OsString)>,
    pub current_dir: Option<PathBuf>,
}

#[derive(Debug, Clone, Copy)]
pub struct Timing {
    pub ready_within: Duration,
    pub ping_every: Duration,
    pub ping_timeout: Duration,
    pub first_backoff: Duration,
    pub max_backoff: Duration,
    pub healthy_after: Duration,
    pub stop_grace: Duration,
}

impl Default for Timing {
    fn default() -> Self {
        Self {
            ready_within: Duration::from_secs(60),
            ping_every: Duration::from_secs(1),
            ping_timeout: Duration::from_secs(2),
            first_backoff: Duration::from_millis(250),
            max_backoff: Duration::from_secs(30),
            healthy_after: Duration::from_secs(60),
            stop_grace: Duration::from_secs(2),
        }
    }
}

impl Timing {
    pub fn backoff(&self, failures: u32) -> Duration {
        if failures == 0 {
            return Duration::ZERO;
        }
        let factor = 1u32.checked_shl(failures - 1).unwrap_or(u32::MAX);
        self.first_backoff.saturating_mul(factor).min(self.max_backoff)
    }
}

pub trait Containment: Send + Sync {
    fn prepare(&self, command: &mut Command);
    fn adopt(&self, child: &Child) -> Result<Box<dyn Send>, String>;
}

pub struct NoContainment;

impl Containment for NoContainment {
    fn prepare(&self, _command: &mut Command) {}
    fn adopt(&self, _child: &Child) -> Result<Box<dyn Send>, String> {
        Ok(Box::new(()))
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum HostState {
    Starting { generation: u32 },
    Ready { generation: u32, pid: u32, ready: Value },
    Down { generation: u32, reason: String, retry_in: Duration },
    Stopped,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Event {
    State(HostState),
    Notification { method: String, params: Value },
    Stderr(String),
}

type OnEvent = Arc<dyn Fn(Event) + Send + Sync>;

struct Control {
    stop: bool,
    restart: bool,
    poke: bool,
}

struct Inner {
    state: Mutex<HostState>,
    rpc: Mutex<Option<Rpc>>,
    control: Mutex<Control>,
    wake: Condvar,
    on_event: OnEvent,
    serve: Option<Arc<Serve>>,
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

impl Inner {
    fn set(&self, state: HostState) {
        *lock(&self.state) = state.clone();
        (self.on_event)(Event::State(state));
    }

    fn pause(&self, duration: Duration) -> bool {
        let deadline = Instant::now() + duration;
        let mut control = lock(&self.control);
        loop {
            if control.stop || control.restart {
                return control.stop;
            }
            if std::mem::take(&mut control.poke) {
                return false;
            }
            let left = deadline.saturating_duration_since(Instant::now());
            if left.is_zero() {
                return false;
            }
            control = self.wake.wait_timeout(control, left).map(|(guard, _)| guard).unwrap_or_else(|poisoned| poisoned.into_inner().0);
        }
    }

    fn poke(&self) {
        lock(&self.control).poke = true;
        self.wake.notify_all();
    }

    fn stopping(&self) -> bool {
        lock(&self.control).stop
    }

    fn take_restart(&self) -> bool {
        std::mem::take(&mut lock(&self.control).restart)
    }
}

pub struct Supervisor {
    inner: Arc<Inner>,
    worker: Mutex<Option<JoinHandle<()>>>,
}

impl Supervisor {
    pub fn start(spec: HostSpec, containment: Arc<dyn Containment>, timing: Timing, on_event: impl Fn(Event) + Send + Sync + 'static) -> Result<Self, String> {
        Self::start_with(move |_| spec.clone(), containment, timing, on_event)
    }

    pub fn start_with(
        spec_for: impl FnMut(u32) -> HostSpec + Send + 'static,
        containment: Arc<dyn Containment>,
        timing: Timing,
        on_event: impl Fn(Event) + Send + Sync + 'static,
    ) -> Result<Self, String> {
        Self::start_serving(spec_for, containment, timing, None, on_event)
    }

    pub fn start_serving(
        spec_for: impl FnMut(u32) -> HostSpec + Send + 'static,
        containment: Arc<dyn Containment>,
        timing: Timing,
        serve: Option<Arc<Serve>>,
        on_event: impl Fn(Event) + Send + Sync + 'static,
    ) -> Result<Self, String> {
        let inner = Arc::new(Inner {
            state: Mutex::new(HostState::Starting { generation: 1 }),
            rpc: Mutex::new(None),
            control: Mutex::new(Control { stop: false, restart: false, poke: false }),
            wake: Condvar::new(),
            on_event: Arc::new(on_event),
            serve,
        });
        let running = inner.clone();
        let worker = thread::Builder::new()
            .name("plugin-host-supervisor".into())
            .spawn(move || supervise(&running, spec_for, containment.as_ref(), timing))
            .map_err(|error| format!("could not start the plugin host supervisor: {error}"))?;
        Ok(Self { inner, worker: Mutex::new(Some(worker)) })
    }

    pub fn state(&self) -> HostState {
        lock(&self.inner.state).clone()
    }

    pub fn call(&self, method: &str, params: Value, timeout: Duration) -> Result<Value, RpcError> {
        let rpc = lock(&self.inner.rpc).clone();
        match rpc {
            Some(rpc) => rpc.call(method, params, timeout),
            None => Err(RpcError::PeerGone("the plugin host is not running".into())),
        }
    }

    pub fn emit(&self, name: &str, data: Value) -> Result<(), RpcError> {
        let rpc = lock(&self.inner.rpc).clone();
        match rpc {
            Some(rpc) => rpc.emit(name, data),
            None => Err(RpcError::PeerGone("the plugin host is not running".into())),
        }
    }

    pub fn restart(&self) {
        lock(&self.inner.control).restart = true;
        self.inner.wake.notify_all();
    }

    pub fn stop(&self) {
        lock(&self.inner.control).stop = true;
        self.inner.wake.notify_all();
        if let Some(worker) = lock(&self.worker).take() {
            let _ = worker.join();
        }
    }
}

impl Drop for Supervisor {
    fn drop(&mut self) {
        self.stop();
    }
}

struct Running {
    child: Child,
    rpc: Rpc,
    ready: mpsc::Receiver<Value>,
    _guard: Box<dyn Send>,
}

fn launch(inner: &Arc<Inner>, spec: &HostSpec, containment: &dyn Containment) -> Result<Running, String> {
    let mut command = Command::new(&spec.program);
    command.args(&spec.args).envs(spec.env.iter().map(|(key, value)| (key, value))).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(dir) = &spec.current_dir {
        command.current_dir(dir);
    }
    crate::node::hide_window(&mut command);
    containment.prepare(&mut command);
    let mut child = command.spawn().map_err(|error| format!("could not start {}: {error}", spec.program.display()))?;
    let guard = match containment.adopt(&child) {
        Ok(guard) => guard,
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
    };
    let (Some(stdin), Some(stdout), Some(stderr)) = (child.stdin.take(), child.stdout.take(), child.stderr.take()) else {
        let _ = child.kill();
        let _ = child.wait();
        return Err("the plugin host's pipes were not set up".into());
    };
    let (ready_tx, ready) = mpsc::channel();
    let events = inner.on_event.clone();
    let watcher = Arc::downgrade(inner);
    let rpc = Rpc::start_serving(
        stdout,
        stdin,
        inner.serve.clone(),
        move |method, params| {
            if method == "ready" {
                let _ = ready_tx.send(params);
            } else {
                events(Event::Notification { method: method.to_owned(), params });
            }
        },
        move |_| {
            if let Some(inner) = watcher.upgrade() {
                inner.poke();
            }
        },
    );
    let events = inner.on_event.clone();
    let _ = thread::Builder::new().name("plugin-host-stderr".into()).spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            events(Event::Stderr(line));
        }
    });
    Ok(Running { child, rpc, ready, _guard: guard })
}

fn exited(child: &mut Child) -> Option<String> {
    match child.try_wait() {
        Ok(Some(status)) => Some(format!("the plugin host exited ({status})")),
        Ok(None) => None,
        Err(error) => Some(format!("could not check the plugin host: {error}")),
    }
}

const EXIT_GRACE: Duration = Duration::from_millis(500);

fn exit_reason(child: &mut Child, within: Duration) -> Option<String> {
    let deadline = Instant::now() + within;
    loop {
        if let Some(reason) = exited(child) {
            return Some(reason);
        }
        if Instant::now() >= deadline {
            return None;
        }
        thread::sleep(Duration::from_millis(10));
    }
}

fn check_protocol(ready: Value) -> Result<Value, String> {
    match ready.get("protocol").and_then(Value::as_u64) {
        Some(PROTOCOL) => Ok(ready),
        Some(other) => Err(format!("the plugin host speaks protocol {other}, but Fuyu only speaks protocol {PROTOCOL}; the host and the app do not match")),
        None => Err(format!("the plugin host did not say which protocol it speaks; Fuyu only speaks protocol {PROTOCOL}")),
    }
}

fn wait_ready(inner: &Inner, running: &mut Running, timing: &Timing) -> Result<Value, String> {
    let deadline = Instant::now() + timing.ready_within;
    loop {
        match running.ready.recv_timeout(Duration::from_millis(50)) {
            Ok(ready) => return check_protocol(ready),
            Err(mpsc::RecvTimeoutError::Disconnected) => return Err("the plugin host closed its output before it was ready".into()),
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }
        if let Some(reason) = exited(&mut running.child) {
            return Err(format!("{reason} before it was ready"));
        }
        if inner.stopping() {
            return Err("stopping".into());
        }
        if Instant::now() > deadline {
            return Err(format!("the plugin host was not ready in {} s", timing.ready_within.as_secs()));
        }
    }
}

fn watch(inner: &Inner, running: &mut Running, timing: &Timing) -> Option<String> {
    loop {
        if inner.pause(timing.ping_every) {
            return None;
        }
        if inner.take_restart() {
            return Some("asked to restart".into());
        }
        if let Some(reason) = exited(&mut running.child) {
            return Some(reason);
        }
        match running.rpc.call("ping", Value::Null, timing.ping_timeout) {
            Ok(_) => {}
            Err(RpcError::Timeout { .. }) => return Some(format!("the plugin host did not answer a heartbeat in {} ms", timing.ping_timeout.as_millis())),
            Err(error) => return Some(exit_reason(&mut running.child, EXIT_GRACE).unwrap_or_else(|| error.to_string())),
        }
    }
}

fn shut(running: &mut Running, grace: Duration, polite: bool) {
    if polite {
        let _ = running.rpc.call("stop", json!(null), grace);
    }
    running.rpc.close_input();
    let deadline = Instant::now() + grace;
    while Instant::now() < deadline {
        if exited(&mut running.child).is_some() {
            return;
        }
        thread::sleep(Duration::from_millis(20));
    }
    let _ = running.child.kill();
    let _ = running.child.wait();
}

fn supervise(inner: &Arc<Inner>, mut spec_for: impl FnMut(u32) -> HostSpec, containment: &dyn Containment, timing: Timing) {
    let mut failures = 0u32;
    let mut generation = 0u32;
    while !inner.stopping() {
        generation += 1;
        inner.take_restart();
        let spec = spec_for(generation);
        inner.set(HostState::Starting { generation });
        let outcome = launch(inner, &spec, containment).and_then(|mut running| match wait_ready(inner, &mut running, &timing) {
            Ok(ready) => Ok((running, ready)),
            Err(reason) => {
                shut(&mut running, Duration::from_millis(200), false);
                Err(reason)
            }
        });
        let reason = match outcome {
            Ok((mut running, ready)) => {
                *lock(&inner.rpc) = Some(running.rpc.clone());
                inner.set(HostState::Ready { generation, pid: running.child.id(), ready });
                let started = Instant::now();
                let reason = watch(inner, &mut running, &timing);
                lock(&inner.rpc).take();
                if started.elapsed() >= timing.healthy_after {
                    failures = 0;
                }
                match reason {
                    None => {
                        shut(&mut running, timing.stop_grace, true);
                        break;
                    }
                    Some(reason) => {
                        shut(&mut running, Duration::from_millis(200), false);
                        reason
                    }
                }
            }
            Err(reason) => reason,
        };
        if inner.stopping() {
            break;
        }
        failures += 1;
        let retry_in = timing.backoff(failures - 1);
        inner.set(HostState::Down { generation, reason, retry_in });
        if inner.pause(retry_in) {
            break;
        }
    }
    lock(&inner.rpc).take();
    inner.set(HostState::Stopped);
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::Timing;

    #[test]
    fn the_first_restart_is_immediate_then_the_wait_doubles_up_to_the_cap() {
        let timing = Timing::default();
        let waits: Vec<u128> = (0..10).map(|failures| timing.backoff(failures).as_millis()).collect();
        assert_eq!(waits, [0, 250, 500, 1000, 2000, 4000, 8000, 16000, 30000, 30000]);
        assert_eq!(timing.backoff(u32::MAX), Duration::from_secs(30));
    }
}
