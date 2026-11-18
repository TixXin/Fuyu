use std::sync::{Arc, Mutex, OnceLock, PoisonError};

use serde_json::{Map, Value};
use tauri::{AppHandle, Emitter, Manager};

use crate::plugin_kernel::builtins::{self, Background};

const PLUGIN_ID: &str = "todos";
const SHORTCUT_BACKGROUND: &str = "shortcuts";
const SHORTCUT_KEY: &str = "quickAddShortcut";
const SHORTCUT_EVENT: &str = "todo-quick-add-shortcut";
const SHORTCUT_STATUS_EVENT: &str = "todo-shortcut-status";

static APP: OnceLock<AppHandle> = OnceLock::new();
static PROBLEM: Mutex<Option<&'static str>> = Mutex::new(None);

fn shortcut_of(config: &Map<String, Value>) -> Option<String> {
    match config.get(SHORTCUT_KEY) {
        Some(Value::String(shortcut)) => Some(shortcut.trim().to_owned()).filter(|shortcut| !shortcut.is_empty()),
        _ => None,
    }
}

struct Shortcut;

impl Background for Shortcut {
    fn start(&self) -> Result<(), String> {
        super::hotkey::start(shortcut_of(&builtins::config(PLUGIN_ID)))
    }

    fn stop(&self) {
        super::hotkey::stop();
    }

    fn running(&self) -> bool {
        super::hotkey::running()
    }

    fn configure(&self, config: &Map<String, Value>) {
        if super::hotkey::running() {
            super::hotkey::configure(shortcut_of(config));
        }
    }
}

pub(super) fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
    if let Err(error) = builtins::register(PLUGIN_ID, SHORTCUT_BACKGROUND, Arc::new(Shortcut)) {
        eprintln!("the todo quick-add shortcut is unavailable: {error}");
    }
}

#[cfg(target_os = "macos")]
pub(super) fn app() -> Option<&'static AppHandle> {
    APP.get()
}

pub(super) fn pressed() {
    if !builtins::is_enabled(PLUGIN_ID) {
        return;
    }
    let Some(app) = APP.get() else {
        return;
    };
    if let Some(window) = app.get_webview_window(crate::island::WINDOW_LABEL) {
        let _ = window.show();
        crate::island::focus::focus_island_for_shortcut(&window);
    }
    let _ = app.emit_to(crate::island::WINDOW_LABEL, SHORTCUT_EVENT, ());
}

pub(super) fn report(problem: Option<&'static str>) {
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
    super::hotkey::refresh_later();
}

pub(super) fn problem() -> Option<&'static str> {
    *PROBLEM.lock().unwrap_or_else(PoisonError::into_inner)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn config(value: Value) -> Map<String, Value> {
        value.as_object().cloned().unwrap()
    }

    #[test]
    fn the_quick_add_shortcut_defaults_to_none_and_trims_or_clears() {
        assert_eq!(shortcut_of(&Map::new()), None);
        assert_eq!(shortcut_of(&config(json!({ "quickAddShortcut": " Alt+Shift+T " }))).as_deref(), Some("Alt+Shift+T"));
        assert_eq!(shortcut_of(&config(json!({ "quickAddShortcut": "" }))), None);
        assert_eq!(shortcut_of(&config(json!({ "quickAddShortcut": "   " }))), None);
        assert_eq!(shortcut_of(&config(json!({ "quickAddShortcut": 3 }))), None);
    }

    #[test]
    fn the_shortcut_is_the_background_listed_for_todos() {
        let catalog = crate::plugin_kernel::builtins::catalog();
        let todos = catalog.iter().find(|plugin| plugin.id == PLUGIN_ID).expect("todos is a built-in plugin");
        assert_eq!(todos.background.as_deref(), Some(&[SHORTCUT_BACKGROUND.to_owned()][..]));
    }
}
