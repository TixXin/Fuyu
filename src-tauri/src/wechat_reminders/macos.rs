#[path = "plugin_view.rs"]
mod plugin_view;

use serde::Serialize;
use std::{
    sync::{Arc, Mutex, OnceLock, PoisonError},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

use crate::macos::dock_badges::{self, Badge, DockSource};
use crate::messages_plugin::{self, SourceSwitch};
use crate::user_error::UserError;

pub(crate) use plugin_view::plugin_messages;

const EVENT_NAME: &str = "wechat-reminder-changed";
const BUNDLE_ID: &str = "com.tencent.xinWeChat";
const BUNDLE_IDS: &[&str] = &[BUNDLE_ID];
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
    error: Option<UserError>,
    message: Option<()>,
    items: Vec<ReminderItem>,
    expose_ui: bool,
    expose_status: Option<UserError>,
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
    auto_clear: bool,
}

impl ReminderState {
    fn forget_before(&mut self, at: u64) -> bool {
        let before = self.snapshot.items.len();
        self.snapshot.items.retain(|item| item.at > at);
        self.snapshot.items.len() != before
    }

    fn forget_seen(&mut self, at: u64) -> bool {
        self.snapshot.enabled && self.auto_clear && self.forget_before(at)
    }
}

struct ReminderService {
    app: AppHandle,
    state: Mutex<ReminderState>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|time| time.as_millis() as u64)
        .unwrap_or_default()
}

fn service() -> Result<&'static Arc<ReminderService>, UserError> {
    SERVICE
        .get()
        .ok_or_else(|| UserError::new("wechat.notReady", "The WeChat reminder service is not ready yet."))
}

fn unavailable() -> UserError {
    UserError::new("wechat.unavailable", "The WeChat reminder state is unavailable.")
}

