use serde::Deserialize;
use serde_json::json;
use std::{
    sync::{Mutex, MutexGuard, OnceLock, PoisonError},
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{WM_APP, WM_HOTKEY, WM_QUIT},
};

use crate::{
    clipboard_history::parse_shortcut_binding,
    island,
    win32::{
        self,
        message_window::{self, WindowMessages},
    },
};

const HOTKEY_EVENT: &str = "agent-approval-hotkey";
const REFRESH_MESSAGE: u32 = WM_APP + 0x63;
const FIRST_HOTKEY_ID: i32 = 0x5300;
const CLASS_NAME: &str = "FuyuAgentApprovalHotkeys";
const READY_WAIT: Duration = Duration::from_secs(2);

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct ApprovalHotkey {
    action: String,
    shortcut: String,
}

#[derive(Default)]
struct State {
    app: Option<AppHandle>,
    window: Option<isize>,
    thread: Option<JoinHandle<()>>,
    wanted: Vec<ApprovalHotkey>,
    registered: Vec<String>,
}

fn state() -> MutexGuard<'static, State> {
    static STATE: OnceLock<Mutex<State>> = OnceLock::new();
    STATE.get_or_init(Mutex::default).lock().unwrap_or_else(PoisonError::into_inner)
}

#[tauri::command]
pub fn set_agent_approval_hotkeys(app: AppHandle, hotkeys: Vec<ApprovalHotkey>) {
    let window = {
        let mut state = state();
        if state.wanted == hotkeys {
            return;
        }
        state.wanted = hotkeys;
        state.app.get_or_insert(app);
        state.window
    };
    if !super::background::switched_on() {
        return;
    }
    match window {
        Some(window) => {
            let _ = message_window::post_message(HWND(window as *mut _), REFRESH_MESSAGE);
        }
        None => start(),
    }
}

pub(super) fn start() {
    let mut state = state();
    if state.wanted.is_empty() || state.thread.as_ref().is_some_and(|thread| !thread.is_finished()) {
        return;
    }
    if let Some(finished) = state.thread.take() {
        let _ = finished.join();
    }
    match thread::Builder::new().name("agent-approval-hotkeys".into()).spawn(run_window) {
        Ok(thread) => state.thread = Some(thread),
        Err(error) => eprintln!("could not start the agent approval shortcuts: {error}"),
    }
}

pub(super) fn stop() {
    let Some(thread) = state().thread.take() else { return };
    let asked = Instant::now();
    while !thread.is_finished() {
        let window = state().window;
        if let Some(window) = window {
            let _ = message_window::post_message(HWND(window as *mut _), WM_QUIT);
            break;
        }
        if asked.elapsed() >= READY_WAIT {
            eprintln!("the agent approval shortcut thread did not get ready, so it is left to finish on its own");
            return;
        }
        thread::sleep(Duration::from_millis(10));
    }
    let _ = thread.join();
}

pub(super) fn running() -> bool {
    state().thread.as_ref().is_some_and(|thread| !thread.is_finished())
}

pub(crate) fn coexist_refresh() {
    let window = state().window;
    if let Some(window) = window {
        let _ = message_window::post_message(HWND(window as *mut _), REFRESH_MESSAGE);
    }
}

fn run_window() {
    let Ok(instance) = message_window::module_instance() else { return };
    if message_window::register_class::<ApprovalHotkeyWindow>(instance, CLASS_NAME).is_err() {
        return;
    }
    let Ok(window) = message_window::create_message_only_window(instance, CLASS_NAME, "Fuyu Agent Approval Hotkeys") else {
        let _ = message_window::unregister_class(instance, CLASS_NAME);
        return;
    };
    state().window = Some(window.0 as isize);
    apply(window);
    message_window::run_message_loop();
    {
        let mut state = state();
        state.window = None;
        for index in 0..state.registered.len() {
            let _ = win32::hotkey::unregister(window, FIRST_HOTKEY_ID + index as i32);
        }
        state.registered.clear();
    }
    let _ = message_window::destroy_window(window);
    let _ = message_window::unregister_class(instance, CLASS_NAME);
}

fn apply(window: HWND) {
    let mut state = state();
    for index in 0..state.registered.len() {
        let _ = win32::hotkey::unregister(window, FIRST_HOTKEY_ID + index as i32);
    }
    state.registered.clear();
    let wanted = if crate::coexist::yielding() { Vec::new() } else { state.wanted.clone() };
    for hotkey in wanted {
        let Some(binding) = parse_shortcut_binding(&hotkey.shortcut) else { continue };
        let id = FIRST_HOTKEY_ID + state.registered.len() as i32;
        if win32::hotkey::register(window, id, binding.modifiers, binding.key_code).is_ok() {
            state.registered.push(hotkey.action);
        }
    }
}

fn pressed(id: usize) {
    let state = state();
    let Some(action) = id.checked_sub(FIRST_HOTKEY_ID as usize).and_then(|index| state.registered.get(index)) else {
        return;
    };
    if let Some(app) = &state.app {
        let _ = app.emit_to(island::WINDOW_LABEL, HOTKEY_EVENT, json!({ "action": action }));
    }
}

struct ApprovalHotkeyWindow;

impl WindowMessages for ApprovalHotkeyWindow {
    fn handle(window: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> Option<LRESULT> {
        if message == WM_HOTKEY && crate::shortcut_capture::capture_hotkey_message(lparam.0) {
            return Some(LRESULT(0));
        }
        match message {
            WM_HOTKEY => pressed(wparam.0),
            REFRESH_MESSAGE => apply(window),
            _ => return None,
        }
        Some(LRESULT(0))
    }
}
