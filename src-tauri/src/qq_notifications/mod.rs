mod history;
mod launcher;
mod listener;
mod plugin_view;

#[cfg(test)]
mod tests;

use serde::Serialize;
use std::{
    sync::{mpsc, Arc, Mutex, OnceLock, PoisonError},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;
use windows::UI::Notifications::Management::{
    UserNotificationListener, UserNotificationListenerAccessStatus,
};

use history::NotificationBuffer;
use launcher::{activate_existing_qq, qq_executable};
use listener::{handle_poll, QQ_APP_ID};

use crate::messages_plugin::{self, SourceSwitch};
use crate::toast_notifications::{self, Subscription, ToastMatcher};
use crate::user_error::UserError;

pub(crate) use plugin_view::plugin_messages;

const EVENT_NAME: &str = "qq-notifications-changed";

static SERVICE: OnceLock<Arc<NotificationService>> = OnceLock::new();

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QQNotification {
    id: String,
    title: String,
    body: String,
    created_at: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NotificationStatus {
    Disabled,
    Waiting,
    Listening,
    PermissionDenied,
    PermissionRequired,
    Error,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSnapshot {
    revision: u64,
    enabled: bool,
    status: NotificationStatus,
    items: Vec<QQNotification>,
    error: Option<UserError>,
}

impl Default for NotificationSnapshot {
    fn default() -> Self {
        Self {
            revision: 0,
            enabled: false,
            status: NotificationStatus::Disabled,
            items: Vec::new(),
            error: None,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NotificationEvent {
    snapshot: NotificationSnapshot,
    newest_id: Option<String>,
    window_visible: bool,
}

#[derive(Default)]
struct MonitorState {
    snapshot: NotificationSnapshot,
    generation: u64,
    buffer: NotificationBuffer,
    auto_clear: bool,
}

impl MonitorState {
    fn forget_seen(&mut self, at: i64) -> bool {
        if !self.snapshot.enabled || !self.auto_clear {
            return false;
        }
        let before = self.buffer.items.len();
        self.buffer.items.retain(|item| item.created_at > at);
        if self.buffer.items.len() == before {
            return false;
        }
        self.snapshot.items = self.buffer.items.clone();
        self.snapshot.revision += 1;
        true
    }
}

#[derive(Default)]
struct RepairState {
    generation: Option<u64>,
    error: Option<UserError>,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|time| time.as_millis() as i64)
        .unwrap_or_default()
}

fn forget_seen(service: &NotificationService, at: i64) {
    let snapshot = {
        let Ok(mut state) = service.state.lock() else {
            return;
        };
        if !state.forget_seen(at) {
            return;
        }
        state.snapshot.clone()
    };
    publish(service, snapshot, None);
}

struct NotificationService {
    app: AppHandle,
    state: Mutex<MonitorState>,
    repair: Mutex<RepairState>,
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    if SERVICE.get().is_some() {
        return Ok(());
    }
    let service = Arc::new(NotificationService {
        app: app.clone(),
        state: Mutex::new(MonitorState::default()),
        repair: Mutex::new(RepairState::default()),
    });
    if SERVICE.set(service.clone()).is_err() {
        return Ok(());
    }
    let polled = service.clone();
    let foregrounded = service.clone();
    toast_notifications::subscribe(Subscription {
        source: messages_plugin::QQ,
        matchers: vec![ToastMatcher::AumidExact(QQ_APP_ID.into())],
        executables: vec!["QQ.exe".into()],
        on_poll: Arc::new(move |poll| handle_poll(&polled, poll)),
        on_foreground: Arc::new(move |at| forget_seen(&foregrounded, at)),
    });
    let switched = service.clone();
    let checked = service;
    let switch = SourceSwitch::new(
        messages_plugin::QQ,
        move |enabled| {
            set_enabled(&switched, enabled);
            toast_notifications::set_enabled(messages_plugin::QQ, enabled);
        },
        move || {
            checked
                .state
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .snapshot
                .enabled
                && toast_notifications::is_source_running(messages_plugin::QQ)
        },
    );
    messages_plugin::register(messages_plugin::QQ, switch);
    Ok(())
}

fn ready(app: &AppHandle) -> Result<&'static Arc<NotificationService>, UserError> {
    init(app)?;
    service()
}

fn service() -> Result<&'static Arc<NotificationService>, UserError> {
    SERVICE
        .get()
        .ok_or_else(|| UserError::new("qq.notReady", "The QQ notification service is not ready yet."))
}

fn unavailable() -> UserError {
    UserError::new("qq.unavailable", "The QQ notification state is unavailable.")
}

#[tauri::command]
pub fn get_qq_notification_state(app: AppHandle) -> Result<NotificationSnapshot, UserError> {
    Ok(ready(&app)?
        .state
        .lock()
        .map_err(|_| unavailable())?
        .snapshot
        .clone())
}

pub(crate) fn diagnostic_state() -> Result<serde_json::Value, String> {
    let state = service()
        .map_err(|error| error.to_string())?
        .state
        .lock()
        .map_err(|_| unavailable().to_string())?;
    Ok(notification_diagnostics(&state.snapshot))
}

fn notification_diagnostics(snapshot: &NotificationSnapshot) -> serde_json::Value {
    serde_json::json!({
        "enabled": snapshot.enabled,
        "status": snapshot.status,
        "error": snapshot.error,
        "itemCount": snapshot.items.len(),
    })
}

fn set_enabled(service: &NotificationService, enabled: bool) {
    let snapshot = {
        let Ok(mut state) = service.state.lock() else {
            return;
        };
        if state.snapshot.enabled == enabled {
            return;
        }
        state.generation += 1;
        state.buffer = NotificationBuffer::default();
        state.snapshot = NotificationSnapshot {
            revision: state.snapshot.revision + 1,
            enabled,
            status: if enabled {
                NotificationStatus::Waiting
            } else {
                NotificationStatus::Disabled
            },
            ..NotificationSnapshot::default()
        };
        state.snapshot.clone()
    };
    if !enabled {
        let mut repair = service
            .repair
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        *repair = RepairState::default();
    }
    publish(service, snapshot, None);
}

#[tauri::command]
pub fn set_qq_auto_clear(app: AppHandle, enabled: bool) -> Result<NotificationSnapshot, UserError> {
    let mut state = ready(&app)?.state.lock().map_err(|_| unavailable())?;
    state.auto_clear = enabled;
    Ok(state.snapshot.clone())
}

#[tauri::command]
pub fn clear_qq_notifications() -> Result<NotificationSnapshot, UserError> {
    let service = service()?;
    let snapshot = {
        let mut state = service.state.lock().map_err(|_| unavailable())?;
        state.buffer.items.clear();
        state.snapshot.items.clear();
        state.snapshot.revision += 1;
        state.snapshot.clone()
    };
    publish(service, snapshot.clone(), None);
    Ok(snapshot)
}

#[tauri::command]
pub async fn request_qq_notification_access(app: AppHandle) -> Result<String, UserError> {
    let (sender, receiver) = mpsc::sync_channel(1);
    app.run_on_main_thread(move || {
        let operation = (|| {
            let listener = UserNotificationListener::Current()?;
            let access = listener.GetAccessStatus()?;
            let operation = if access == UserNotificationListenerAccessStatus::Unspecified {
                Some(listener.RequestAccessAsync()?)
            } else {
                None
            };
            windows::core::Result::Ok((access, operation))
        })();
        let _ = sender.send(operation);
    })
    .map_err(|error| UserError::new("qq.requestAccessStart", "Could not start the notification permission request.").detail(error))?;
    let (access, operation) =
        tauri::async_runtime::spawn_blocking(move || receiver.recv_timeout(Duration::from_secs(5)))
            .await
            .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?
            .map_err(|error| UserError::new("qq.requestAccessStart", "Could not start the notification permission request.").detail(error))?
            .map_err(|error| UserError::new("qq.requestAccess", "Could not request Windows notification permission.").detail(error))?;
    let access = match operation {
        Some(operation) => operation
            .await
            .map_err(|error| UserError::new("qq.accessFailed", "Windows notification authorization failed.").detail(error))?,
        None => access,
    };
    Ok(match access {
        UserNotificationListenerAccessStatus::Allowed => "allowed",
        UserNotificationListenerAccessStatus::Denied => "denied",
        _ => "unspecified",
    }
    .to_string())
}

#[tauri::command]
pub fn open_qq_notification_settings(app: AppHandle, access: bool) -> Result<(), UserError> {
    let url = if access {
        "ms-settings:privacy-notifications"
    } else {
        "ms-settings:notifications"
    };
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| UserError::new("qq.openSettings", "Could not open Windows notification settings.").detail(error))
}

fn publish(
    service: &NotificationService,
    snapshot: NotificationSnapshot,
    newest_id: Option<String>,
) {
    let newest_id = newest_id.filter(|_| crate::coexist::banner_visible(true));
    plugin_view::publish_received(&snapshot, newest_id.as_deref());
    let window_visible = crate::coexist::banner_visible(
        service
            .app
            .get_webview_window(crate::island::WINDOW_LABEL)
            .is_some_and(|window| window.is_visible().unwrap_or(false)),
    );
    let event = NotificationEvent {
        snapshot,
        newest_id,
        window_visible,
    };
    let _ = service.app.emit_to(
        crate::settings_window::WINDOW_LABEL,
        EVENT_NAME,
        event.clone(),
    );
    let _ = service.app.emit_to(crate::island::WINDOW_LABEL, EVENT_NAME, event);
}

#[tauri::command]
pub async fn open_qq() -> Result<(), UserError> {
    let asked_at = now_ms();
    tauri::async_runtime::spawn_blocking(|| activate_existing_qq(&qq_executable()?))
        .await
        .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))??;
    if let Ok(service) = service() {
        forget_seen(service, asked_at);
    }
    Ok(())
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::qq_notifications::get_qq_notification_state,
            crate::qq_notifications::request_qq_notification_access,
            crate::qq_notifications::open_qq_notification_settings,
            crate::qq_notifications::clear_qq_notifications,
            crate::qq_notifications::open_qq,
            crate::qq_notifications::set_qq_auto_clear,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
