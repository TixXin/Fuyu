mod bisect;
pub(crate) mod builtins;
mod builtins_file;
mod containment;
#[cfg(debug_assertions)]
pub(crate) mod diagnostics;
mod methods;
mod node_status;
pub(crate) mod package_open;
pub(crate) mod protocol;
mod safe_mode;
mod v2_builtins;
pub(crate) mod v2_migration;
pub(crate) mod worker;

use std::{
    path::PathBuf,
    sync::{Arc, Condvar, Mutex, OnceLock, PoisonError},
    time::Duration,
};

use plugin_base::{node_for_host, official_download, ChosenNode, Event, HostSpec, HostState, NodeSearch, NodeSource, Progress, Supervisor, Timing, MINIMUM_NODE};
use serde::Serialize;
use tauri::AppHandle;

const SWITCH: &str = "FUYU_PLUGINS_V3";
const CONFIG: &str = "plugins.yml";
const RELEASE_ORIGINS: [&str; 3] = ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"];

static SUPERVISOR: OnceLock<(Mutex<Option<Arc<Supervisor>>>, Condvar)> = OnceLock::new();
static PLUGINS_DIR: OnceLock<PathBuf> = OnceLock::new();
static TRACKER: OnceLock<Mutex<safe_mode::Tracker>> = OnceLock::new();
static STOPPING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn supervisor_gate() -> &'static (Mutex<Option<Arc<Supervisor>>>, Condvar) {
    SUPERVISOR.get_or_init(|| (Mutex::new(None), Condvar::new()))
}

fn supervisor_slot() -> Option<&'static Mutex<Option<Arc<Supervisor>>>> {
    SUPERVISOR.get().map(|(mutex, _)| mutex)
}

fn is_prerelease(version: &str) -> bool {
    version.split_once('-').is_some_and(|(core, _)| {
        let parts: Vec<&str> = core.split('.').collect();
        parts.len() == 3 && parts.iter().all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()))
    })
}

fn on_by_default(development: bool, version: &str) -> bool {
    development || is_prerelease(version)
}

fn enabled(default_on: bool, switch: Option<&str>) -> bool {
    if default_on {
        switch != Some("0")
    } else {
        switch == Some("1")
    }
}

fn switched_on() -> bool {
    enabled(on_by_default(cfg!(debug_assertions), env!("CARGO_PKG_VERSION")), std::env::var(SWITCH).ok().as_deref())
}

fn host_script() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../packages/plugin-base/src/host/main.mjs")
}

fn builtins_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/features")
}

const BUNDLED_HOST: &str = "plugins-v3/host/main.mjs";
const BUNDLED_BUILTINS: &str = "plugins-v3/builtins";

#[derive(Debug, Clone, PartialEq)]
struct HostFiles {
    script: PathBuf,
    builtins: PathBuf,
}

fn host_files(resources: Option<&std::path::Path>, development: bool) -> HostFiles {
    match resources.filter(|_| !development) {
        Some(dir) if dir.join(BUNDLED_HOST).is_file() => HostFiles { script: dir.join(BUNDLED_HOST), builtins: dir.join(BUNDLED_BUILTINS) },
        _ => HostFiles { script: host_script(), builtins: builtins_dir() },
    }
}

fn window_origins(dev_url: Option<&str>) -> Vec<String> {
    let mut origins: Vec<String> = RELEASE_ORIGINS.iter().map(|origin| (*origin).to_owned()).collect();
    if let Some(url) = dev_url.and_then(|url| url.split_once("://").map(|(scheme, rest)| format!("{scheme}://{}", rest.split('/').next().unwrap_or(rest)))) {
        origins.push(url);
    }
    origins
}

fn host_origins(development: bool, dev_url: Option<&str>) -> Vec<String> {
    window_origins(dev_url.filter(|_| development))
}

const SAFE_SWITCH: &str = "FUYU_PLUGINS_V3_SAFE";

