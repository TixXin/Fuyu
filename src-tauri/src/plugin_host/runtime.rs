use serde::Serialize;
use serde_json::{json, Map, Value};
use crate::system::CommandExt;
use std::{
    collections::{BTreeSet, HashMap, VecDeque},
    ffi::OsString,
    io::{BufRead, BufReader, ErrorKind, Read},
    path::PathBuf,
    process::{Child, ChildStderr, ChildStdout, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
        Arc, Mutex, PoisonError,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::AppHandle;

mod calls;
mod dispatch;
mod outbox;
mod trace;

pub use calls::CallRecord;
pub use trace::TraceEntry;

use super::{rpc, settings::InfoItem};
use crate::{agent_status, platform::job::{self, Job, JobUsage}, system::CREATE_NO_WINDOW};
use dispatch::{answer_request, initialize_params};
use outbox::{Outbox, SendError};

const LOG_LINES: usize = 200;
const RESTART_DELAYS: [Duration; 3] = [Duration::from_secs(1), Duration::from_secs(5), Duration::from_secs(30)];
const HEALTHY_UPTIME: Duration = Duration::from_secs(60);
const STOP_GRACE: Duration = Duration::from_secs(2);
const KILL_WAIT: Duration = Duration::from_secs(2);
const MAX_LINE_BYTES: u64 = 1024 * 1024;
const MAX_IN_FLIGHT: usize = 16;
const POLL: Duration = Duration::from_millis(50);

static NEXT_GENERATION: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RuntimeStatus {
    #[default]
    Stopped,
    Starting,
    Running,
    Restarting,
    Crashed,
    Idle,
}

#[derive(Debug, Clone, Default)]
pub(super) struct RuntimeInfo {
    generation: u64,
    pub status: RuntimeStatus,
    pub error: Option<String>,
    pub log: VecDeque<String>,
    pub info: Vec<InfoItem>,
    pub startup_ms: Option<u64>,
    pub resources: Option<Resources>,
    pub keep_alive: Option<String>,
    pub log_seq: u64,
    pub trace: VecDeque<TraceEntry>,
    pub calls: VecDeque<CallRecord>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Resources {
    pub memory_bytes: u64,
    pub runtime_bytes: Option<u64>,
    pub processes: Vec<ProcessResources>,
    pub cpu_percent: f32,
    pub high_cpu: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessResources {
    pub name: String,
    pub memory_bytes: u64,
    pub working_set_bytes: u64,
}

pub(super) type RuntimeTable = Arc<Mutex<HashMap<String, RuntimeInfo>>>;

pub(super) struct LaunchSpec {
    pub plugin_id: String,
    pub program: OsString,
    pub args: Vec<OsString>,
    pub dir: PathBuf,
    pub data_dir: PathBuf,
    pub api_version: u32,
    pub granted: Vec<String>,
    pub optional: Vec<String>,
    pub app_version: String,
    pub display_name: String,
    pub settings: Map<String, Value>,
    pub activation_event: String,
    pub dev: bool,
    pub experimental_apis: Vec<String>,
}

struct Context {
    generation: u64,
    app: AppHandle,
    spec: LaunchSpec,
    settings: Mutex<Map<String, Value>>,
    table: RuntimeTable,
    stop: AtomicBool,
    stdin: Mutex<Option<Outbox>>,
    child: Mutex<Option<Child>>,
    in_flight: AtomicUsize,
    subscriptions: Mutex<BTreeSet<&'static str>>,
    ready: AtomicBool,
    last_activity: Mutex<Instant>,
    keep_alive: Mutex<Option<String>>,
    job: Mutex<Option<Job>>,
    spawned_at: Mutex<Option<Instant>>,
    idle_stop: AtomicBool,
    failed: Mutex<Option<String>>,
}

pub(super) struct IdleState {
    pub ready: bool,
    pub busy: bool,
    pub idle_for: Duration,
    pub keep_alive: bool,
    pub subscriptions: Vec<&'static str>,
}

pub(super) struct Supervisor {
    context: Arc<Context>,
}

impl Supervisor {
    pub fn start(app: AppHandle, spec: LaunchSpec, table: RuntimeTable) -> Result<Self, String> {
        let context = Arc::new(Context {
            generation: NEXT_GENERATION.fetch_add(1, Ordering::SeqCst),
            app,
            settings: Mutex::new(spec.settings.clone()),
            spec,
            table,
            stop: AtomicBool::new(false),
            stdin: Mutex::new(None),
            child: Mutex::new(None),
            in_flight: AtomicUsize::new(0),
            subscriptions: Mutex::default(),
            ready: AtomicBool::new(false),
            last_activity: Mutex::new(Instant::now()),
            keep_alive: Mutex::default(),
            job: Mutex::default(),
            spawned_at: Mutex::default(),
            idle_stop: AtomicBool::new(false),
            failed: Mutex::default(),
        });
        let worker = Arc::clone(&context);
        thread::Builder::new()
            .name(format!("plugin-{}", context.spec.plugin_id))
            .spawn(move || supervise(&worker))
            .map_err(|error| format!("Could not start the plugin thread: {error}"))?;
        Ok(Self { context })
    }

    pub fn plugin_id(&self) -> &str {
        &self.context.spec.plugin_id
    }

    pub fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        *lock(&self.context.last_activity) = Instant::now();
        write_line(&self.context, &rpc::notification_line(method, params))
    }

    pub fn is_ready(&self) -> bool {
        self.context.ready.load(Ordering::SeqCst)
    }

    pub fn idle_state(&self) -> IdleState {
        IdleState {
            ready: self.is_ready(),
            busy: self.context.in_flight.load(Ordering::SeqCst) > 0,
            idle_for: lock(&self.context.last_activity).elapsed(),
            keep_alive: lock(&self.context.keep_alive).is_some(),
            subscriptions: lock(&self.context.subscriptions).iter().copied().collect(),
        }
    }

    pub fn usage(&self) -> Option<JobUsage> {
        lock(&self.context.job).as_ref().and_then(Job::usage)
    }

    pub fn fail(&self, reason: String) {
        fail(&self.context, reason);
    }

    pub fn stop_idle(self) {
        self.context.idle_stop.store(true, Ordering::SeqCst);
        self.stop();
    }

    pub fn update_settings(&self, settings: Map<String, Value>) {
        *lock(&self.context.settings) = settings.clone();
        let _ = self.notify("settings.changed", json!({ "settings": settings }));
    }

    pub fn is_subscribed(&self, name: &str) -> bool {
        lock(&self.context.subscriptions).contains(name)
    }

    pub fn unsubscribe_needing(&self, permission: &str) {
        lock(&self.context.subscriptions)
            .retain(|name| super::events::event_permission(name).and_then(|(_, needed)| needed) != Some(permission));
    }

    pub fn deliver_event(&self, name: &str, payload: &Value) {
        if lock(&self.context.subscriptions).contains(name) {
            let _ = self.notify("event", json!({ "name": name, "payload": payload }));
        }
    }

    pub fn stop(self) {
        let context = self.context;
        context.stop.store(true, Ordering::SeqCst);
        let _ = write_line(&context, &rpc::notification_line("shutdown", json!({})));
        lock(&context.stdin).take();
        let grace = Instant::now() + STOP_GRACE;
        let mut killed_at: Option<Instant> = None;
        loop {
            {
                let mut child = lock(&context.child);
                let Some(process) = child.as_mut() else { break };
                match process.try_wait() {
                    Ok(Some(_)) | Err(_) => break,
                    Ok(None) => match killed_at {
                        None if Instant::now() >= grace => {
                            let _ = process.kill();
                            killed_at = Some(Instant::now());
                        }
                        Some(at) if at.elapsed() >= KILL_WAIT => break,
                        _ => {}
                    },
                }
            }
            thread::sleep(POLL);
        }
        lock(&context.job).take();
    }
}

fn fail(context: &Context, reason: String) {
    *lock(&context.failed) = Some(reason);
    context.stop.store(true, Ordering::SeqCst);
    if let Some(process) = lock(&context.child).as_mut() {
        let _ = process.kill();
    }
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

fn supervise(context: &Arc<Context>) {
    let mut failures = 0;
    loop {
        if context.stop.load(Ordering::SeqCst) {
            break;
        }
        set_status(context, RuntimeStatus::Starting, None);
        let mut child = match spawn(&context.spec) {
            Ok(child) => child,
            Err(error) => {
                log_line(context, &error);
                set_status(context, RuntimeStatus::Crashed, Some(error));
                return;
            }
        };
        lock(&context.subscriptions).clear();
        lock(&context.keep_alive).take();
        super::sensitive::forget_this_run(&context.spec.plugin_id);
        match Job::new().and_then(|job| job.assign(&child).map(|()| job)) {
            Ok(job) => *lock(&context.job) = Some(job),
            Err(error) => log_line(context, &error),
        }
        if let Err(error) = job::resume(child.id()) {
            let _ = child.kill();
            let _ = child.wait();
            log_line(context, &error);
            set_status(context, RuntimeStatus::Crashed, Some(error));
            return;
        }
        *lock(&context.spawned_at) = Some(Instant::now());
        update_entry(context, |info| {
            info.startup_ms = None;
            info.keep_alive = None;
        });
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        *lock(&context.stdin) = child
            .stdin
            .take()
            .and_then(|stdin| Outbox::new(stdin).map_err(|error| log_line(context, &error)).ok());
        *lock(&context.child) = Some(child);
        if context.stop.load(Ordering::SeqCst) {
            if let Some(process) = lock(&context.child).as_mut() {
                let _ = process.kill();
            }
            lock(&context.stdin).take();
        }
        let started = Instant::now();
        set_status(context, RuntimeStatus::Running, None);
        log_line(context, "started");
        let _ = write_line(context, &rpc::notification_line("initialize", initialize_params(context)));
        *lock(&context.last_activity) = Instant::now();
        context.ready.store(true, Ordering::SeqCst);

        if let Some(stderr) = stderr {
            let reader = Arc::clone(context);
            let _ = thread::Builder::new().name("plugin-stderr".into()).spawn(move || read_stderr(&reader, stderr));
        }
        if let Some(stdout) = stdout {
            let refused = read_messages(context, stdout);
            end_after_output(context, refused);
        }
        let exit = wait_for_exit(context);
        context.ready.store(false, Ordering::SeqCst);
        lock(&context.stdin).take();
        lock(&context.job).take();
        update_entry(context, |info| info.resources = None);
        if let Some(reason) = lock(&context.failed).take() {
            log_line(context, &reason);
            set_status(context, RuntimeStatus::Crashed, Some(reason));
            agent_status::clear_external_owner(&context.spec.plugin_id);
            return;
        }
        if context.stop.load(Ordering::SeqCst) {
            break;
        }
        log_line(context, &format!("stopped ({exit})"));
        if started.elapsed() >= HEALTHY_UPTIME {
            failures = 0;
        }
        let Some(delay) = RESTART_DELAYS.get(failures).copied() else {
            let message = format!("The plugin stopped {} times in a row ({exit}).", failures + 1);
            set_status(context, RuntimeStatus::Crashed, Some(message));
            agent_status::clear_external_owner(&context.spec.plugin_id);
            return;
        };
        failures += 1;
        set_status(context, RuntimeStatus::Restarting, Some(format!("The plugin stopped ({exit}).")));
        if sleep_unless_stopped(&context.stop, delay) {
            break;
        }
    }
    let last = if context.idle_stop.load(Ordering::SeqCst) { RuntimeStatus::Idle } else { RuntimeStatus::Stopped };
    set_status(context, last, None);
}

#[cfg(windows)]
pub(super) fn find_node() -> Option<PathBuf> {
    let on_path = std::env::var_os("PATH")
        .into_iter()
        .flat_map(|path| std::env::split_paths(&path).collect::<Vec<_>>())
        .map(|dir| dir.join("node.exe"));
    let installed = ["ProgramFiles", "ProgramW6432"]
        .into_iter()
        .filter_map(std::env::var_os)
        .map(|dir| PathBuf::from(dir).join("nodejs").join("node.exe"));
    on_path.chain(installed).find(|candidate| candidate.is_file())
}

#[cfg(not(windows))]
pub(super) fn find_node() -> Option<PathBuf> {
    super::manifest::find_unix_program("node")
}

#[cfg(windows)]
pub(super) fn powershell_available() -> bool {
    true
}

#[cfg(not(windows))]
pub(super) fn powershell_available() -> bool {
    super::manifest::find_unix_program("pwsh").is_some()
}

fn spawn(spec: &LaunchSpec) -> Result<Child, String> {
    std::fs::create_dir_all(&spec.data_dir)
        .map_err(|error| format!("Could not create {}: {error}", spec.data_dir.display()))?;
    let program = match find_node() {
        Some(node) if spec.program == "node" => node.into_os_string(),
        _ => spec.program.clone(),
    };
    let mut command = Command::new(&program);
    #[cfg(unix)]
    std::os::unix::process::CommandExt::process_group(&mut command, 0);
    command
        .args(&spec.args)
        .current_dir(&spec.dir)
        .env("FUYU_PLUGIN_ID", &spec.plugin_id)
        .env("FUYU_PLUGIN_DATA_DIR", &spec.data_dir)
        .env("FUYU_PLUGIN_API_VERSION", spec.api_version.to_string())
        .env("FOCUSD_PLUGIN_ID", &spec.plugin_id)
        .env("FOCUSD_PLUGIN_DATA_DIR", &spec.data_dir)
        .env("FOCUSD_PLUGIN_API_VERSION", spec.api_version.to_string())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW | job::START_SUSPENDED)
        .spawn()
        .map_err(|error| {
            if error.kind() == ErrorKind::NotFound && spec.program == "node" {
                "This plugin needs Node.js: install it so that `node` is on PATH, then restart the plugin.".to_string()
            } else {
                format!("Could not start {}: {error}", program.to_string_lossy())
            }
        })
}

fn read_messages(context: &Arc<Context>, stdout: ChildStdout) -> bool {
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    loop {
        line.clear();
        match reader.by_ref().take(MAX_LINE_BYTES).read_line(&mut line) {
            Ok(0) => return false,
            Ok(_) if !line.ends_with('\n') && line.len() as u64 >= MAX_LINE_BYTES => {
                log_line(context, "A message longer than 1 MB was dropped; stopping the plugin.");
                return true;
            }
            Ok(_) => handle_line(context, line.trim()),
            Err(error) if error.kind() == ErrorKind::InvalidData => {
                log_line(context, "A message that is not UTF-8 was dropped.");
            }
            Err(error) => {
                log_line(context, &format!("Could not read the plugin's output ({error}); stopping the plugin."));
                return true;
            }
        }
    }
}

fn end_after_output(context: &Context, refused: bool) {
    let deadline = Instant::now() + if refused { Duration::ZERO } else { STOP_GRACE };
    loop {
        {
            let mut child = lock(&context.child);
            let Some(process) = child.as_mut() else { return };
            match process.try_wait() {
                Ok(Some(_)) | Err(_) => return,
                Ok(None) if Instant::now() >= deadline => {
                    let _ = process.kill();
                    return;
                }
                Ok(None) => {}
            }
        }
        thread::sleep(POLL);
    }
}

fn read_stderr(context: &Context, stderr: ChildStderr) {
    let mut reader = BufReader::new(stderr);
    let mut line = Vec::new();
    loop {
        line.clear();
        match reader.by_ref().take(MAX_LINE_BYTES).read_until(b'\n', &mut line) {
            Ok(0) | Err(_) => return,
            Ok(_) => {
                let complete = line.ends_with(b"\n");
                log_line(context, String::from_utf8_lossy(&line).trim_end());
                if !complete && line.len() as u64 >= MAX_LINE_BYTES && reader.skip_until(b'\n').is_err() {
                    return;
                }
            }
        }
    }
}

fn handle_line(context: &Arc<Context>, line: &str) {
    if line.is_empty() {
        return;
    }
    *lock(&context.last_activity) = Instant::now();
    trace::record(context, false, line);
    if let Some(started) = lock(&context.spawned_at).take() {
        let elapsed = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);
        update_entry(context, |info| info.startup_ms = Some(elapsed));
    }
    match rpc::parse_line(line) {
        rpc::Incoming::Request { id, method, params } => {
            if context.in_flight.fetch_add(1, Ordering::SeqCst) >= MAX_IN_FLIGHT {
                context.in_flight.fetch_sub(1, Ordering::SeqCst);
                let busy = rpc::error_line(&id, rpc::HOST_ERROR, "Too many requests at once.", Some(json!({ "status": 429 })));
                calls::record(context, &method, &busy);
                let _ = write_line(context, &busy);
                return;
            }
            let worker = Arc::clone(context);
            let spawned = thread::Builder::new().name("plugin-request".into()).spawn(move || {
                let answer = answer_request(&worker, &id, &method, params);
                calls::record(&worker, &method, &answer);
                worker.in_flight.fetch_sub(1, Ordering::SeqCst);
                let _ = write_line(&worker, &answer);
            });
            if spawned.is_err() {
                context.in_flight.fetch_sub(1, Ordering::SeqCst);
            }
        }
        rpc::Incoming::Notification { method, params } => {
            if method == "log" {
                let message = params.get("message").and_then(Value::as_str).unwrap_or_default();
                log_line(context, message);
            }
        }
        rpc::Incoming::Response => {}
        rpc::Incoming::Invalid { id, code, message } => {
            log_line(context, &message);
            if !id.is_null() {
                let _ = write_line(context, &rpc::error_line(&id, code, &message, None));
            }
        }
    }
}

fn write_line(context: &Context, line: &str) -> Result<(), String> {
    let sent = match lock(&context.stdin).as_ref() {
        Some(outbox) => outbox.send(line.to_string()),
        None => Err(SendError::Closed),
    };
    match sent {
        Ok(()) => {
            trace::record(context, true, line);
            Ok(())
        }
        Err(SendError::Closed) => Err("The plugin is not running.".into()),
        Err(SendError::Full) => {
            let reason = format!("The plugin stopped reading its input ({} messages were waiting).", outbox::CAPACITY);
            fail(context, reason.clone());
            Err(reason)
        }
    }
}

fn wait_for_exit(context: &Context) -> String {
    loop {
        {
            let mut child = lock(&context.child);
            let Some(process) = child.as_mut() else {
                return "stopped".into();
            };
            match process.try_wait() {
                Ok(Some(status)) => {
                    child.take();
                    return status
                        .code()
                        .map_or_else(|| "terminated".into(), |code| format!("exit code {code}"));
                }
                Ok(None) => {}
                Err(error) => {
                    child.take();
                    return error.to_string();
                }
            }
        }
        thread::sleep(POLL);
    }
}

fn sleep_unless_stopped(stop: &AtomicBool, delay: Duration) -> bool {
    let deadline = Instant::now() + delay;
    while Instant::now() < deadline {
        if stop.load(Ordering::SeqCst) {
            return true;
        }
        thread::sleep(POLL);
    }
    stop.load(Ordering::SeqCst)
}

fn current_entry<'a>(context: &Context, table: &'a mut HashMap<String, RuntimeInfo>) -> Option<&'a mut RuntimeInfo> {
    let info = table.entry(context.spec.plugin_id.clone()).or_default();
    if info.generation > context.generation {
        return None;
    }
    info.generation = context.generation;
    Some(info)
}

fn update_entry(context: &Context, change: impl FnOnce(&mut RuntimeInfo)) {
    let mut table = lock(&context.table);
    if let Some(info) = current_entry(context, &mut table) {
        change(info);
    }
}

fn set_keep_alive(context: &Context, reason: Option<String>) {
    *lock(&context.keep_alive) = reason.clone();
    update_entry(context, |info| info.keep_alive = reason);
}

fn set_status(context: &Context, status: RuntimeStatus, error: Option<String>) {
    {
        let mut table = lock(&context.table);
        let Some(info) = current_entry(context, &mut table) else { return };
        info.status = status;
        info.error = error;
        if status != RuntimeStatus::Running {
            info.info.clear();
        }
    }
    super::views::runtime_changed(&context.app, &context.spec.plugin_id, status);
}

fn log_line(context: &Context, line: &str) {
    let mut table = lock(&context.table);
    let Some(info) = current_entry(context, &mut table) else { return };
    let line: String = line.chars().take(500).collect();
    info.log.push_back(line);
    info.log_seq += 1;
    while info.log.len() > LOG_LINES {
        info.log.pop_front();
    }
}
