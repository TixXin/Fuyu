mod config;
mod decision;
mod http;
mod queue;
mod server;
#[cfg(test)]
mod tests;

use std::{
    sync::{Arc, OnceLock},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};

pub(crate) use decision::Agent;
use decision::{Answers, Decision};
pub(crate) use queue::ApprovalRequest;
use queue::{CloseReason, Outcome};
use server::{ApprovalEvent, Shared};

const REQUESTED_EVENT: &str = "agent-approval-requested";
const CLOSED_EVENT: &str = "agent-approval-closed";
const WAIT_LIMIT: Duration = Duration::from_secs(120);

struct Service {
    shared: Arc<Shared>,
    port: u16,
    token: String,
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
    let emitter = app.clone();
    let notify: server::Notify = Arc::new(move |event| {
        let _ = match event {
            ApprovalEvent::Requested(request) => emitter.emit(REQUESTED_EVENT, request),
            ApprovalEvent::Closed { id, reason } => emitter.emit(CLOSED_EVENT, ClosedPayload { id, reason }),
        };
    });
    let (shared, port) = server::listen(saved.port, saved.token.clone(), WAIT_LIMIT, notify)?;
    if port != saved.port {
        saved.port = port;
        changed = true;
    }
    if changed {
        config::save_config(&path, &saved)?;
    }
    let _ = SERVICE.set(Service { shared, port, token: saved.token });
    Ok(())
}

pub fn shutdown() {
    if let Some(service) = SERVICE.get() {
        service.shared.shut_down();
    }
}

pub(crate) fn endpoint() -> Option<ApprovalEndpoint> {
    SERVICE.get().map(|service| ApprovalEndpoint { port: service.port, token: service.token.clone() })
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
