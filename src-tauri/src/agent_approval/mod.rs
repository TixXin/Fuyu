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
    if let (Ok(agent_dir), Ok(home_dir)) = (crate::home_dir::agent_home(app.path()), crate::system::windows_home_dir()) {
        opencode::watch(agent_dir, home_dir);
    }
    let stays_quiet = crate::dev_lane::lane().is_none() && crate::coexist::yielding();
    let own = if stays_quiet { None } else { Some(server::serve(&shared, saved.port, true, &saved.token)?) };
    if let Some(port) = own.as_ref().map(server::Listener::port).filter(|port| *port != saved.port) {
        saved.port = port;
        changed = true;
    }
    if changed {
        config::save_config(&path, &saved)?;
    }
    let _ = SERVICE.set(Service {
        shared,
        port: AtomicU16::new(saved.port),
        token: saved.token,
        path,
        own: Mutex::new(own),
        borrowed: Mutex::new(None),
    });
    Ok(())
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
    if listener.port() != port {
        service.port.store(listener.port(), Ordering::SeqCst);
        let moved = config::ApprovalConfig { port: listener.port(), token: service.token.clone() };
        if let Err(error) = config::save_config(&service.path, &moved) {
            eprintln!("{error}");
        }
    }
    *own = Some(listener);
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
    if borrowed.is_some() {
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

pub(crate) fn remote_hook_token(host: &str) -> Option<String> {
    SERVICE.get().map(|service| config::remote_token(&service.token, host))
}

pub(crate) fn hook_url(agent: Agent) -> Option<String> {
    endpoint().map(|endpoint| format!("http://127.0.0.1:{}{}", endpoint.port, agent.path()))
}

pub(crate) fn question_hook_url() -> Option<String> {
    endpoint().map(|endpoint| format!("http://127.0.0.1:{}{}", endpoint.port, decision::QUESTION_PATH))
}

pub(crate) fn activity_hook_url() -> Option<String> {
    endpoint().map(|endpoint| format!("http://127.0.0.1:{}{}", endpoint.port, decision::ACTIVITY_PATH))
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
