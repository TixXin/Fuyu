use std::sync::{Mutex, OnceLock, PoisonError};

use tauri::{AppHandle, Emitter};

const SHORTCUT_EVENT: &str = "island-expand-shortcut";
const SHORTCUT_STATUS_EVENT: &str = "island-expand-shortcut-status";

static APP: OnceLock<AppHandle> = OnceLock::new();
static PROBLEM: Mutex<Option<&'static str>> = Mutex::new(None);

#[cfg(target_os = "macos")]
pub(super) fn app() -> Option<&'static AppHandle> {
    APP.get()
}

fn should_prepare_to_open(user_hidden: bool, behind: bool, expanded: bool) -> bool {
    user_hidden || behind || !expanded
}

pub(super) fn pressed() {
    let Some(app) = APP.get() else {
        return;
    };
    let expanded = matches!(super::read_window_state().mode, super::state::IslandMode::Expanded);
    if should_prepare_to_open(super::user_hidden(), super::layer::behind(app), expanded) {
        super::prepare_for_shortcut(app);
    }
    let _ = app.emit_to(super::WINDOW_LABEL, SHORTCUT_EVENT, ());
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

fn shortcut_of(shortcut: Option<String>) -> Option<String> {
    shortcut.map(|shortcut| shortcut.trim().to_owned()).filter(|shortcut| !shortcut.is_empty())
}

#[cfg(windows)]
pub(crate) fn coexist_refresh() {
    super::expand_hotkey::refresh_later();
}

#[tauri::command]
pub fn set_island_expand_shortcut(app: AppHandle, shortcut: Option<String>) -> Result<(), String> {
    let _ = APP.set(app);
    super::expand_hotkey::configure(shortcut_of(shortcut))
}

#[tauri::command]
pub fn get_island_expand_shortcut_problem() -> Option<&'static str> {
    *PROBLEM.lock().unwrap_or_else(PoisonError::into_inner)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_blank_shortcut_switches_the_expand_toggle_off() {
        assert_eq!(shortcut_of(None), None);
        assert_eq!(shortcut_of(Some("   ".into())), None);
        assert_eq!(shortcut_of(Some(" Ctrl+Alt+Space ".into())).as_deref(), Some("Ctrl+Alt+Space"));
    }

    #[test]
    fn only_a_visible_front_expanded_island_skips_focus_preparation() {
        assert!(!should_prepare_to_open(false, false, true));
        assert!(should_prepare_to_open(false, false, false));
        assert!(should_prepare_to_open(true, false, true));
        assert!(should_prepare_to_open(false, true, true));
    }
}
