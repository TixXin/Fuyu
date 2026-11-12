mod config;
mod local_proxy;
#[cfg(test)]
mod tests;
mod tunnel;

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{mpsc, Arc, Mutex, MutexGuard, OnceLock, PoisonError},
    thread,
    time::Duration,
};

use serde::Serialize;
use serde_json::{Map, Value};
use tauri::{AppHandle, Manager};

use crate::agent_status::{remote_fetch::run_ssh, remote_hosts};
use local_proxy::{Choice, LocalProxy};
use tunnel::{Spec, Status};

const WATCH_EVERY: Duration = Duration::from_secs(15);

static APP_DIR: OnceLock<PathBuf> = OnceLock::new();

struct Tunnel {
    spec: Spec,
    status: Arc<Mutex<Status>>,
    _stop: mpsc::Sender<()>,
}

#[derive(Default)]
struct State {
    choice: Option<Choice>,
    proxy: Option<LocalProxy>,
    watcher: Option<mpsc::Sender<()>>,
    tunnels: HashMap<String, Tunnel>,
}

fn state() -> MutexGuard<'static, State> {
    static STATE: OnceLock<Mutex<State>> = OnceLock::new();
    STATE.get_or_init(Mutex::default).lock().unwrap_or_else(PoisonError::into_inner)
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let dir = crate::home_dir::fuyu_home(app.path()).map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let _ = APP_DIR.set(dir);
    Ok(())
}

fn app_dir() -> Result<PathBuf, String> {
    APP_DIR.get().cloned().ok_or_else(|| "The SSH proxy tunnel is not set up yet".to_string())
}

pub(crate) fn start(settings: &Map<String, Value>) -> Result<(), String> {
    let choice = local_proxy::choice(settings)?;
    let mut state = state();
    state.choice = Some(choice);
    if let Some(watcher) = &state.watcher {
        let _ = watcher.send(());
        return Ok(());
    }
    let (watcher, woken) = mpsc::channel();
    thread::Builder::new()
        .name("ssh-tunnel-proxy".into())
        .spawn(move || watch_proxy(&woken))
        .map_err(|error| format!("Could not start looking for the local proxy: {error}"))?;
    state.watcher = Some(watcher);
    Ok(())
}

pub(crate) fn stop() {
    let mut state = state();
    state.choice = None;
    state.proxy = None;
    state.watcher = None;
    state.tunnels.clear();
}

fn watch_proxy(woken: &mpsc::Receiver<()>) {
    loop {
        let (choice, current) = {
            let state = state();
            (state.choice, state.proxy)
        };
        let Some(choice) = choice else { return };
        let found = local_proxy::find(choice, current);
        {
            let mut state = state();
            if state.choice == Some(choice) {
                let moved = state.proxy.map(|proxy| proxy.port) != Some(found.port);
                state.proxy = Some(found);
                if moved {
                    let _ = apply(&mut state);
                }
            }
        }
        if matches!(woken.recv_timeout(WATCH_EVERY), Err(mpsc::RecvTimeoutError::Disconnected)) {
            return;
        }
    }
}

