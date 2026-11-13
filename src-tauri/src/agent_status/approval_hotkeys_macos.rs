use serde::Deserialize;
use serde_json::json;
use std::sync::{Mutex, MutexGuard, OnceLock, PoisonError};
use tauri::{AppHandle, Emitter};

use global_hotkey::hotkey::HotKey;

use crate::{
    clipboard_history::{parse_shortcut_binding, to_hotkey},
    island,
    macos::hotkeys,
};

const HOTKEY_EVENT: &str = "agent-approval-hotkey";

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct ApprovalHotkey {
    action: String,
    shortcut: String,
}

#[derive(Default)]
struct State {
    app: Option<AppHandle>,
    wanted: Vec<ApprovalHotkey>,
    registered: Vec<HotKey>,
}

fn state() -> MutexGuard<'static, State> {
    static STATE: OnceLock<Mutex<State>> = OnceLock::new();
    STATE.get_or_init(Mutex::default).lock().unwrap_or_else(PoisonError::into_inner)
}

#[tauri::command]
pub fn set_agent_approval_hotkeys(app: AppHandle, hotkeys: Vec<ApprovalHotkey>) {
    {
        let mut state = state();
        if state.wanted == hotkeys {
            return;
        }
        state.wanted = hotkeys;
        state.app.get_or_insert(app.clone());
    }
    let _ = app.run_on_main_thread(apply);
}

fn apply() {
    let (old, wanted, app) = {
        let mut state = state();
        (std::mem::take(&mut state.registered), state.wanted.clone(), state.app.clone())
    };
    for hotkey in old {
        hotkeys::unregister(hotkey);
    }
    let mut registered = Vec::new();
    for wanted in wanted {
        let Some(hotkey) = parse_shortcut_binding(&wanted.shortcut).as_ref().and_then(to_hotkey) else { continue };
        let app = app.clone();
        let action = wanted.action;
        let pressed = move || {
            if let Some(app) = &app {
                let _ = app.emit_to(island::WINDOW_LABEL, HOTKEY_EVENT, json!({ "action": action }));
            }
        };
        if hotkeys::register(hotkey, pressed).is_ok() {
            registered.push(hotkey);
        }
    }
    state().registered = registered;
}
