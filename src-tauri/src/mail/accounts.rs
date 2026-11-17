use crate::user_error::UserError;
use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc, Arc, Mutex, MutexGuard, PoisonError,
    },
    thread::{self, JoinHandle},
};
use tauri::AppHandle;

use serde_json::{Map, Value};

use crate::messages_plugin::{MAIL, PLUGIN_ID};
use crate::plugin_kernel::builtins::{self, Background};

use super::service::{MailService, MailState, Work};
use super::supervisor::supervise;

pub(super) const MAX_ACCOUNTS: usize = 5;

static SERVICES: Mutex<BTreeMap<String, Arc<MailService>>> = Mutex::new(BTreeMap::new());
static THREADS: Mutex<Vec<JoinHandle<()>>> = Mutex::new(Vec::new());
static REVISION: AtomicU64 = AtomicU64::new(0);

pub(super) fn init() {
    crate::messages_plugin::register(MAIL, Accounts);
}

struct Accounts;

impl Background for Accounts {
    fn start(&self) -> Result<(), String> {
        Ok(())
    }

    fn stop(&self) {
        stop_all();
    }

    fn running(&self) -> bool {
        threads().iter().any(|handle| !handle.is_finished())
    }

    fn configure(&self, config: &Map<String, Value>) {
        if switched_off(config) {
            stop_all();
        }
    }
}

fn switched_off(config: &Map<String, Value>) -> bool {
    matches!(config.get(MAIL), Some(Value::Bool(false)))
}

fn threads() -> MutexGuard<'static, Vec<JoinHandle<()>>> {
    THREADS.lock().unwrap_or_else(PoisonError::into_inner)
}

pub(super) fn stop_all() {
    let stopped: Vec<_> = std::mem::take(&mut *services()).into_values().collect();
    for service in stopped {
        let _ = service.send(Work::Stop);
    }
    threads().retain(|handle| !handle.is_finished());
}

pub(super) fn next_revision() -> u64 {
    REVISION.fetch_add(1, Ordering::SeqCst) + 1
}

fn services() -> MutexGuard<'static, BTreeMap<String, Arc<MailService>>> {
    SERVICES.lock().unwrap_or_else(PoisonError::into_inner)
}

pub(super) fn all() -> Vec<Arc<MailService>> {
    services().values().cloned().collect()
}

pub(super) fn find(email: &str) -> Result<Arc<MailService>, UserError> {
    services()
        .get(email)
        .cloned()
        .ok_or_else(|| UserError::new("mail.connectThis", "Connect this mailbox first."))
}

pub(super) fn find_or_start(app: &AppHandle, email: &str, host: &str) -> Result<Arc<MailService>, UserError> {
    let mut services = services();
    if let Some(service) = services.get(email) {
        if service.is_alive() {
            service.set_host(host);
            return Ok(service.clone());
        }
        services.remove(email);
    }
    if !builtins::is_enabled(PLUGIN_ID) || switched_off(&builtins::config(PLUGIN_ID)) {
        return Err(UserError::new("mail.off", "Mail is off. Turn on Messages in Plugins, then Mail in its settings."));
    }
    if services.len() >= MAX_ACCOUNTS {
        return Err(UserError::new("mail.tooMany", format!("At most {MAX_ACCOUNTS} mailboxes at once; disconnect one first.")).arg("max", MAX_ACCOUNTS));
    }
    let (sender, receiver) = mpsc::channel();
    let mut state = MailState::default();
    state.snapshot.email = Some(email.to_string());
    let service = Arc::new(MailService {
        app: app.clone(),
        email: email.to_string(),
        host: Mutex::new(host.to_string()),
        state: Mutex::new(state),
        sender,
        idle_socket: Mutex::new(None),
    });
    let worker_service = service.clone();
    let handle = thread::Builder::new()
        .name("qq-mail".into())
        .spawn(move || supervise(worker_service, receiver, is_registered))
        .map_err(|_| UserError::new("mail.start", "Could not start the mail service."))?;
    let mut threads = threads();
    threads.retain(|handle| !handle.is_finished());
    threads.push(handle);
    drop(threads);
    services.insert(email.to_string(), service.clone());
    Ok(service)
}

fn is_registered(service: &Arc<MailService>) -> bool {
    services()
        .get(&service.email)
        .is_some_and(|current| Arc::ptr_eq(current, service))
}

pub(super) fn remove(email: &str) {
    if let Some(service) = services().remove(email) {
        let _ = service.send(Work::Stop);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_an_explicit_off_stops_mail() {
        let config = |value: Option<Value>| value.map(|value| Map::from_iter([(MAIL.to_string(), value)])).unwrap_or_default();
        assert!(switched_off(&config(Some(Value::Bool(false)))));
        assert!(!switched_off(&config(Some(Value::Bool(true)))));
        assert!(!switched_off(&config(None)));
        assert!(!switched_off(&config(Some(Value::String("false".into())))));
    }
}
