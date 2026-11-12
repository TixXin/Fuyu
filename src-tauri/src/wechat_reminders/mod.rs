//! WeChat reminders: watches WeChat's tray flash and restores its window on request. With the
//! "show the contact and message" setting on, a flash also reads the chat list to tell who wrote
//! and what; the setting exposes WeChat's UI (Qt accessibility) in the running WeChat (gate.rs),
//! unless a screen reader has already. Off, the list is not read even when the UI is exposed.

mod button;
mod chats;
mod gate;
mod plugin_view;
mod reader;
mod source;

#[cfg(test)]
mod tests;

use reader::{ChatReader, Flash, Listing, PlainReason};
use serde::Serialize;
use source::{installed_executable, ReminderListener, ReminderSignal};
use std::{
    cell::RefCell,
    path::Path,
    rc::Rc,
    sync::{mpsc, Arc, Mutex, OnceLock},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::Foundation::HWND;

pub(crate) use plugin_view::plugin_messages;

use crate::win32;

const EVENT_NAME: &str = "wechat-reminder-changed";

static SERVICE: OnceLock<Arc<ReminderService>> = OnceLock::new();

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderSnapshot {
    revision: u64,
    enabled: bool,
    status: String,
    pending: bool,
    last_attention_at: Option<u64>,
    error: Option<String>,
    /// The newest message read from WeChat's chat list; `None` while the list is not readable.
    message: Option<ChatMessage>,
    /// The reminders since the island started (or the list was cleared), newest first.
    items: Vec<ReminderItem>,
    /// Setting: switch WeChat's Qt accessibility on so its chat list can be read.
    expose_ui: bool,
    /// How that is going, for the settings; `None` while off.
    expose_status: Option<String>,
    /// Setting: a minimized WeChat leaves the taskbar, so it can stay minimized (and readable)
    /// rather than closed to the tray (button.rs).
    hide_taskbar_button: bool,
}

/// One chat with a new message, as WeChat's chat list shows it.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    /// What opens the chat again (`open_wechat`).
    chat: String,
    contact: String,
    /// The last message, as WeChat cuts it short; a group's starts with the sender.
    preview: String,
    unread: Option<u32>,
    /// When it was read, in ms; unique per message, so each one is its own preview.
    at: u64,
}

/// One row of the panel's list: a chat message, or a reminder that came without one.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderItem {
    /// When it came, in ms; unique, so also the row's key.
    at: u64,
    message: Option<ChatMessage>,
    /// Why there is no message; `None` too when the chat list is not read at all (setting off).
    reason: Option<PlainReason>,
}

const MAX_ITEMS: usize = 20;