#[derive(Debug, Clone, Default, PartialEq)]
struct HostMode {
    development: bool,
    safe: Option<String>,
    bisect: Vec<String>,
}

fn host_args(dir: PathBuf, files: &HostFiles, origins: &[String], mode: &HostMode) -> Vec<std::ffi::OsString> {
    let mut args: Vec<std::ffi::OsString> = vec!["--disallow-code-generation-from-strings".into()];
    if mode.development {
        args.push("--expose-internals".into());
    }
    args.extend([
        files.script.clone().into(),
        "--dir".into(),
        dir.into(),
        "--builtins".into(),
        files.builtins.clone().into(),
        "--app-version".into(),
        env!("CARGO_PKG_VERSION").into(),
        "--watch".into(),
    ]);
    if mode.development {
        args.push("--dev".into());
    }
    if let Some(safe) = &mode.safe {
        args.push("--safe".into());
        args.push(safe.into());
    }
    for id in &mode.bisect {
        args.push(format!("--bisect={id}").into());
    }
    for origin in origins {
        args.push("--origin".into());
        args.push(origin.into());
    }
    args
}

const THREADPOOL: &str = "UV_THREADPOOL_SIZE";
const WINDOWS_THREADPOOL_SIZE: &str = "2";

fn host_env(windows: bool, inherited: Option<&str>) -> Vec<(std::ffi::OsString, std::ffi::OsString)> {
    if windows && inherited.is_none() {
        vec![(THREADPOOL.into(), WINDOWS_THREADPOOL_SIZE.into())]
    } else {
        Vec::new()
    }
}

fn plugins_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = crate::home_dir::fuyu_home(tauri::Manager::path(app)).map_err(|error| error.to_string())?.join("plugins-v3");
    std::fs::create_dir_all(&dir).map_err(|error| format!("could not create {}: {error}", dir.display()))?;
    let config = dir.join(CONFIG);
    if !config.exists() {
        std::fs::write(&config, "[]\n").map_err(|error| format!("could not create {}: {error}", config.display()))?;
    }
    Ok(dir)
}

fn describe(state: &HostState) -> String {
    match state {
        HostState::Starting { generation } => format!("starting (#{generation})"),
        HostState::Ready { generation, pid, .. } => format!("ready (#{generation}, pid {pid})"),
        HostState::Down { generation, reason, retry_in } => format!("down (#{generation}): {reason}; retrying in {} ms", retry_in.as_millis()),
        HostState::Stopped => "stopped".into(),
    }
}

fn report(event: Event) {
    match event {
        Event::State(state) => eprintln!("[plugins-v3] host {}", describe(&state)),
        Event::Stderr(line) => eprintln!("[plugins-v3 host] {line}"),
        Event::Notification { method, params } => eprintln!("[plugins-v3 host {method}] {params}"),
    }
}

fn progress_reporter() -> impl FnMut(Progress) {
    let mut last: Option<(String, u64)> = None;
    move |progress: Progress| {
        node_status::gate().set(node_status::NodeStatus::Downloading { downloaded: progress.downloaded, total: progress.total });
        let step = progress.total.map(|total| (progress.downloaded * 10 / total.max(1)).min(10)).unwrap_or(progress.downloaded >> 24);
        if last.as_ref().is_some_and(|(url, seen)| url == progress.url && *seen == step) {
            return;
        }
        last = Some((progress.url.to_owned(), step));
        match progress.total {
            Some(total) => eprintln!("[plugins-v3] downloading Node from {}: {} of {} MB", progress.url, progress.downloaded >> 20, total >> 20),
            None => eprintln!("[plugins-v3] downloading Node from {}: {} MB", progress.url, progress.downloaded >> 20),
        }
    }
}

