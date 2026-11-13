#[path = "plugin_view.rs"]
mod plugin_view;

use serde::Serialize;
use std::{
    sync::{Arc, Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

use crate::macos::dock_badges::{self, Badge};

pub(crate) use plugin_view::plugin_messages;

const EVENT_NAME: &str = "wechat-reminder-changed";
const BUNDLE_ID: &str = "com.tencent.xinWeChat";
const MAX_ITEMS: usize = 20;

static SERVICE: OnceLock<Arc<ReminderService>> = OnceLock::new();

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderItem {
    at: u64,
    message: Option<()>,
    reason: Option<&'static str>,
    unread: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderSnapshot {
    revision: u64,
    enabled: bool,
    status: &'static str,
    pending: bool,
    last_attention_at: Option<u64>,
    error: Option<String>,
    message: Option<()>,
    items: Vec<ReminderItem>,
    expose_ui: bool,
    expose_status: Option<String>,
    hide_taskbar_button: bool,
}

impl Default for ReminderSnapshot {
    fn default() -> Self {
        Self {
            revision: 0,
            enabled: false,
            status: "disabled",
            pending: false,
            last_attention_at: None,
            error: None,
            message: None,
            items: Vec::new(),
            expose_ui: false,
            expose_status: None,
            hide_taskbar_button: false,
        }
    }
}

#[derive(Default)]
struct ReminderState {
    snapshot: ReminderSnapshot,
    unread: u32,
}

struct ReminderService {
    app: AppHandle,
    state: Mutex<ReminderState>,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|time| time.as_millis() as u64).unwrap_or_default()
}

fn service() -> Result<&'static Arc<ReminderService>, String> {
    SERVICE.get().ok_or_else(|| "The WeChat reminder service is not ready yet.".to_string())
}

fn publish(service: &ReminderService, snapshot: ReminderSnapshot) {
    plugin_view::publish_received(&snapshot);
    let visible = service.app.get_webview_window(crate::island::WINDOW_LABEL).is_some_and(|window| window.is_visible().unwrap_or(false));
    let payload = serde_json::json!({ "snapshot": snapshot, "windowVisible": visible });
    let _ = service.app.emit_to(crate::settings_window::WINDOW_LABEL, EVENT_NAME, payload.clone());
    let _ = service.app.emit_to(crate::island::WINDOW_LABEL, EVENT_NAME, payload);
}

fn apply(state: &mut ReminderState, reading: Badge, now: u64) -> bool {
    if !state.snapshot.enabled {
        return false;
    }
    let before = state.snapshot.clone();
    match reading {
        Badge::NotAllowed => {
            state.snapshot.status = "permissionRequired";
            state.snapshot.pending = false;
        }
        Badge::NotInDock | Badge::Label(None) => {
            state.snapshot.status = "listening";
            state.snapshot.pending = false;
            state.unread = 0;
        }
        Badge::Label(Some(label)) => {
            let unread = dock_badges::unread(&label);
            state.snapshot.status = "listening";
            state.snapshot.pending = true;
            if unread > state.unread {
                state.snapshot.last_attention_at = Some(now);
                state.snapshot.items.insert(0, ReminderItem { at: now, message: None, reason: Some("unread"), unread: Some(unread) });
                state.snapshot.items.truncate(MAX_ITEMS);
            }
            state.unread = unread;
        }
    }
    let changed = state.snapshot != before;
    if changed {
        state.snapshot.revision += 1;
    }
    changed
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let service = Arc::new(ReminderService { app: app.clone(), state: Mutex::new(ReminderState::default()) });
    SERVICE.set(service.clone()).map_err(|_| "The WeChat reminder service is already running.".to_string())?;
    let wanted = service.clone();
    dock_badges::watch(
        "wechat-reminders",
        BUNDLE_ID,
        move || wanted.state.lock().is_ok_and(|state| state.snapshot.enabled),
        move |reading| {
            let snapshot = {
                let Ok(mut state) = service.state.lock() else { return };
                if !apply(&mut state, reading, now_ms()) {
                    return;
                }
                state.snapshot.clone()
            };
            publish(&service, snapshot);
        },
    )
}

pub(crate) fn diagnostic_state() -> Result<serde_json::Value, String> {
    let state = service()?.state.lock().map_err(|_| "The WeChat reminder state is unavailable.".to_string())?;
    Ok(serde_json::json!({
        "enabled": state.snapshot.enabled,
        "status": state.snapshot.status,
        "pending": state.snapshot.pending,
        "lastAttentionAt": state.snapshot.last_attention_at,
        "error": state.snapshot.error,
    }))
}

fn update(change: impl FnOnce(&mut ReminderState) -> bool) -> Result<ReminderSnapshot, String> {
    let service = service()?;
    let (snapshot, changed) = {
        let mut state = service.state.lock().map_err(|_| "The WeChat reminder state is unavailable.".to_string())?;
        let changed = change(&mut state);
        if changed {
            state.snapshot.revision += 1;
        }
        (state.snapshot.clone(), changed)
    };
    if changed {
        publish(service, snapshot.clone());
    }
    Ok(snapshot)
}

#[tauri::command]
pub fn set_wechat_reminders_enabled(enabled: bool) -> Result<ReminderSnapshot, String> {
    update(|state| {
        if state.snapshot.enabled == enabled {
            return false;
        }
        *state = ReminderState::default();
        state.snapshot.enabled = enabled;
        state.snapshot.status = if enabled { "waiting" } else { "disabled" };
        true
    })
}

#[tauri::command]
pub fn set_wechat_expose_ui(enabled: bool) -> Result<ReminderSnapshot, String> {
    let _ = enabled;
    update(|_| false)
}

#[tauri::command]
pub fn set_wechat_hide_taskbar_button(enabled: bool) -> Result<ReminderSnapshot, String> {
    let _ = enabled;
    update(|_| false)
}

#[tauri::command]
pub fn clear_wechat_reminders() -> Result<ReminderSnapshot, String> {
    update(|state| {
        let had = !state.snapshot.items.is_empty();
        state.snapshot.items.clear();
        had
    })
}

#[tauri::command]
pub async fn open_wechat(chat: Option<String>) -> Result<(), String> {
    let _ = chat;
    if !crate::macos::accessibility::is_trusted() {
        let _ = dock_badges::open_accessibility_settings();
    }
    tauri::async_runtime::spawn_blocking(|| dock_badges::open_app(BUNDLE_ID)).await.map_err(|error| error.to_string())?
}

pub(crate) fn shutdown() {}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::wechat_reminders::set_wechat_reminders_enabled,
            crate::wechat_reminders::open_wechat,
            crate::wechat_reminders::set_wechat_expose_ui,
            crate::wechat_reminders::set_wechat_hide_taskbar_button,
            crate::wechat_reminders::clear_wechat_reminders,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::{apply, ReminderState};
    use crate::macos::dock_badges::Badge;

    fn enabled() -> ReminderState {
        let mut state = ReminderState::default();
        state.snapshot.enabled = true;
        state
    }

    #[test]
    fn a_growing_badge_adds_a_reminder_and_a_cleared_one_ends_it() {
        let mut state = enabled();
        assert!(apply(&mut state, Badge::Label(Some("2".into())), 10));
        assert!(state.snapshot.pending);
        assert_eq!(state.snapshot.items.len(), 1);
        assert_eq!(state.snapshot.items[0].unread, Some(2));
        assert!(!apply(&mut state, Badge::Label(Some("1".into())), 20), "fewer unread messages is no new reminder");
        assert_eq!(state.snapshot.items.len(), 1);
        assert!(apply(&mut state, Badge::Label(Some("4".into())), 30));
        assert_eq!(state.snapshot.items.len(), 2);
        assert!(apply(&mut state, Badge::Label(None), 40));
        assert!(!state.snapshot.pending);
        assert!(apply(&mut state, Badge::NotAllowed, 50));
        assert_eq!(state.snapshot.status, "permissionRequired");
        assert!(!apply(&mut state, Badge::NotAllowed, 60));
    }
}