impl Default for ReminderSnapshot {
    fn default() -> Self {
        Self {
            revision: 0,
            enabled: false,
            status: "disabled".into(),
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
    generation: u64,
}

impl ReminderState {
    fn set_enabled(&mut self, enabled: bool) -> bool {
        if self.snapshot.enabled == enabled {
            return false;
        }
        self.generation += 1;
        self.snapshot = ReminderSnapshot {
            revision: self.snapshot.revision + 1,
            enabled,
            status: if enabled { "waiting" } else { "disabled" }.into(),
            expose_ui: self.snapshot.expose_ui,
            expose_status: self.snapshot.expose_status.take(),
            hide_taskbar_button: self.snapshot.hide_taskbar_button,
            ..Default::default()
        };
        true
    }

    fn set_expose_ui(&mut self, on: bool) -> bool {
        if self.snapshot.expose_ui == on {
            return false;
        }
        self.snapshot.expose_ui = on;
        self.snapshot.revision += 1;
        true
    }

    fn set_hide_taskbar_button(&mut self, on: bool) -> bool {
        if self.snapshot.hide_taskbar_button == on {
            return false;
        }
        self.snapshot.hide_taskbar_button = on;
        self.snapshot.revision += 1;
        true
    }

    fn set_expose_status(&mut self, status: Option<String>) -> bool {
        if self.snapshot.expose_status == status {
            return false;
        }
        self.snapshot.expose_status = status;
        self.snapshot.revision += 1;
        true
    }

    fn apply(&mut self, generation: u64, signal: ReminderSignal, now: u64) -> bool {
        if !self.snapshot.enabled || self.generation != generation {
            return false;
        }
        match signal {
            ReminderSignal::Attention => return self.remind(generation, now, None),
            ReminderSignal::Activated if self.snapshot.pending => self.snapshot.pending = false,
            _ => return false,
        }
        self.snapshot.revision += 1;
        true
    }

    /// A flash without a message: one reminder (and one row) until WeChat is looked at.
    fn remind(&mut self, generation: u64, now: u64, reason: Option<PlainReason>) -> bool {
        if !self.snapshot.enabled || self.generation != generation || self.snapshot.pending {
            return false;
        }
        self.snapshot.pending = true;
        self.snapshot.last_attention_at = Some(now);
        self.remember(ReminderItem {
            at: now,
            message: None,
            reason,
        });
        self.snapshot.revision += 1;
        true
    }

    fn remember(&mut self, item: ReminderItem) {
        self.snapshot.items.insert(0, item);
        self.snapshot.items.truncate(MAX_ITEMS);
    }

    /// A message read from the chat list: pending as for a flash, plus the message to show.
    fn receive(&mut self, generation: u64, message: ChatMessage) -> bool {
        if !self.snapshot.enabled || self.generation != generation {
            return false;
        }
        if !self.snapshot.pending {
            self.snapshot.pending = true;
            self.snapshot.last_attention_at = Some(message.at);
        }
        self.remember(ReminderItem {
            at: message.at,
            message: Some(message.clone()),
            reason: None,
        });
        self.snapshot.message = Some(message);
        self.snapshot.revision += 1;
        true
    }
}

struct ReminderService {
    app: AppHandle,
    state: Mutex<ReminderState>,
    /// WeChat's accessibility byte, when the island set it.
    gate: Mutex<gate::Keeper>,
    /// WeChat's taskbar button, when the island took it off.
    button: Mutex<button::Keeper>,
    wake: mpsc::SyncSender<()>,
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    if SERVICE.get().is_some() {
        return Ok(());
    }
    let (wake, receiver) = mpsc::sync_channel(1);
    let folder = crate::home_dir::fuyu_home(app.path())
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("wechat-gate");
    let service = Arc::new(ReminderService {
        app: app.clone(),
        state: Mutex::new(ReminderState::default()),
        gate: Mutex::new(gate::Keeper::new(folder)),
        button: Mutex::new(button::Keeper::default()),
        wake,
    });
    let worker = service.clone();
    thread::Builder::new()
        .name("wechat-reminders".into())
        .spawn(move || monitor(worker, receiver))
        .map_err(|error| format!("无法启动微信提醒监听：{error}"))?;
    SERVICE
        .set(service)
        .map_err(|_| "微信提醒服务已启动。".to_string())
}

fn service() -> Result<&'static Arc<ReminderService>, String> {
    SERVICE.get().ok_or_else(|| "微信提醒服务尚未就绪。".into())
}

fn publish(service: &ReminderService, snapshot: ReminderSnapshot) {
    plugin_view::publish_received(&snapshot);
    let visible = service
        .app
        .get_webview_window(crate::island::WINDOW_LABEL)
        .is_some_and(|window| window.is_visible().unwrap_or(false));
    let payload = serde_json::json!({"snapshot": snapshot, "windowVisible": visible});
    let _ = service.app.emit_to(
        crate::settings_window::WINDOW_LABEL,
        EVENT_NAME,
        payload.clone(),
    );
    let _ = service
        .app
        .emit_to(crate::island::WINDOW_LABEL, EVENT_NAME, payload);
}

pub(crate) fn diagnostic_state() -> Result<serde_json::Value, String> {
    let state = service()?
        .state
        .lock()
        .map_err(|_| "微信提醒状态不可用。")?;
    Ok(serde_json::json!({
        "enabled": state.snapshot.enabled,
        "status": state.snapshot.status,
        "pending": state.snapshot.pending,
        "lastAttentionAt": state.snapshot.last_attention_at,
        "error": state.snapshot.error,
    }))
}

#[tauri::command]
pub fn set_wechat_reminders_enabled(enabled: bool) -> Result<ReminderSnapshot, String> {
    let service = service()?;
    let (snapshot, changed) = {
        let mut state = service.state.lock().map_err(|_| "微信提醒状态不可用。")?;
        let changed = state.set_enabled(enabled);
        (state.snapshot.clone(), changed)
    };
    if changed {
        publish(service, snapshot.clone());
        let _ = service.wake.try_send(());
    }
    Ok(snapshot)
}

/// Turns the "expose WeChat's UI" setting on or off. Off puts WeChat's byte back right away; on
/// takes effect on the listener's next round (it may scan Weixin.dll for a few seconds once).
#[tauri::command]
pub fn set_wechat_expose_ui(enabled: bool) -> Result<ReminderSnapshot, String> {
    let service = service()?;
    if !enabled {
        let _ = service.gate.lock().map(|mut gate| gate.off());
    }
    let (snapshot, changed) = {
        let mut state = service.state.lock().map_err(|_| "微信提醒状态不可用。")?;
        let mut changed = state.set_expose_ui(enabled);
        if !enabled {
            changed |= state.set_expose_status(None);
        }
        (state.snapshot.clone(), changed)
    };
    if changed {
        publish(service, snapshot.clone());
        let _ = service.wake.try_send(());
    }
    Ok(snapshot)
}

/// Turns the "minimized WeChat leaves the taskbar" setting on or off; the listener applies it.
#[tauri::command]
pub fn set_wechat_hide_taskbar_button(enabled: bool) -> Result<ReminderSnapshot, String> {
    let service = service()?;
    let (snapshot, changed) = {
        let mut state = service.state.lock().map_err(|_| "微信提醒状态不可用。")?;
        let changed = state.set_hide_taskbar_button(enabled);
        (state.snapshot.clone(), changed)
    };
    if changed {
        publish(service, snapshot.clone());
        let _ = service.wake.try_send(());
    }
    Ok(snapshot)
}

/// Empties the panel's list; a pending reminder stays pending.
#[tauri::command]
pub fn clear_wechat_reminders() -> Result<ReminderSnapshot, String> {
    let service = service()?;
    let snapshot = {
        let mut state = service.state.lock().map_err(|_| "微信提醒状态不可用。")?;
        if state.snapshot.items.is_empty() {
            return Ok(state.snapshot.clone());
        }
        state.snapshot.items.clear();
        state.snapshot.revision += 1;
        state.snapshot.clone()
    };
    publish(service, snapshot.clone());
    Ok(snapshot)
}

/// Puts WeChat's byte and taskbar button back when the island exits.
pub(crate) fn shutdown() {
    if let Some(service) = SERVICE.get() {
        let _ = service.gate.lock().map(|mut gate| gate.off());
        let _ = service.button.lock().map(|mut button| button.restore());
    }
}

/// Keeps a minimized WeChat off the taskbar while the setting (and the chat list reading it is
/// for) is on.
fn keep_button(service: &ReminderService, executable: &Path) {
    let on = service.state.lock().is_ok_and(|state| {
        let snapshot = &state.snapshot;
        snapshot.enabled && snapshot.expose_ui && snapshot.hide_taskbar_button
    });
    if let Ok(mut button) = service.button.lock() {
        button.tick(on, || main_window(executable));
    }
}

/// Keeps WeChat's UI exposed while the setting asks for it, and tells the settings how it goes.
/// True when the island has just exposed it.
fn keep_gate(service: &ReminderService, executable: &Path) -> bool {
    let on = service
        .state
        .lock()
        .is_ok_and(|state| state.snapshot.enabled && state.snapshot.expose_ui);
    let Ok(mut gate) = service.gate.lock() else {
        return false;
    };
    let was_on = gate.is_on();
    if !gate.tick(on, || main_window(executable)) {
        return false;
    }
    let status = gate.status.clone();
    let now_on = gate.is_on();
    drop(gate);
    let snapshot = service.state.lock().ok().and_then(|mut state| {
        state
            .set_expose_status(status)
            .then(|| state.snapshot.clone())
    });
    if let Some(snapshot) = snapshot {
        publish(service, snapshot);
    }
    now_on && !was_on
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Changes the state with `change` and publishes it when that says something changed.
fn update(service: &ReminderService, change: impl FnOnce(&mut ReminderState) -> bool) {
    let snapshot = {
        let Ok(mut state) = service.state.lock() else {
            return;
        };
        if !change(&mut state) {
            return;
        }
        state.snapshot.clone()
    };
    publish(service, snapshot);
}

fn signal(service: &ReminderService, generation: u64, event: ReminderSignal) {
    update(service, |state| state.apply(generation, event, now_ms()));
}

/// WeChat's chat list as it is now, for the reader.
fn look(executable: &Path) -> Listing {
    let Some(window) = main_window(executable) else {
        return Listing::Unreadable;
    };
    match chats::read(window) {
        Some(rows) => Listing::Rows(rows),
        // Closed to the tray, WeChat hides its main window and lists no rows.
        None if !win32::window::is_visible(window) => Listing::Tray,
        None => Listing::Unreadable,
    }
}

fn connection(service: &ReminderService, generation: u64, error: Option<String>) {
    let snapshot = {
        let Ok(mut state) = service.state.lock() else {
            return;
        };
        if !state.snapshot.enabled || state.generation != generation {
            return;
        }
        let status = if error.is_some() {
            "error"
        } else {
            "listening"
        };
        if state.snapshot.status == status && state.snapshot.error == error {
            return;
        }
        state.snapshot.status = status.into();
        state.snapshot.error = error;
        state.snapshot.revision += 1;
        state.snapshot.clone()
    };
    publish(service, snapshot);
}

fn monitor(service: Arc<ReminderService>, receiver: mpsc::Receiver<()>) {
    loop {
        let (enabled, generation) = match service.state.lock() {
            Ok(state) => (state.snapshot.enabled, state.generation),
            Err(_) => return,
        };
        if !enabled {
            if receiver.recv().is_err() {
                return;
            }
            continue;
        }
        let events = Rc::new(RefCell::new(Vec::new()));
        let sink = events.clone();
        let listener = installed_executable().and_then(|executable| {
            ReminderListener::new(executable.clone(), move |event| {
                sink.borrow_mut().push(event)
            })
            .map(|listener| (listener, executable))
        });
        match listener {
            Ok((listener, executable)) => {
                connection(&service, generation, None);
                let allowed = || service.state.lock().is_ok_and(|state| state.snapshot.expose_ui);
                let mut reader = ChatReader::new(|| look(&executable), allowed());
                loop {
                    if !service
                        .state
                        .lock()
                        .is_ok_and(|state| state.snapshot.enabled && state.generation == generation)
                    {
                        // Reminders off: WeChat's UI goes back to hidden too.
                        keep_gate(&service, &executable);
                        keep_button(&service, &executable);
                        break;
                    }
                    if keep_gate(&service, &executable) {
                        // Readable from now on: take the list as it is as the baseline.
                        reader.rebaseline();
                    }
                    keep_button(&service, &executable);
                    reader.set_allowed(allowed());
                    listener.poll();
                    let _ = listener.stats();
                    let now = Instant::now();
                    for event in events.take() {
                        match event {
                            ReminderSignal::Attention => reader.flashed(now),
                            ReminderSignal::ActivatedElsewhere => reader.activated(false, now),
                            ReminderSignal::Activated => {
                                reader.activated(true, now);
                                signal(&service, generation, event);
                            }
                            _ => signal(&service, generation, event),
                        }
                    }
                    match reader.tick(now) {
                        Some(Flash::Plain(reason)) => update(&service, |state| {
                            state.remind(generation, now_ms(), reason)
                        }),
                        Some(Flash::Messages(fresh)) => {
                            let at = now_ms();
                            for (index, chat) in fresh.into_iter().enumerate() {
                                let message = ChatMessage {
                                    chat: chat.key,
                                    contact: chat.contact,
                                    preview: chat.preview,
                                    unread: chat.unread,
                                    at: at + index as u64,
                                };
                                update(&service, |state| state.receive(generation, message));
                            }
                        }
                        None => {}
                    }
                    if receiver.recv_timeout(Duration::from_millis(50))
                        == Err(mpsc::RecvTimeoutError::Disconnected)
                    {
                        return;
                    }
                }
            }
            Err(error) => {
                connection(&service, generation, Some(error));
                if receiver.recv_timeout(Duration::from_secs(5))
                    == Err(mpsc::RecvTimeoutError::Disconnected)
                {
                    return;
                }
            }
        }
    }
}

/// Brings WeChat up; with `chat` (a `ChatMessage`'s) it also opens that chat when its row is in
/// view, otherwise WeChat stays on the chat it showed last.
#[tauri::command]
pub async fn open_wechat(chat: Option<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let executable = installed_executable()?;
        if activate_existing_wechat(&executable)? {
            if let Some(chat) = chat {
                // A window just restored lays its list out a moment later.
                thread::sleep(Duration::from_millis(300));
                let opened = main_window(&executable)
                    .ok_or("no main window")
                    .and_then(|window| chats::open(window, &chat));
                if let Err(why) = opened {
                    eprintln!("WeChat reminders: could not open the chat ({why}); WeChat shows its last chat");
                }
            }
            return Ok(());
        }
        Err("未找到正在运行的微信窗口，请先打开并登录桌面版微信。".into())
    })
    .await
    .map_err(|error| format!("打开微信的线程失败：{error}"))?
}

