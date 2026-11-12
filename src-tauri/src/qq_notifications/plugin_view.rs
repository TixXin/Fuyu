use serde_json::{json, Value};

use super::{service, NotificationSnapshot, QQNotification};

fn entry(item: &QQNotification) -> Value {
    json!({
        "source": "qq",
        "id": item.id,
        "sender": item.title,
        "preview": item.body,
        "receivedAt": item.created_at,
    })
}

pub(crate) fn plugin_messages() -> Vec<Value> {
    let Ok(service) = service() else { return Vec::new() };
    let Ok(state) = service.state.lock() else { return Vec::new() };
    if !state.snapshot.enabled {
        return Vec::new();
    }
    state.snapshot.items.iter().map(entry).collect()
}

pub(super) fn publish_received(snapshot: &NotificationSnapshot, newest_id: Option<&str>) {
    let Some(item) = newest_id.and_then(|id| snapshot.items.iter().find(|item| item.id == id)) else { return };
    if snapshot.enabled {
        crate::plugin_host::publish_event("messages.received", entry(item));
    }
}
