pub(crate) mod background;
mod config;
mod decision;
mod external;
mod http;
mod opencode;
mod queue;
mod server;
#[cfg(test)]
mod tests;
mod waiting;

use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicU16, Ordering},
        Arc, Mutex, OnceLock, PoisonError,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};

pub(crate) use decision::Agent;
pub(crate) use opencode::{service_state as opencode_service_state, ServiceState as OpencodeService};
use decision::{Answers, Decision};
pub(crate) use queue::ApprovalRequest;
use queue::{CloseReason, Outcome};
use server::{ApprovalEvent, Shared};

const REQUESTED_EVENT: &str = "agent-approval-requested";
const CLOSED_EVENT: &str = "agent-approval-closed";
const WAIT_LIMIT: Duration = Duration::from_secs(120);
const RESUME_TRIES: u32 = 25;
const RESUME_PAUSE: Duration = Duration::from_millis(200);

struct Service {
    shared: Arc<Shared>,
    port: AtomicU16,
    token: String,
    path: PathBuf,
    own: Mutex<Option<server::Listener>>,
    borrowed: Mutex<Option<server::Listener>>,
}

static SERVICE: OnceLock<Service> = OnceLock::new();

#[cfg_attr(test, derive(Debug, PartialEq))]
pub(crate) struct ApprovalEndpoint {
    pub port: u16,
    pub token: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ClosedPayload {
    id: u64,
    reason: CloseReason,
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let path = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?
        .join(config::CONFIG_FILE_NAME);
    let (mut saved, mut changed) = config::load_config(&path)?;
    let own_port = crate::dev_lane::port(saved.port, config::PREFERRED_PORT);
    if own_port != saved.port {
        saved.port = own_port;
        changed = true;
    }
    let emitter = app.clone();
    let app_dir = path.parent().map(PathBuf::from);
    let notify: server::Notify = Arc::new(move |event| {
        let _ = match event {
            ApprovalEvent::Requested(request) => {
                if let Some(dir) = &app_dir {
                    waiting::note(dir, &request);
                }
                emitter.emit(REQUESTED_EVENT, request)
            }
            ApprovalEvent::Closed { id, reason } => {
                if let Some(dir) = &app_dir {
                    waiting::clear(dir, id);
                }
                emitter.emit(CLOSED_EVENT, ClosedPayload { id, reason })
            }
        };
    });
    let shared = server::new_shared(WAIT_LIMIT, notify);
    let opencode = match (crate::home_dir::agent_home(app.path()), crate::system::windows_home_dir()) {
        (Ok(agent_dir), Ok(home_dir)) => Some(opencode::worker(agent_dir, home_dir)),
        _ => None,
    };
    if changed {
        config::save_config(&path, &saved)?;
    }
    let _ = SERVICE.set(Service {
        shared,
        port: AtomicU16::new(saved.port),
        token: saved.token,
        path,
        own: Mutex::new(None),
        borrowed: Mutex::new(None),
    });
    background::register(opencode);
    Ok(())
}

fn switched_on() -> bool {
    crate::plugin_kernel::builtins::is_enabled(crate::agent_status::PLUGIN_ID)
}

fn stays_quiet() -> bool {
    crate::dev_lane::lane().is_none() && crate::coexist::yielding()
}

fn listen_on(service: &Service, listener: server::Listener) -> server::Listener {
    if listener.port() != service.port.load(Ordering::SeqCst) {
        service.port.store(listener.port(), Ordering::SeqCst);
        let moved = config::ApprovalConfig { port: listener.port(), token: service.token.clone() };
        if let Err(error) = config::save_config(&service.path, &moved) {
            eprintln!("{error}");
        }
    }
    listener
}

fn start_serving() -> Result<(), String> {
    let service = service()?;
    service.shared.reopen();
    if stays_quiet() {
        return Ok(());
    }
    let mut own = service.own.lock().unwrap_or_else(PoisonError::into_inner);
    if own.is_none() {
        let listener = server::serve(&service.shared, service.port.load(Ordering::SeqCst), true, &service.token)?;
        *own = Some(listen_on(service, listener));
    }
    Ok(())
}

fn stop_serving() {
    let Some(service) = SERVICE.get() else { return };
    service.shared.shut_down();
    let own = service.own.lock().unwrap_or_else(PoisonError::into_inner).take();
    let borrowed = service.borrowed.lock().unwrap_or_else(PoisonError::into_inner).take();
    for listener in own.into_iter().chain(borrowed) {
        listener.stop();
    }
}

fn serving() -> bool {
    SERVICE.get().is_some_and(|service| {
        service.own.lock().unwrap_or_else(PoisonError::into_inner).is_some() || service.borrowed.lock().unwrap_or_else(PoisonError::into_inner).is_some()
    })
}

#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) fn pause() {
    let Some(service) = SERVICE.get() else { return };
    let listener = service.own.lock().unwrap_or_else(PoisonError::into_inner).take();
    if let Some(listener) = listener {
        listener.stop();
    }
}

