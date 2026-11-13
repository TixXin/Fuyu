use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::adapter_macos::{self as adapter, Change};
use super::state::current_unix_millis;

pub(crate) const MEDIA_SESSION_CHANGED_EVENT: &str = "media-session-changed";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionChange {
    kind: &'static str,
    at: i64,
    session_id: Option<String>,
}

pub(crate) fn start(app: &AppHandle) {
    let events = app.clone();
    adapter::start(app, move |change| {
        let kind = match change {
            Change::Track => "track",
            Change::Playback | Change::Other => "playback",
        };
        let _ = events.emit(MEDIA_SESSION_CHANGED_EVENT, SessionChange { kind, at: current_unix_millis(), session_id: None });
    });
}
