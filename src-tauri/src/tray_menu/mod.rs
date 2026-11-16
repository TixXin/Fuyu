mod place;
mod window;

use std::sync::{Mutex, PoisonError};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::{island, settings_window, translation};

pub(crate) use window::{hide, prebuild, toggle, WINDOW_LABEL};

const STATE_EVENT: &str = "tray-menu-state";
const OPEN_PAGE_EVENT: &str = "tray-menu-open-page";
const PAGES: [&str; 5] = ["todo", "notes", "calendar", "file-shelf", "agent"];
const UPDATE_STAGES: [&str; 3] = ["available", "downloading", "ready"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayMenuState {
    island_visible: bool,
    clipboard_paused: bool,
    translate_enabled: bool,
    screenshot_enabled: bool,
    version: String,
    update_available: Option<String>,
    platform: &'static str,
}

static LAST_PUSHED: Mutex<Option<TrayMenuState>> = Mutex::new(None);

fn update_available() -> Option<String> {
    let snapshot = serde_json::to_value(crate::system::update_runtime::updater_state()).ok()?;
    let stage = snapshot.get("stage")?.as_str()?;
    let version = snapshot.get("nextVersion")?.as_str()?;
    (UPDATE_STAGES.contains(&stage) && !version.is_empty()).then(|| version.to_string())
}

fn current(app: &AppHandle) -> TrayMenuState {
    TrayMenuState {
        island_visible: crate::tray::island_visible(app),
        clipboard_paused: crate::clipboard_history::clipboard_capture_paused(),
        translate_enabled: translation::is_enabled(),
        screenshot_enabled: crate::screenshot::is_enabled(),
        version: app.package_info().version.to_string(),
        update_available: update_available(),
        platform: if cfg!(target_os = "macos") { "macos" } else { "windows" },
    }
}

pub(crate) fn push_state(app: &AppHandle) {
    if window::card_window(app).is_none() {
        return;
    }
    let next = current(app);
    let mut last = LAST_PUSHED.lock().unwrap_or_else(PoisonError::into_inner);
    if last.as_ref() == Some(&next) {
        return;
    }
    let _ = app.emit_to(WINDOW_LABEL, STATE_EVENT, &next);
    *last = Some(next);
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Action {
    ToggleIsland,
    Screenshot,
    Translate,
    Clipboard,
    ToggleClipboardPause,
    OpenPage(&'static str),
    OpenSettings,
    Update,
    Restart,
    Quit,
    Close,
}

fn parse_action(action: &str, arg: Option<&str>) -> Result<Action, String> {
    Ok(match action {
        "toggle_island" => Action::ToggleIsland,
        "screenshot" => Action::Screenshot,
        "translate" => Action::Translate,
        "clipboard" => Action::Clipboard,
        "toggle_clipboard_pause" => Action::ToggleClipboardPause,
        "open_page" => {
            let page = arg.and_then(|arg| PAGES.iter().find(|page| **page == arg)).ok_or_else(|| format!("Unknown island page: {}", arg.unwrap_or("")))?;
            Action::OpenPage(page)
        }
        "open_settings" => Action::OpenSettings,
        "update" => Action::Update,
        "restart" => Action::Restart,
        "quit" => Action::Quit,
        "close" => Action::Close,
        other => return Err(format!("Unknown tray card action: {other}")),
    })
}

fn keeps_card_open(action: Action) -> bool {
    matches!(action, Action::ToggleIsland | Action::ToggleClipboardPause)
}

fn open_settings(app: &AppHandle, section: Option<&str>) {
    if let (Some(section), Ok(window)) = (section, island::main_window(app)) {
        let request = format!(r#"localStorage.setItem("fuyu-settings-focus", JSON.stringify({{ section: "{section}", requestedAt: Date.now() }}))"#);
        if let Err(error) = window.eval(request) {
            eprintln!("failed to ask settings for the {section} page: {error}");
        }
    }
    if let Err(error) = settings_window::open(app) {
        eprintln!("failed to open settings window: {error}");
    }
}

fn run(app: &AppHandle, action: Action) {
    if !keeps_card_open(action) {
        hide(app);
    }
    match action {
        Action::ToggleIsland => crate::tray::toggle_island(app),
        Action::Screenshot => crate::screenshot::start_from_tray(app),
        Action::Translate => translation::open_translator(app),
        Action::Clipboard => crate::clipboard_history::open_from_tray(),
        Action::ToggleClipboardPause => {
            crate::clipboard_history::actions::toggle_capture_pause();
            crate::tray::refresh_now(app);
        }
        Action::OpenPage(page) => {
            let _ = island::show_island(app);
            let _ = app.emit_to(island::WINDOW_LABEL, OPEN_PAGE_EVENT, page);
        }
        Action::OpenSettings => open_settings(app, None),
        Action::Update => open_settings(app, Some("updates")),
        Action::Restart => {
            settings_window::remember_bounds(app);
            app.restart();
        }
        Action::Quit => {
            settings_window::remember_bounds(app);
            app.exit(0);
        }
        Action::Close => {}
    }
}

#[tauri::command]
pub async fn tray_menu_state(app: AppHandle) -> TrayMenuState {
    let state = current(&app);
    *LAST_PUSHED.lock().unwrap_or_else(PoisonError::into_inner) = Some(state.clone());
    state
}

#[tauri::command]
pub async fn tray_menu_action(app: AppHandle, action: String, arg: Option<String>) -> Result<(), String> {
    let action = parse_action(&action, arg.as_deref())?;
    run(&app, action);
    Ok(())
}

#[tauri::command]
pub async fn tray_menu_resize(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    window::resize(&app, width, height)
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::tray_menu::tray_menu_state,
            crate::tray_menu::tray_menu_action,
            crate::tray_menu::tray_menu_resize,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::{keeps_card_open, parse_action, Action};

    #[test]
    fn actions_parse_by_name_and_pages_are_checked() {
        assert_eq!(parse_action("toggle_island", None), Ok(Action::ToggleIsland));
        assert_eq!(parse_action("open_page", Some("calendar")), Ok(Action::OpenPage("calendar")));
        assert_eq!(parse_action("open_page", Some("file-shelf")), Ok(Action::OpenPage("file-shelf")));
        assert!(parse_action("open_page", Some("settings")).is_err());
        assert!(parse_action("open_page", None).is_err());
        assert!(parse_action("format_disk", None).is_err());
        assert_eq!(parse_action("close", Some("ignored")), Ok(Action::Close));
    }

    #[test]
    fn only_switches_keep_the_card_open() {
        assert!(keeps_card_open(Action::ToggleIsland));
        assert!(keeps_card_open(Action::ToggleClipboardPause));
        for action in [Action::Screenshot, Action::Translate, Action::Clipboard, Action::OpenSettings, Action::Update, Action::Restart, Action::Quit, Action::Close] {
            assert!(!keeps_card_open(action));
        }
    }
}