#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) fn resume() {
    let Some(service) = SERVICE.get() else { return };
    if !switched_on() {
        return;
    }
    let mut own = service.own.lock().unwrap_or_else(PoisonError::into_inner);
    if own.is_some() {
        return;
    }
    let port = service.port.load(Ordering::SeqCst);
    let listener = (0..RESUME_TRIES)
        .find_map(|attempt| {
            if attempt > 0 {
                std::thread::sleep(RESUME_PAUSE);
            }
            server::serve(&service.shared, port, false, &service.token).ok()
        })
        .or_else(|| server::serve(&service.shared, port, true, &service.token).ok());
    let Some(listener) = listener else {
        eprintln!("could not start the agent approval endpoint again");
        return;
    };
    *own = Some(listen_on(service, listener));
}

#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) fn serve_for_release(wanted: bool) {
    let Some(service) = SERVICE.get() else { return };
    let mut borrowed = service.borrowed.lock().unwrap_or_else(PoisonError::into_inner);
    if !wanted {
        if let Some(listener) = borrowed.take() {
            listener.stop();
        }
        return;
    }
    if borrowed.is_some() || !switched_on() {
        return;
    }
    let Some(real) = crate::home_dir::real_home().and_then(|home| config::read_config(&home.join(config::CONFIG_FILE_NAME))) else {
        return;
    };
    if let Ok(listener) = server::serve(&service.shared, real.port, false, &real.token) {
        *borrowed = Some(listener);
    }
}

pub fn shutdown() {
    if let Some(service) = SERVICE.get() {
        service.shared.shut_down();
    }
}

pub(crate) fn endpoint() -> Option<ApprovalEndpoint> {
    SERVICE.get().map(|service| ApprovalEndpoint { port: service.port.load(Ordering::SeqCst), token: service.token.clone() })
}

fn hook_endpoint() -> Option<ApprovalEndpoint> {
    let release = || crate::home_dir::real_home().and_then(|home| config::read_config(&home.join(config::CONFIG_FILE_NAME)));
    endpoint_for_hooks(endpoint(), crate::dev_lane::lane().is_some(), release)
}

fn endpoint_for_hooks(own: Option<ApprovalEndpoint>, development: bool, release: impl FnOnce() -> Option<config::ApprovalConfig>) -> Option<ApprovalEndpoint> {
    let own = own?;
    if !development {
        return Some(own);
    }
    release().map(|config| ApprovalEndpoint { port: config.port, token: config.token })
}

pub(crate) fn hook_endpoint_unknown() -> bool {
    endpoint().is_some() && hook_endpoint().is_none()
}

pub(crate) fn hook_token() -> Option<String> {
    hook_endpoint().map(|endpoint| endpoint.token)
}

pub(crate) fn remote_hook_token(host: &str) -> Option<String> {
    SERVICE.get().map(|service| config::remote_token(&service.token, host))
}

pub(crate) fn hook_url(agent: Agent) -> Option<String> {
    hook_endpoint().map(|endpoint| format!("http://127.0.0.1:{}{}", endpoint.port, agent.path()))
}

pub(crate) fn question_hook_url() -> Option<String> {
    hook_endpoint().map(|endpoint| format!("http://127.0.0.1:{}{}", endpoint.port, decision::QUESTION_PATH))
}

pub(crate) fn activity_hook_url() -> Option<String> {
    hook_endpoint().map(|endpoint| format!("http://127.0.0.1:{}{}", endpoint.port, decision::ACTIVITY_PATH))
}

fn service() -> Result<&'static Service, String> {
    SERVICE.get().ok_or_else(|| "The approval endpoint is not running.".to_string())
}

#[tauri::command]
pub fn set_agent_approval_enabled(enabled: bool) -> Result<(), String> {
    service()?.shared.set_enabled(enabled);
    Ok(())
}

#[tauri::command]
pub fn agent_approval_decide(
    id: u64,
    decision: Decision,
    message: Option<String>,
    answers: Option<Answers>,
) -> Result<(), String> {
    service()?.shared.decide(id, Outcome { decision, message, answers })
}

#[tauri::command]
pub fn agent_approval_pending() -> Result<Vec<ApprovalRequest>, String> {
    Ok(service()?.shared.pending())
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::agent_approval::set_agent_approval_enabled,
            crate::agent_approval::agent_approval_decide,
            crate::agent_approval::agent_approval_pending,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