fn choose_node(data_dir: &std::path::Path) -> Result<ChosenNode, String> {
    node_status::gate().set(node_status::NodeStatus::Checking);
    let download = official_download(crate::system::updater::get_updater_proxy());
    let chosen = node_for_host(&NodeSearch::from_env(), MINIMUM_NODE, data_dir, download, &mut progress_reporter())?;
    let source = match chosen.source {
        NodeSource::System => "found on this computer",
        NodeSource::Downloaded => "downloaded by Fuyu",
    };
    eprintln!("[plugins-v3] using Node {} ({source}) at {}", chosen.version, chosen.path.display());
    node_status::gate().set(node_status::NodeStatus::Ready);
    Ok(chosen)
}

fn tracker() -> Option<std::sync::MutexGuard<'static, safe_mode::Tracker>> {
    TRACKER.get()?.lock().ok()
}

fn spec_for(node: PathBuf, dir: PathBuf, files: HostFiles, origins: Vec<String>, development: bool) -> impl FnMut(u32) -> HostSpec + Send + 'static {
    let env = host_env(cfg!(windows), std::env::var(THREADPOOL).ok().as_deref());
    move |generation| {
        let safe = tracker().and_then(|mut tracker| tracker.starting(generation));
        if let Some(safe) = &safe {
            eprintln!("[plugins-v3] safe mode: {} ({:?}, {} failed starts)", safe.mode, safe.cause, safe.failures);
        }
        let off = bisect::off(&dir);
        if !off.is_empty() {
            eprintln!("[plugins-v3] bisect: switching off {}", off.join(", "));
        }
        let mode = HostMode { development, safe: safe.map(|safe| safe.mode), bisect: off };
        HostSpec { program: node.clone(), args: host_args(dir.clone(), &files, &origins, &mode), env: env.clone(), current_dir: None }
    }
}

fn track(event: &Event) {
    match event {
        Event::State(HostState::Down { generation, reason, .. }) => {
            if let Some(mut tracker) = tracker() {
                tracker.went_down(*generation, reason);
            }
        }
        Event::State(HostState::Ready { generation, .. }) => {
            let generation = *generation;
            let _ = std::thread::Builder::new().name("plugin-host-bisect".into()).spawn(move || resend_bisect(generation));
            let _ = std::thread::Builder::new().name("plugin-host-healthy".into()).spawn(move || {
                std::thread::sleep(safe_mode::HEALTHY_AFTER);
                if let Some(mut tracker) = tracker() {
                    tracker.healthy(generation);
                }
            });
        }
        _ => {}
    }
}

const BISECT_TIMEOUT: Duration = Duration::from_secs(5);
const SLOT_WAIT: Duration = Duration::from_secs(5);

fn supervisor() -> Option<Arc<Supervisor>> {
    supervisor_slot()?.lock().ok()?.clone()
}

fn wait_for_supervisor() -> Option<Arc<Supervisor>> {
    let (mutex, condvar) = supervisor_gate();
    let guard = mutex.lock().unwrap_or_else(PoisonError::into_inner);
    let (guard, _) = condvar.wait_timeout_while(guard, SLOT_WAIT, |slot| {
        slot.is_none() && !STOPPING.load(std::sync::atomic::Ordering::SeqCst)
    }).unwrap_or_else(PoisonError::into_inner);
    if STOPPING.load(std::sync::atomic::Ordering::SeqCst) {
        return None;
    }
    guard.clone()
}

fn ready_generation(supervisor: &Supervisor) -> Option<u32> {
    match supervisor.state() {
        HostState::Ready { generation, .. } => Some(generation),
        _ => None,
    }
}

fn resend_bisect(generation: u32) {
    let Some(dir) = PLUGINS_DIR.get() else { return };
    let Some(supervisor) = wait_for_supervisor() else { return };
    if ready_generation(&supervisor) != Some(generation) {
        return;
    }
    if let Err(error) = supervisor.call(bisect::METHOD, bisect::params(&bisect::off(dir)), BISECT_TIMEOUT) {
        eprintln!("[plugins-v3] could not hand the bisect list to the plugin host (#{generation}): {error}");
    }
}