struct WeChatWindow {
    handle: HWND,
    started_at: u64,
    main_sized: bool,
    visible: bool,
}

struct WindowSearch {
    executable: String,
    found: Vec<WeChatWindow>,
    running: bool,
}

fn preferred_window(windows: &[WeChatWindow]) -> Option<&WeChatWindow> {
    // Only full main windows qualify; prefer the visible window, then the older instance.
    windows
        .iter()
        .filter(|window| window.main_sized)
        .min_by_key(|window| (!window.visible, window.started_at))
}

fn find_wechat_window(search: &mut WindowSearch, window: HWND) {
    let process_id = win32::process::window_process_id(window);
    let Some(path) = win32::process::image_path(process_id) else {
        return;
    };
    if !path.eq_ignore_ascii_case(&search.executable) {
        return;
    }
    let started_at = win32::process_times::start_time(process_id).unwrap_or(u64::MAX);
    search.running = true;
    let title = win32::window::window_text(window, 32);
    if !["微信", "WeChat", "Weixin"].contains(&title.as_str()) {
        return;
    }
    let main_sized = win32::window::normal_position(window).is_some_and(|position| {
        position.right - position.left >= 500 && position.bottom - position.top >= 300
    });
    search.found.push(WeChatWindow {
        handle: window,
        started_at,
        main_sized,
        visible: win32::window::is_visible(window),
    });
}

