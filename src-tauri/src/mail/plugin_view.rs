use serde_json::{json, Value};

use super::{accounts, MailMessage, MailSnapshot};

fn entry(item: &MailMessage) -> Value {
    json!({
        "source": "qqMail",
        "id": item.id,
        "sender": item.sender,
        "preview": item.subject,
        "receivedAt": item.received_at,
        "unread": item.unread,
    })
}

pub(crate) fn plugin_messages() -> Vec<Value> {
    accounts::all()
        .iter()
        .filter_map(|service| {
            let state = service.lock().ok()?;
            (state.snapshot.enabled && state.snapshot.configured)
                .then(|| state.snapshot.items.iter().map(entry).collect::<Vec<_>>())
        })
        .flatten()
        .collect()
}

pub(super) fn publish_received(snapshot: &MailSnapshot, newest_id: Option<&str>) {
    let Some(item) = newest_id.and_then(|id| snapshot.items.iter().find(|item| item.id == id)) else { return };
    if snapshot.enabled {
        crate::plugin_host::publish_event("messages.received", entry(item));
    }
}