fn send_bisect(params: serde_json::Value) -> Result<Option<serde_json::Value>, plugin_base::RpcError> {
    match supervisor().filter(|supervisor| ready_generation(supervisor).is_some()) {
        Some(supervisor) => supervisor.call(bisect::METHOD, params, BISECT_TIMEOUT).map(Some),
        None => Ok(None),
    }
}

#[expect(dead_code, reason = "E36.5.9 reads the bisect for its plugin page")]
pub(crate) fn plugin_bisect() -> Option<bisect::Bisect> {
    bisect::read(PLUGINS_DIR.get()?)
}

#[expect(dead_code, reason = "E36.5.9 calls it from its bisect commands")]
pub(crate) fn set_plugin_bisect(next: Option<&bisect::Bisect>) -> Result<bisect::Applied, String> {
    let dir = PLUGINS_DIR.get().ok_or("the plugin kernel is not running")?;
    bisect::apply(dir, next, send_bisect)
}

fn start(home: PathBuf, dir: PathBuf, files: HostFiles, origins: Vec<String>, development: bool, serve: plugin_base::Serve) -> Result<(), String> {
    let serve = std::sync::Arc::new(serve);
    let node = loop {
        match choose_node(&home) {
            Ok(node) => break node,
            Err(error) => {
                eprintln!("[plugins-v3] no Node for the plugin host: {error}");
                node_status::gate().set(node_status::NodeStatus::Failed { error });
                if !node_status::gate().wait_for_retry() {
                    return Ok(());
                }
            }
        }
    };
    let supervisor = Supervisor::start_serving(spec_for(node.path, dir, files, origins, development), containment::shared(), Timing::default(), Some(serve), |event| {
        protocol::observe(&event);
        track(&event);
        report(event);
    })?;
    let (mutex, condvar) = supervisor_gate();
    let mut slot = mutex.lock().map_err(|_| "the plugin host lock is poisoned".to_string())?;
    if STOPPING.load(std::sync::atomic::Ordering::SeqCst) {
        drop(slot);
        supervisor.stop();
        return Ok(());
    }
    *slot = Some(Arc::new(supervisor));
    condvar.notify_all();
    Ok(())
}

