use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::adapter_macos::{self as adapter, Change};
use super::state::current_unix_millis;

pub(crate) const MEDIA_SESSION_CHANGED_EVENT: &str = "media-session-changed";
const MEDIA_CHANGED_HOST_EVENT: &str = "media.changed";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionChange {
    kind: &'static str,
    at: i64,
    session_id: Option<String>,
}

pub(super) fn start(app: &AppHandle) -> Result<(), String> {
    let events = app.clone();
    adapter::start(app, move |change| {
        let kind = match change {
            Change::Track => "track",
            Change::Playback | Change::Artwork | Change::Other => "playback",
        };
        let change = SessionChange { kind, at: current_unix_millis(), session_id: None };
        if let Ok(data) = serde_json::to_value(&change) {
            crate::plugin_kernel::emit_to_host(MEDIA_CHANGED_HOST_EVENT, data);
        }
        let _ = events.emit(MEDIA_SESSION_CHANGED_EVENT, change);
    })
}

pub(super) fn stop() {
    adapter::stop();
}

pub(super) fn running() -> bool {
    adapter::running()
}
