#[cfg_attr(target_os = "macos", path = "hotkey_macos.rs")]
mod hotkey;

use std::sync::{Arc, Mutex, OnceLock, PoisonError};

use serde_json::{Map, Value};
use tauri::{AppHandle, Emitter};

use crate::plugin_kernel::builtins::{self, Background};

const PLUGIN_ID: &str = "timer";
const SHORTCUT_BACKGROUND: &str = "shortcut";
const SHORTCUT_KEY: &str = "shortcut";
const DEFAULT_SHORTCUT: &str = "Ctrl+Alt+K";
const SHORTCUT_EVENT: &str = "timer-shortcut";
const SHORTCUT_STATUS_EVENT: &str = "timer-shortcut-status";

static APP: OnceLock<AppHandle> = OnceLock::new();
static PROBLEM: Mutex<Option<&'static str>> = Mutex::new(None);

fn shortcut_of(config: &Map<String, Value>) -> Option<String> {
    match config.get(SHORTCUT_KEY) {
        Some(Value::String(shortcut)) => Some(shortcut.trim().to_owned()).filter(|shortcut| !shortcut.is_empty()),
        _ => Some(DEFAULT_SHORTCUT.to_owned()),
    }
}

struct Shortcut;

impl Background for Shortcut {
    fn start(&self) -> Result<(), String> {
        hotkey::start(shortcut_of(&builtins::config(PLUGIN_ID)))
    }

    fn stop(&self) {
        hotkey::stop();
    }

    fn running(&self) -> bool {
        hotkey::running()
    }

    fn configure(&self, config: &Map<String, Value>) {
        if hotkey::running() {
            hotkey::configure(shortcut_of(config));
        }
    }
}

pub(crate) fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
    if let Err(error) = builtins::register(PLUGIN_ID, SHORTCUT_BACKGROUND, Arc::new(Shortcut)) {
        eprintln!("the timer shortcut is unavailable: {error}");
    }
}

fn pressed() {
    if let Some(app) = APP.get() {
        let _ = app.emit_to(crate::island::WINDOW_LABEL, SHORTCUT_EVENT, ());
    }
}

fn report(problem: Option<&'static str>) {
    let changed = {
        let mut slot = PROBLEM.lock().unwrap_or_else(PoisonError::into_inner);
        std::mem::replace(&mut *slot, problem) != problem
    };
    if let (true, Some(app)) = (changed, APP.get()) {
        let _ = app.emit(SHORTCUT_STATUS_EVENT, problem);
    }
}

#[cfg(windows)]
pub(crate) fn coexist_refresh() {
    hotkey::refresh_later();
}

#[tauri::command]
pub(crate) fn get_timer_shortcut_problem() -> Option<&'static str> {
    *PROBLEM.lock().unwrap_or_else(PoisonError::into_inner)
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::timer::get_timer_shortcut_problem,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn config(value: Value) -> Map<String, Value> {
        value.as_object().cloned().unwrap()
    }

    #[test]
    fn the_shortcut_defaults_to_ctrl_alt_k_and_can_be_switched_off() {
        assert_eq!(shortcut_of(&Map::new()).as_deref(), Some("Ctrl+Alt+K"));
        assert_eq!(shortcut_of(&config(json!({ "shortcut": " Ctrl+Shift+T " }))).as_deref(), Some("Ctrl+Shift+T"));
        assert_eq!(shortcut_of(&config(json!({ "shortcut": "" }))), None);
        assert_eq!(shortcut_of(&config(json!({ "shortcut": 3 }))).as_deref(), Some("Ctrl+Alt+K"));
    }
}