pub(crate) fn init(app: &AppHandle) -> Result<(), String> {
    if !switched_on() {
        return Ok(());
    }
    if !cfg!(debug_assertions) {
        eprintln!("[plugins-v3] release build {}: starting the plugin host", env!("CARGO_PKG_VERSION"));
    }
    let _ = node_status::gate();
    let home = crate::home_dir::fuyu_home(tauri::Manager::path(app)).map_err(|error| error.to_string())?;
    let dir = plugins_dir(app)?;
    let _ = PLUGINS_DIR.set(dir.clone());
    let _ = supervisor_gate();
    let dev_url = app.config().build.dev_url.as_ref().map(ToString::to_string);
    let origins = host_origins(cfg!(debug_assertions), dev_url.as_deref());
    let files = host_files(tauri::Manager::path(app).resource_dir().ok().as_deref(), cfg!(debug_assertions));
    eprintln!("[plugins-v3] host script {}", files.script.display());
    let shift = crate::platform::input::is_shift_key_down();
    let serve = methods::table(app)?;
    let _ = TRACKER.set(Mutex::new(safe_mode::Tracker::new(Some(&dir), std::env::var(SAFE_SWITCH).ok(), shift)));
    std::thread::Builder::new()
        .name("plugin-host-start".into())
        .spawn(move || {
            if let Err(error) = start(home, dir, files, origins, cfg!(debug_assertions), serve) {
                eprintln!("[plugins-v3] the plugin host did not start: {error}");
            }
        })
        .map_err(|error| format!("could not start the plugin host thread: {error}"))?;
    Ok(())
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HostConnection {
    enabled: bool,
    port: Option<u64>,
    token: Option<String>,
    generation: Option<u32>,
    safe_mode: Option<safe_mode::SafeMode>,
    node: Option<node_status::NodeStatus>,
}

fn connection_from(enabled: bool, state: Option<&HostState>) -> HostConnection {
    match state {
        None => HostConnection { enabled, ..HostConnection::default() },
        Some(HostState::Ready { generation, ready, .. }) => HostConnection {
            enabled: true,
            port: ready["windows"]["port"].as_u64(),
            token: ready["windows"]["token"].as_str().map(str::to_owned),
            generation: Some(*generation),
            safe_mode: None,
            node: None,
        },
        Some(_) => HostConnection { enabled: true, ..HostConnection::default() },
    }
}

fn connection_now(switched_on: bool, slot: Option<&Mutex<Option<Arc<Supervisor>>>>) -> HostConnection {
    let Some(slot) = slot else { return connection_from(switched_on, None) };
    let state = slot.lock().ok().and_then(|supervisor| supervisor.as_ref().map(|supervisor| supervisor.state()));
    connection_from(true, state.as_ref())
}

#[tauri::command]
pub(crate) fn get_plugin_host_connection() -> HostConnection {
    let connection = connection_now(switched_on(), supervisor_slot());
    HostConnection { safe_mode: tracker().and_then(|tracker| tracker.current()), node: node_status::current(), ..connection }
}

#[tauri::command]
pub(crate) fn retry_plugin_host_node() -> bool {
    node_status::gate().retry()
}

#[tauri::command]
pub(crate) fn exit_plugin_safe_mode() -> Result<bool, String> {
    let left = tracker().is_some_and(|mut tracker| tracker.leave());
    if left {
        if let Some(supervisor) = supervisor() {
            supervisor.restart();
        }
    }
    Ok(left)
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HostMemory {
    pid: u32,
    bytes: u64,
    measure: &'static str,
}

const MEMORY_MEASURE: &str = if cfg!(windows) { "private-working-set" } else { "phys-footprint" };

fn host_pid(slot: Option<&Mutex<Option<Arc<Supervisor>>>>) -> Option<u32> {
    match slot?.lock().ok()?.as_ref()?.state() {
        HostState::Ready { pid, .. } => Some(pid),
        _ => None,
    }
}

fn memory_of(pid: Option<u32>, read: impl Fn(u32) -> Option<u64>) -> Option<HostMemory> {
    let pid = pid?;
    read(pid).map(|bytes| HostMemory { pid, bytes, measure: MEMORY_MEASURE })
}

#[tauri::command]
pub(crate) fn get_plugin_host_memory() -> Option<HostMemory> {
    memory_of(host_pid(supervisor_slot()), crate::platform::private_memory::private_bytes)
}

pub(crate) fn respond(request: &tauri::http::Request<Vec<u8>>) -> tauri::http::Response<Vec<u8>> {
    protocol::respond(PLUGINS_DIR.get().map(PathBuf::as_path), request)
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::plugin_kernel::get_plugin_host_connection,
            crate::plugin_kernel::get_plugin_host_memory,
            crate::plugin_kernel::exit_plugin_safe_mode,
            crate::plugin_kernel::retry_plugin_host_node,
            crate::plugin_kernel::builtins::get_builtin_plugins,
            crate::plugin_kernel::builtins::set_builtin_plugin_enabled,
            crate::plugin_kernel::builtins::set_builtin_plugin_config,
            crate::plugin_kernel::v2_migration::get_v2_plugin_migration,
            crate::plugin_kernel::v2_migration::dismiss_v2_plugin_migration,
            crate::plugin_kernel::package_open::take_pending_plugin_package,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

pub(crate) fn shutdown() {
    STOPPING.store(true, std::sync::atomic::Ordering::SeqCst);
    node_status::gate().stop();
    if let Some((_, condvar)) = SUPERVISOR.get() {
        condvar.notify_all();
    }
    let supervisor = supervisor_slot().and_then(|slot| slot.lock().ok()?.take());
    if let Some(supervisor) = supervisor {
        supervisor.stop();
    }
}

#[cfg(test)]
mod tests;
