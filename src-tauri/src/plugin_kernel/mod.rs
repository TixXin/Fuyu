mod containment;
pub(crate) mod protocol;

use std::{path::PathBuf, sync::Mutex, sync::OnceLock};

use plugin_base::{find_node, node::describe_failure, Event, HostSpec, HostState, NodeSearch, Supervisor, Timing, MINIMUM_NODE};
use serde::Serialize;
use tauri::AppHandle;

const SWITCH: &str = "FUYU_PLUGINS_V3";
const CONFIG: &str = "plugins.yml";
const RELEASE_ORIGINS: [&str; 3] = ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"];

static SUPERVISOR: OnceLock<Mutex<Option<Supervisor>>> = OnceLock::new();
static PLUGINS_DIR: OnceLock<PathBuf> = OnceLock::new();

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

fn host_args(dir: PathBuf, origins: &[String]) -> Vec<std::ffi::OsString> {
    let mut args: Vec<std::ffi::OsString> = vec!["--disallow-code-generation-from-strings".into(), host_script().into(), "--dir".into(), dir.into(), "--watch".into()];
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

pub(crate) fn init(app: &AppHandle) -> Result<(), String> {
    if !enabled(cfg!(debug_assertions), std::env::var(SWITCH).ok().as_deref()) {
        return Ok(());
    }
    let node = find_node(&NodeSearch::from_env(), MINIMUM_NODE).map_err(|tried| describe_failure(&tried, MINIMUM_NODE))?;
    eprintln!("[plugins-v3] using Node {} at {}", node.version, node.path.display());
    let dir = plugins_dir(app)?;
    let _ = PLUGINS_DIR.set(dir.clone());
    let dev_url = app.config().build.dev_url.as_ref().map(ToString::to_string);
    let spec = HostSpec { program: node.path, args: host_args(dir, &window_origins(dev_url.as_deref())), env: Vec::new(), current_dir: None };
    let supervisor = Supervisor::start(spec, containment::shared(), Timing::default(), report)?;
    *SUPERVISOR.get_or_init(Mutex::default).lock().map_err(|_| "the plugin host lock is poisoned".to_string())? = Some(supervisor);
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

fn connection_from(state: Option<&HostState>) -> HostConnection {
    match state {
        None => HostConnection::default(),
        Some(HostState::Ready { generation, ready, .. }) => HostConnection {
            enabled: true,
            port: ready["windows"]["port"].as_u64(),
            token: ready["windows"]["token"].as_str().map(str::to_owned),
            generation: Some(*generation),
        },
        Some(_) => HostConnection { enabled: true, ..HostConnection::default() },
    }
}

#[tauri::command]
pub(crate) fn get_plugin_host_connection() -> HostConnection {
    let state = SUPERVISOR.get().and_then(|slot| slot.lock().ok().and_then(|supervisor| supervisor.as_ref().map(Supervisor::state)));
    connection_from(state.as_ref())
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
    let supervisor = SUPERVISOR.get().and_then(|slot| slot.lock().ok()?.take());
    if let Some(supervisor) = supervisor {
        supervisor.stop();
    }
}

#[cfg(test)]
mod tests;