fn apply(state: &mut State) -> Result<(), String> {
    let app_dir = app_dir()?;
    let wanted: Vec<Spec> = match state.proxy {
        Some(LocalProxy { port: local_port, .. }) => config::read(&app_dir)
            .into_iter()
            .filter(|saved| saved.enabled)
            .map(|saved| Spec {
                target: remote_hosts::target(&app_dir, &saved.host),
                host: saved.host,
                remote_port: saved.remote_port,
                local_port,
            })
            .collect(),
        None => Vec::new(),
    };
    state.tunnels.retain(|_, tunnel| wanted.contains(&tunnel.spec));
    for spec in wanted {
        if state.tunnels.contains_key(&spec.host) {
            continue;
        }
        let (stop, stopped) = mpsc::channel();
        let status = Arc::new(Mutex::new(Status::Connecting));
        let (dir, thread_spec, thread_status) = (app_dir.clone(), spec.clone(), Arc::clone(&status));
        thread::Builder::new()
            .name(format!("ssh-tunnel-{}", spec.host))
            .spawn(move || tunnel::supervise(&dir, &thread_spec, &thread_status, &stopped))
            .map_err(|error| format!("Could not start the tunnel to {}: {error}", spec.host))?;
        state.tunnels.insert(spec.host.clone(), Tunnel { spec, status, _stop: stop });
    }
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TunnelHost {
    host: String,
    enabled: bool,
    remote_port: Option<u16>,
    state: &'static str,
    error: Option<String>,
}

fn listing() -> Result<Vec<TunnelHost>, String> {
    let app_dir = app_dir()?;
    let saved = config::read(&app_dir);
    let ssh_config = crate::system::windows_home_dir()
        .ok()
        .and_then(|home| std::fs::read_to_string(home.join(".ssh").join("config")).ok())
        .unwrap_or_default();
    let found = remote_hosts::ssh_config_hosts(&ssh_config)
        .into_iter()
        .chain(remote_hosts::custom(&app_dir).into_iter().map(|custom| custom.name))
        .chain(saved.iter().map(|tunnel| tunnel.host.clone()));
    let mut names: Vec<String> = Vec::new();
    for name in found {
        if !names.contains(&name) {
            names.push(name);
        }
    }
    let state = state();
    Ok(names
        .into_iter()
        .map(|host| {
            let saved = saved.iter().find(|tunnel| tunnel.host == host);
            let status = state.tunnels.get(&host).map(|tunnel| tunnel.status.lock().unwrap_or_else(PoisonError::into_inner).clone());
            let (state, error) = match status {
                None => ("off", None),
                Some(Status::Connecting) => ("connecting", None),
                Some(Status::Connected) => ("connected", None),
                Some(Status::PortInUse) => ("portInUse", None),
                Some(Status::Failed(error)) => ("error", Some(error)),
            };
            TunnelHost { enabled: saved.is_some_and(|tunnel| tunnel.enabled), remote_port: saved.map(|tunnel| tunnel.remote_port), host, state, error }
        })
        .collect())
}

#[tauri::command]
pub async fn get_ssh_tunnels() -> Result<Vec<TunnelHost>, String> {
    listing()
}

#[tauri::command]
pub async fn set_ssh_tunnel(host: String, enabled: bool, remote_port: Option<u16>) -> Result<Vec<TunnelHost>, String> {
    config::set(&app_dir()?, &host, enabled, remote_port)?;
    apply(&mut state())?;
    listing()
}

#[tauri::command]
pub async fn get_ssh_tunnel_proxy() -> Result<Option<LocalProxy>, String> {
    Ok(state().proxy)
}

#[tauri::command]
pub async fn check_ssh_tunnel_port(host: String, remote_port: u16) -> Result<bool, String> {
    if !remote_hosts::is_valid_alias(&host) {
        return Err(format!("\"{host}\" is not an SSH host name"));
    }
    if remote_port < config::MIN_REMOTE_PORT {
        return Err(format!("The port on the server must be {}–65535", config::MIN_REMOTE_PORT));
    }
    let target = remote_hosts::target(&app_dir()?, &host);
    tauri::async_runtime::spawn_blocking(move || {
        let output = run_ssh(&target, tunnel::PORT_CHECK_SCRIPT)?;
        tunnel::port_listening(&String::from_utf8_lossy(&output), remote_port)
    })
    .await
    .map_err(|error| format!("The port check failed: {error}"))?
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::ssh_tunnel::get_ssh_tunnels,
            crate::ssh_tunnel::get_ssh_tunnel_proxy,
            crate::ssh_tunnel::set_ssh_tunnel,
            crate::ssh_tunnel::check_ssh_tunnel_port,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
