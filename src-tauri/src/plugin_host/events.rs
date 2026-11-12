use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    sync::{Mutex, OnceLock},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Listener};

use super::{host, lifecycle, lock, sensitive};

const HOST_EVENT: &str = "plugin-host-event";
const COALESCE: Duration = Duration::from_millis(200);
pub(super) const MAX_SUBSCRIBE: usize = 16;

pub(super) const EVENTS: [(&str, Option<&str>); 16] = [
    ("todos.changed", Some("todos:read")),
    ("note.changed", Some("notes:read")),
    ("agentStatus.changed", Some("agent-status:read")),
    ("island.expanded", None),
    ("island.collapsed", None),
    ("app.locale.changed", None),
    ("clipboard.changed", Some("clipboard:read")),
    ("messages.received", Some("messages:read")),
    ("media.changed", Some("media:read")),
    ("shelf.changed", Some("shelf:read")),
    ("system.locked", None),
    ("system.unlocked", None),
    ("system.suspended", None),
    ("system.resumed", None),
    ("system.idle", None),
    ("system.active", None),
];

pub(super) fn event_permission(name: &str) -> Option<(&'static str, Option<&'static str>)> {
    EVENTS.iter().copied().find(|(event, _)| *event == name)
}

const QUEUED_EVENTS: [&str; 1] = ["messages.received"];
const MAX_QUEUED: usize = 50;

fn pending() -> &'static Mutex<HashMap<&'static str, Vec<Value>>> {
    static PENDING: OnceLock<Mutex<HashMap<&'static str, Vec<Value>>>> = OnceLock::new();
    PENDING.get_or_init(Mutex::default)
}

pub(super) fn add_pending(waiting: &mut HashMap<&'static str, Vec<Value>>, name: &'static str, payload: Value) -> bool {
    let list = waiting.entry(name).or_default();
    let first = list.is_empty();
    if QUEUED_EVENTS.contains(&name) {
        if list.len() >= MAX_QUEUED {
            list.remove(0);
        }
        list.push(payload);
    } else {
        *list = vec![payload];
    }
    first
}

pub(super) fn listen(app: &AppHandle) {
    app.listen(HOST_EVENT, |event| {
        let Ok(message) = serde_json::from_str::<Value>(event.payload()) else { return };
        let Some((name, _)) = message.get("name").and_then(Value::as_str).and_then(event_permission) else { return };
        let payload = message.get("payload").cloned().unwrap_or(Value::Object(Default::default()));
        publish(name, payload);
    });
}

pub(super) fn anyone_subscribed(name: &str) -> bool {
    host().is_ok_and(|host| lock(&host.supervisors).values().any(|supervisor| supervisor.is_subscribed(name)))
}

pub(super) fn publish_known(name: &str, payload: Value) {
    if let Some((name, _)) = event_permission(name) {
        publish(name, payload);
    }
}

fn publish(name: &'static str, payload: Value) {
    if !add_pending(&mut lock(pending()), name, payload) {
        return;
    }
    let spawned = thread::Builder::new().name("plugin-event".into()).spawn(move || {
        thread::sleep(COALESCE);
        let payloads = lock(pending()).remove(name).unwrap_or_default();
        for payload in &payloads {
            deliver(name, payload);
        }
    });
    if spawned.is_err() {
        lock(pending()).remove(name);
    }
}

fn deliver(name: &'static str, payload: &Value) {
    let Ok(host) = host() else { return };
    let refused: HashSet<String> = match event_permission(name).and_then(|(_, permission)| permission) {
        Some(permission) if sensitive::is_sensitive(permission) => {
            let running: Vec<String> = lock(&host.supervisors).keys().cloned().collect();
            running.into_iter().filter(|id| !sensitive::allowed_now(id, permission)).collect()
        }
        _ => HashSet::new(),
    };
    for supervisor in lock(&host.supervisors).values() {
        if !refused.contains(supervisor.plugin_id()) {
            supervisor.deliver_event(name, payload);
        }
    }
    lifecycle::wake_for_event(name, payload);
}