fn main_window(executable: &Path) -> Option<HWND> {
    let search = existing_wechat_windows(executable).ok()?;
    preferred_window(&search.found).map(|window| window.handle)
}

fn existing_wechat_windows(executable: &std::path::Path) -> Result<WindowSearch, String> {
    let mut search = WindowSearch {
        executable: executable.to_string_lossy().into_owned(),
        found: Vec::new(),
        running: false,
    };
    win32::window::for_each_top_level_window(|window| find_wechat_window(&mut search, window))
        .map_err(|error| format!("无法查找已运行的微信窗口：{error}"))?;
    Ok(search)
}

fn activate_existing_wechat(executable: &std::path::Path) -> Result<bool, String> {
    let search = existing_wechat_windows(executable)?;
    if !search.running {
        return Ok(false);
    }
    let original = preferred_window(&search.found)
        .ok_or("微信已在运行，但未定位到主窗口，请先从系统托盘打开并登录微信。")?;
    let expected_process = win32::process::window_process_id(original.handle);
    // The registered handler restores Qt's own UI state. Showing its HWND directly can leave it blank.
    tauri_plugin_opener::open_url("weixin://", None::<&str>).map_err(|error| {
        format!("无法通过微信注册入口唤回客户端，请从系统托盘打开微信：{error}")
    })?;
    for _ in 0..40 {
        thread::sleep(Duration::from_millis(50));
        let current = existing_wechat_windows(executable)?;
        if let Some(window) = preferred_window(&current.found) {
            let process_id = win32::process::window_process_id(window.handle);
            if process_id == expected_process
                && window.visible
                && !win32::window::is_minimized(window.handle)
            {
                return Ok(true);
            }
        }
    }
    Err("微信未能恢复原来的主窗口，请双击系统托盘中的微信图标。".into())
}

/// This module's Tauri commands. `lib.rs` chains every module's list into one
/// `generate_handler!`, so adding a command only touches this file.
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