fn publish(service: &ReminderService, snapshot: ReminderSnapshot) {
    plugin_view::publish_received(&snapshot);
    let visible = service
        .app
        .get_webview_window(crate::island::WINDOW_LABEL)
        .is_some_and(|window| window.is_visible().unwrap_or(false));
    let payload = serde_json::json!({ "snapshot": snapshot, "windowVisible": visible });
    let _ = service.app.emit_to(
        crate::settings_window::WINDOW_LABEL,
        EVENT_NAME,
        payload.clone(),
    );
    let _ = service
        .app
        .emit_to(crate::island::WINDOW_LABEL, EVENT_NAME, payload);
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
        Badge::NotInDock => {
            state.snapshot.status = "listening";
            state.snapshot.pending = false;
            state.unread = 0;
        }
        Badge::Label(None) => {
            state.snapshot.status = "listening";
            state.snapshot.pending = false;
            state.unread = 0;
            state.forget_seen(now);
        }
        Badge::Label(Some(label)) => {
            let unread = dock_badges::unread(&label);
            state.snapshot.status = "listening";
            state.snapshot.pending |= unread > state.unread;
            if unread > state.unread {
                state.snapshot.last_attention_at = Some(now);
                state.snapshot.items.insert(
                    0,
                    ReminderItem {
                        at: now,
                        message: None,
                        reason: Some("unread"),
                        unread: Some(unread),
                    },
                );
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

fn set_enabled(enabled: bool) {
    let _ = update(|state| {
        if state.snapshot.enabled == enabled {
            return false;
        }
        *state = ReminderState {
            auto_clear: state.auto_clear,
            ..ReminderState::default()
        };
        state.snapshot.enabled = enabled;
        state.snapshot.status = if enabled { "waiting" } else { "disabled" };
        true
    });
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let service = Arc::new(ReminderService {
        app: app.clone(),
        state: Mutex::new(ReminderState::default()),
    });
    SERVICE
        .set(service.clone())
        .map_err(|_| "The WeChat reminder service is already running.".to_string())?;
    let badged = service.clone();
    let activated = service.clone();
    dock_badges::subscribe(DockSource {
        source: messages_plugin::WECHAT,
        bundle_ids: BUNDLE_IDS,
        on_badge: Arc::new(move |reading| {
            let snapshot = {
                let Ok(mut state) = badged.state.lock() else {
                    return;
                };
                if !apply(&mut state, reading, now_ms()) {
                    return;
                }
                state.snapshot.clone()
            };
            publish(&badged, snapshot);
        }),
        on_activate: Arc::new(move || {
            let watching = activated
                .state
                .lock()
                .is_ok_and(|state| state.snapshot.enabled && state.auto_clear);
            if watching {
                let _ = update(|state| state.forget_seen(now_ms()));
            }
        }),
    });
    let checked = service;
    let switch = SourceSwitch::new(
        messages_plugin::WECHAT,
        |enabled| {
            set_enabled(enabled);
            dock_badges::set_enabled(messages_plugin::WECHAT, enabled);
        },
        move || {
            checked
                .state
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .snapshot
                .enabled
                && dock_badges::is_source_running(messages_plugin::WECHAT)
        },
    );
    messages_plugin::register(messages_plugin::WECHAT, switch);
    Ok(())
}

pub(crate) fn diagnostic_state() -> Result<serde_json::Value, String> {
    let state = service()
        .map_err(|error| error.to_string())?
        .state
        .lock()
        .map_err(|_| unavailable().to_string())?;
    Ok(serde_json::json!({
        "enabled": state.snapshot.enabled,
        "status": state.snapshot.status,
        "pending": state.snapshot.pending,
        "lastAttentionAt": state.snapshot.last_attention_at,
        "error": state.snapshot.error,
    }))
}

fn update(change: impl FnOnce(&mut ReminderState) -> bool) -> Result<ReminderSnapshot, UserError> {
    let service = service()?;
    let (snapshot, changed) = {
        let mut state = service
            .state
            .lock()
            .map_err(|_| unavailable())?;
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
pub fn set_wechat_expose_ui(enabled: bool) -> Result<ReminderSnapshot, UserError> {
    let _ = enabled;
    update(|_| false)
}

#[tauri::command]
pub fn set_wechat_hide_taskbar_button(enabled: bool) -> Result<ReminderSnapshot, UserError> {
    let _ = enabled;
    update(|_| false)
}

#[tauri::command]
pub fn set_wechat_auto_clear(enabled: bool) -> Result<ReminderSnapshot, UserError> {
    update(|state| {
        state.auto_clear = enabled;
        false
    })
}

#[tauri::command]
pub fn clear_wechat_reminders() -> Result<ReminderSnapshot, UserError> {
    update(|state| {
        let had = !state.snapshot.items.is_empty() || state.snapshot.pending;
        state.snapshot.items.clear();
        state.snapshot.pending = false;
        had
    })
}

#[tauri::command]
pub async fn open_wechat(chat: Option<String>) -> Result<(), UserError> {
    let _ = chat;
    if !crate::macos::accessibility::is_trusted() {
        let _ = dock_badges::open_accessibility_settings();
    }
    let asked_at = now_ms();
    tauri::async_runtime::spawn_blocking(|| {
        dock_badges::open_app(BUNDLE_ID)
            .map_err(|error| UserError::new("wechat.openApp", "Could not open WeChat.").detail(error))
    })
    .await
    .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))??;
    update(|state| state.forget_seen(asked_at)).map(|_| ())
}

pub(crate) fn shutdown() {}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::wechat_reminders::open_wechat,
            crate::wechat_reminders::set_wechat_expose_ui,
            crate::wechat_reminders::set_wechat_hide_taskbar_button,
            crate::wechat_reminders::clear_wechat_reminders,
            crate::wechat_reminders::set_wechat_auto_clear,
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
        assert!(
            !apply(&mut state, Badge::Label(Some("1".into())), 20),
            "fewer unread messages is no new reminder"
        );
        assert_eq!(state.snapshot.items.len(), 1);
        assert!(apply(&mut state, Badge::Label(Some("4".into())), 30));
        assert_eq!(state.snapshot.items.len(), 2);
        assert!(apply(&mut state, Badge::Label(None), 40));
        assert!(!state.snapshot.pending);
        assert!(apply(&mut state, Badge::NotAllowed, 50));
        assert_eq!(state.snapshot.status, "permissionRequired");
        assert!(!apply(&mut state, Badge::NotAllowed, 60));
    }

    #[test]
    fn clearing_the_list_keeps_the_dot_off_until_more_messages_arrive() {
        let mut state = enabled();
        assert!(apply(&mut state, Badge::Label(Some("2".into())), 10));
        state.snapshot.items.clear();
        state.snapshot.pending = false;
        assert!(
            !apply(&mut state, Badge::Label(Some("2".into())), 20),
            "the same badge after clearing is not news"
        );
        assert!(!state.snapshot.pending);
        assert!(apply(&mut state, Badge::Label(Some("3".into())), 30));
        assert!(state.snapshot.pending);
    }

    #[test]
    fn a_cleared_badge_forgets_only_what_arrived_before_it_when_auto_clear_is_on() {
        let mut state = enabled();
        assert!(apply(&mut state, Badge::Label(Some("1".into())), 10));
        assert!(apply(&mut state, Badge::Label(None), 20));
        assert_eq!(
            state.snapshot.items.len(),
            1,
            "nothing is forgotten while auto clear is off"
        );
        state.auto_clear = true;
        assert!(apply(&mut state, Badge::Label(Some("2".into())), 30));
        assert!(apply(&mut state, Badge::NotInDock, 40));
        assert_eq!(
            state.snapshot.items.len(),
            2,
            "WeChat quitting is not a sign of reading"
        );
        assert!(apply(&mut state, Badge::Label(Some("1".into())), 50));
        assert!(apply(&mut state, Badge::Label(None), 45));
        let left: Vec<_> = state.snapshot.items.iter().map(|item| item.at).collect();
        assert_eq!(left, [50], "a message that arrived after the badge cleared stays");
        assert!(!state.forget_seen(49));
        assert!(state.forget_seen(50));
        assert!(state.snapshot.items.is_empty());
    }
}
