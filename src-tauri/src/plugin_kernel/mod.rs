mod containment;
pub(crate) mod protocol;

use std::{path::PathBuf, sync::Mutex, sync::OnceLock};

use plugin_base::{node_for_host, official_download, ChosenNode, Event, HostSpec, HostState, NodeSearch, NodeSource, Progress, Supervisor, Timing, MINIMUM_NODE};
use serde::Serialize;
use tauri::AppHandle;

const SWITCH: &str = "FUYU_PLUGINS_V3";
const CONFIG: &str = "plugins.yml";
const RELEASE_ORIGINS: [&str; 3] = ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"];

static SUPERVISOR: OnceLock<Mutex<Option<Supervisor>>> = OnceLock::new();
static PLUGINS_DIR: OnceLock<PathBuf> = OnceLock::new();
static STOPPING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn enabled(development: bool, switch: Option<&str>) -> bool {
    development && switch == Some("1")
}

fn host_script() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../packages/plugin-base/src/host/main.mjs")
}

fn window_origins(dev_url: Option<&str>) -> Vec<String> {
    let mut origins: Vec<String> = RELEASE_ORIGINS.iter().map(|origin| (*origin).to_owned()).collect();
    if let Some(url) = dev_url.and_then(|url| url.split_once("://").map(|(scheme, rest)| format!("{scheme}://{}", rest.split('/').next().unwrap_or(rest)))) {
        origins.push(url);
    }
    origins
}

const SAFE_SWITCH: &str = "FUYU_PLUGINS_V3_SAFE";
const SAFE_MODES: [&str; 2] = ["third-party", "minimal"];

#[derive(Debug, Clone, Default, PartialEq)]
struct HostMode {
    development: bool,
    safe: Option<String>,
}

impl HostMode {
    fn from(development: bool, safe: Option<&str>) -> Self {
        let safe = safe.map(str::trim).filter(|mode| SAFE_MODES.contains(mode)).map(str::to_owned);
        Self { development, safe }
    }
}

fn host_args(dir: PathBuf, origins: &[String], mode: &HostMode) -> Vec<std::ffi::OsString> {
    let mut args: Vec<std::ffi::OsString> = vec!["--disallow-code-generation-from-strings".into()];
    if mode.development {
        args.push("--expose-internals".into());
    }
    args.extend([host_script().into(), "--dir".into(), dir.into(), "--watch".into()]);
    if mode.development {
        args.push("--dev".into());
    }
    if let Some(safe) = &mode.safe {
        args.push("--safe".into());
        args.push(safe.into());
    }
    for origin in origins {
        args.push("--origin".into());
        args.push(origin.into());
    }
    args
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
    let download = official_download(crate::system::updater::get_updater_proxy());
    let chosen = node_for_host(&NodeSearch::from_env(), MINIMUM_NODE, data_dir, download, &mut progress_reporter())?;
    let source = match chosen.source {
        NodeSource::System => "found on this computer",
        NodeSource::Downloaded => "downloaded by Fuyu",
    };
    eprintln!("[plugins-v3] using Node {} ({source}) at {}", chosen.version, chosen.path.display());
    Ok(chosen)
}

fn start(home: PathBuf, dir: PathBuf, origins: Vec<String>, mode: HostMode) -> Result<(), String> {
    let node = choose_node(&home)?;
    if let Some(safe) = &mode.safe {
        eprintln!("[plugins-v3] safe mode: {safe}");
    }
    let spec = HostSpec { program: node.path, args: host_args(dir, &origins, &mode), env: Vec::new(), current_dir: None };
    let supervisor = Supervisor::start(spec, containment::shared(), Timing::default(), report)?;
    let mut slot = SUPERVISOR.get_or_init(Mutex::default).lock().map_err(|_| "the plugin host lock is poisoned".to_string())?;
    if STOPPING.load(std::sync::atomic::Ordering::SeqCst) {
        drop(slot);
        supervisor.stop();
        return Ok(());
    }
    *slot = Some(supervisor);
    Ok(())
}

pub(crate) fn init(app: &AppHandle) -> Result<(), String> {
    if !enabled(cfg!(debug_assertions), std::env::var(SWITCH).ok().as_deref()) {
        return Ok(());
    }
    let home = crate::home_dir::fuyu_home(tauri::Manager::path(app)).map_err(|error| error.to_string())?;
    let dir = plugins_dir(app)?;
    let _ = PLUGINS_DIR.set(dir.clone());
    let _ = SUPERVISOR.get_or_init(Mutex::default);
    let dev_url = app.config().build.dev_url.as_ref().map(ToString::to_string);
    let origins = window_origins(dev_url.as_deref());
    let mode = HostMode::from(cfg!(debug_assertions), std::env::var(SAFE_SWITCH).ok().as_deref());
    std::thread::Builder::new()
        .name("plugin-host-start".into())
        .spawn(move || {
            if let Err(error) = start(home, dir, origins, mode) {
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
}

fn connection_from(enabled: bool, state: Option<&HostState>) -> HostConnection {
    match state {
        None => HostConnection { enabled, ..HostConnection::default() },
        Some(HostState::Ready { generation, ready, .. }) => HostConnection {
            enabled: true,
            port: ready["windows"]["port"].as_u64(),
            token: ready["windows"]["token"].as_str().map(str::to_owned),
            generation: Some(*generation),
        },
        Some(_) => HostConnection { enabled: true, ..HostConnection::default() },
    }
}

fn connection_now(switched_on: bool, slot: Option<&Mutex<Option<Supervisor>>>) -> HostConnection {
    let Some(slot) = slot else { return connection_from(switched_on, None) };
    let state = slot.lock().ok().and_then(|supervisor| supervisor.as_ref().map(Supervisor::state));
    connection_from(true, state.as_ref())
}

#[tauri::command]
pub(crate) fn get_plugin_host_connection() -> HostConnection {
    connection_now(enabled(cfg!(debug_assertions), std::env::var(SWITCH).ok().as_deref()), SUPERVISOR.get())
}

pub(crate) fn respond(request: &tauri::http::Request<Vec<u8>>) -> tauri::http::Response<Vec<u8>> {
    protocol::respond(PLUGINS_DIR.get().map(PathBuf::as_path), request)
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::plugin_kernel::get_plugin_host_connection,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

pub(crate) fn shutdown() {
    STOPPING.store(true, std::sync::atomic::Ordering::SeqCst);
    let supervisor = SUPERVISOR.get().and_then(|slot| slot.lock().ok()?.take());
    if let Some(supervisor) = supervisor {
        supervisor.stop();
    }
}

#[cfg(test)]
mod tests;
