mod history;
mod launcher;
mod listener;
mod plugin_view;

#[cfg(test)]
mod tests;

use serde::Serialize;
use std::{
    sync::{mpsc, Arc, Mutex, OnceLock},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;
use windows::UI::Notifications::Management::{
    UserNotificationListener, UserNotificationListenerAccessStatus,
};

use history::NotificationBuffer;
use launcher::{activate_existing_qq, qq_executable};
use listener::monitor;

use crate::messages_plugin::{self, SourceWorker};
use crate::plugin_kernel::worker::Worker;

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
    error: Option<String>,
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
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    if SERVICE.get().is_some() {
        return Ok(());
    }
    let service = Arc::new(NotificationService {
        app: app.clone(),
        state: Mutex::new(MonitorState::default()),
    });
    SERVICE
        .set(service.clone())
        .map_err(|_| "QQ 通知服务已启动。".to_string())?;
    let listening = service.clone();
    let worker = Worker::new("qq-notifications", move |stop| monitor(listening.clone(), &stop));
    messages_plugin::register(
        messages_plugin::QQ,
        SourceWorker::new(messages_plugin::QQ, worker, move |enabled| set_enabled(&service, enabled)),
    );
    Ok(())
}

fn service() -> Result<&'static Arc<NotificationService>, String> {
    SERVICE
        .get()
        .ok_or_else(|| "QQ 通知服务尚未就绪。".to_string())
}

#[tauri::command]
pub fn get_qq_notification_state() -> Result<NotificationSnapshot, String> {
    Ok(service()?
        .state
        .lock()
        .map_err(|_| "QQ 通知状态不可用。")?
        .snapshot
        .clone())
}

pub(crate) fn diagnostic_state() -> Result<serde_json::Value, String> {
    let state = service()?.state.lock().map_err(|_| "QQ 通知状态不可用。")?;
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
    publish(service, snapshot, None);
}

#[tauri::command]
pub fn set_qq_auto_clear(enabled: bool) -> Result<NotificationSnapshot, String> {
    let mut state = service()?.state.lock().map_err(|_| "QQ 通知状态不可用。")?;
    state.auto_clear = enabled;
    Ok(state.snapshot.clone())
}

#[tauri::command]
pub fn clear_qq_notifications() -> Result<NotificationSnapshot, String> {
    let service = service()?;
    let snapshot = {
        let mut state = service.state.lock().map_err(|_| "QQ 通知状态不可用。")?;
        state.buffer.items.clear();
        state.snapshot.items.clear();
        state.snapshot.revision += 1;
        state.snapshot.clone()
    };
    publish(service, snapshot.clone(), None);
    Ok(snapshot)
}

#[tauri::command]
pub async fn request_qq_notification_access(app: AppHandle) -> Result<String, String> {
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
    .map_err(|error| format!("无法发起通知授权：{error}"))?;
    let (access, operation) =
        tauri::async_runtime::spawn_blocking(move || receiver.recv_timeout(Duration::from_secs(5)))
            .await
            .map_err(|error| format!("通知授权线程失败：{error}"))?
            .map_err(|error| format!("无法发起通知授权：{error}"))?
            .map_err(|error| format!("无法请求 Windows 通知权限：{error}"))?;
    let access = match operation {
        Some(operation) => operation
            .await
            .map_err(|error| format!("Windows 通知授权失败：{error}"))?,
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
pub fn open_qq_notification_settings(app: AppHandle, access: bool) -> Result<(), String> {
    let url = if access {
        "ms-settings:privacy-notifications"
    } else {
        "ms-settings:notifications"
    };
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| format!("无法打开 Windows 通知设置：{error}"))
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
pub async fn open_qq() -> Result<(), String> {
    let asked_at = now_ms();
    tauri::async_runtime::spawn_blocking(|| activate_existing_qq(&qq_executable()?))
        .await
        .map_err(|error| format!("打开 QQ 的线程失败：{error}"))??;
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
