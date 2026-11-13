#[path = "plugin_view.rs"]
mod plugin_view;

use serde::Serialize;
use std::{
    sync::{Arc, Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

use crate::macos::{
    accessibility,
    dock_badges::{self, Badge},
};

pub(crate) use plugin_view::plugin_messages;

const EVENT_NAME: &str = "qq-notifications-changed";
const BUNDLE_ID: &str = "com.tencent.qq";
const MAX_ITEMS: usize = 20;

static SERVICE: OnceLock<Arc<NotificationService>> = OnceLock::new();

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QQNotification {
    id: String,
    title: String,
    body: String,
    created_at: i64,
    unread: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NotificationStatus {
    Disabled,
    Waiting,
    Listening,
    PermissionRequired,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSnapshot {
    revision: u64,
    enabled: bool,
    status: NotificationStatus,
    items: Vec<QQNotification>,
    error: Option<String>,
}

impl Default for NotificationSnapshot {
    fn default() -> Self {
        Self { revision: 0, enabled: false, status: NotificationStatus::Disabled, items: Vec::new(), error: None }
    }
}

#[derive(Default)]
struct NotificationState {
    snapshot: NotificationSnapshot,
    unread: u32,
}

struct NotificationService {
    app: AppHandle,
    state: Mutex<NotificationState>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NotificationEvent {
    snapshot: NotificationSnapshot,
    newest_id: Option<String>,
    window_visible: bool,
}

fn now_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|time| time.as_millis() as i64).unwrap_or_default()
}

fn service() -> Result<&'static Arc<NotificationService>, String> {
    SERVICE.get().ok_or_else(|| "The QQ reminder service is not ready yet.".to_string())
}

fn publish(service: &NotificationService, snapshot: NotificationSnapshot, newest_id: Option<String>) {
    plugin_view::publish_received(&snapshot, newest_id.as_deref());
    let window_visible = service.app.get_webview_window(crate::island::WINDOW_LABEL).is_some_and(|window| window.is_visible().unwrap_or(false));
    let event = NotificationEvent { snapshot, newest_id, window_visible };
    let _ = service.app.emit_to(crate::settings_window::WINDOW_LABEL, EVENT_NAME, event.clone());
    let _ = service.app.emit_to(crate::island::WINDOW_LABEL, EVENT_NAME, event);
}

fn apply(state: &mut NotificationState, reading: Badge, now: i64) -> Option<Option<String>> {
    if !state.snapshot.enabled {
        return None;
    }
    let before = state.snapshot.clone();
    let mut newest = None;
    match reading {
        Badge::NotAllowed => state.snapshot.status = NotificationStatus::PermissionRequired,
        Badge::NotInDock | Badge::Label(None) => {
            state.snapshot.status = NotificationStatus::Listening;
            state.unread = 0;
        }
        Badge::Label(Some(label)) => {
            let unread = dock_badges::unread(&label);
            state.snapshot.status = NotificationStatus::Listening;
            if unread > state.unread {
                let id = format!("qq-badge-{now}");
                state.snapshot.items.insert(0, QQNotification { id: id.clone(), title: "QQ".into(), body: String::new(), created_at: now, unread: Some(unread) });
                state.snapshot.items.truncate(MAX_ITEMS);
                newest = Some(id);
            }
            state.unread = unread;
        }
    }
    if state.snapshot == before {
        return None;
    }
    state.snapshot.revision += 1;
    Some(newest)
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let service = Arc::new(NotificationService { app: app.clone(), state: Mutex::new(NotificationState::default()) });
    SERVICE.set(service.clone()).map_err(|_| "The QQ reminder service is already running.".to_string())?;
    let wanted = service.clone();
    dock_badges::watch(
        "qq-reminders",
        BUNDLE_ID,
        move || wanted.state.lock().is_ok_and(|state| state.snapshot.enabled),
        move |reading| {
            let (snapshot, newest) = {
                let Ok(mut state) = service.state.lock() else { return };
                let Some(newest) = apply(&mut state, reading, now_ms()) else { return };
                (state.snapshot.clone(), newest)
            };
            publish(&service, snapshot, newest);
        },
    )
}

fn snapshot() -> Result<NotificationSnapshot, String> {
    Ok(service()?.state.lock().map_err(|_| "The QQ reminder state is unavailable.".to_string())?.snapshot.clone())
}

#[tauri::command]
pub fn get_qq_notification_state() -> Result<NotificationSnapshot, String> {
    snapshot()
}

pub(crate) fn diagnostic_state() -> Result<serde_json::Value, String> {
    let snapshot = snapshot()?;
    Ok(serde_json::json!({ "enabled": snapshot.enabled, "status": snapshot.status, "items": snapshot.items.len() }))
}

fn update(change: impl FnOnce(&mut NotificationState) -> bool) -> Result<NotificationSnapshot, String> {
    let service = service()?;
    let (snapshot, changed) = {
        let mut state = service.state.lock().map_err(|_| "The QQ reminder state is unavailable.".to_string())?;
        let changed = change(&mut state);
        if changed {
            state.snapshot.revision += 1;
        }
        (state.snapshot.clone(), changed)
    };
    if changed {
        publish(service, snapshot.clone(), None);
    }
    Ok(snapshot)
}

#[tauri::command]
pub fn set_qq_notifications_enabled(enabled: bool) -> Result<NotificationSnapshot, String> {
    update(|state| {
        if state.snapshot.enabled == enabled {
            return false;
        }
        *state = NotificationState::default();
        state.snapshot.enabled = enabled;
        state.snapshot.status = if enabled { NotificationStatus::Waiting } else { NotificationStatus::Disabled };
        true
    })
}

#[tauri::command]
pub fn clear_qq_notifications() -> Result<NotificationSnapshot, String> {
    update(|state| {
        let had = !state.snapshot.items.is_empty();
        state.snapshot.items.clear();
        had
    })
}

#[tauri::command]
pub async fn request_qq_notification_access() -> Result<String, String> {
    if accessibility::is_trusted() {
        return Ok("allowed".to_string());
    }
    dock_badges::open_accessibility_settings()?;
    Ok("unspecified".to_string())
}

#[tauri::command]
pub fn open_qq_notification_settings(access: bool) -> Result<(), String> {
    let _ = access;
    dock_badges::open_accessibility_settings()
}

#[tauri::command]
pub async fn open_qq() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| dock_badges::open_app(BUNDLE_ID)).await.map_err(|error| error.to_string())?
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::qq_notifications::get_qq_notification_state,
            crate::qq_notifications::set_qq_notifications_enabled,
            crate::qq_notifications::request_qq_notification_access,
            crate::qq_notifications::open_qq_notification_settings,
            crate::qq_notifications::clear_qq_notifications,
            crate::qq_notifications::open_qq,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::{apply, NotificationState, NotificationStatus};
    use crate::macos::dock_badges::Badge;

    #[test]
    fn each_rise_of_the_badge_is_one_new_item() {
        let mut state = NotificationState::default();
        state.snapshot.enabled = true;
        assert_eq!(apply(&mut state, Badge::Label(Some("3".into())), 5), Some(Some("qq-badge-5".into())));
        assert_eq!(state.snapshot.items[0].unread, Some(3));
        assert_eq!(apply(&mut state, Badge::Label(Some("3".into())), 6), None);
        assert_eq!(apply(&mut state, Badge::Label(None), 7), None, "a cleared badge changes nothing that is shown");
        assert!(apply(&mut state, Badge::NotAllowed, 8).is_some());
        assert_eq!(state.snapshot.status, NotificationStatus::PermissionRequired);
    }
}
