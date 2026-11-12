use std::sync::{
    atomic::{AtomicBool, AtomicIsize, Ordering},
    Mutex, OnceLock, PoisonError,
};
use std::thread;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{WM_APP, WM_HOTKEY},
};

use super::session::{self, Mode};
use crate::clipboard_history::shortcut::parse_shortcut_binding;
use crate::win32::{
    self,
    message_window::{self, WindowMessages},
};

const HOTKEY_BASE: i32 = 0x5300;
const MAX_BINDINGS: usize = 16;
const REFRESH_MESSAGE: u32 = WM_APP + 0x61;
const NUMPAD_MESSAGE: u32 = WM_APP + 0x62;
const PRINT_MESSAGE: u32 = WM_APP + 0x63;
const MOD_CONTROL_SHIFT: u32 = 0x0002 | 0x0004;
pub(super) const STATUS_EVENT: &str = "screenshot-shortcut-status";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ShortcutAction {
    Region,
    Copy,
    Text,
    Translate,
    Fullscreen,
    Pins,
}

impl ShortcutAction {
    fn mode(self) -> Option<Mode> {
        match self {
            Self::Region => Some(Mode::Region),
            Self::Copy => Some(Mode::Copy),
            Self::Text => Some(Mode::Text),
            Self::Translate => Some(Mode::Translate),
            Self::Fullscreen => Some(Mode::Fullscreen),
            Self::Pins => None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShortcutConfig {
    pub(crate) action: ShortcutAction,
    pub(crate) shortcut: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShortcutStatus {
    pub(crate) action: ShortcutAction,
    pub(crate) problem: &'static str,
}

pub(crate) fn default_shortcuts() -> Vec<ShortcutConfig> {
    [(ShortcutAction::Region, "Ctrl+Shift+1"), (ShortcutAction::Copy, "Ctrl+Shift+2"), (ShortcutAction::Text, "Ctrl+Shift+3"), (ShortcutAction::Translate, "Ctrl+Shift+4"), (ShortcutAction::Fullscreen, "Ctrl+Shift+7")]
        .into_iter()
        .map(|(action, shortcut)| ShortcutConfig { action, shortcut: shortcut.to_string() })
        .collect()
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Binding {
    pub(crate) action: ShortcutAction,
    pub(crate) modifiers: u32,
    pub(crate) key_code: u32,
}

pub(crate) fn plan(config: &[ShortcutConfig]) -> (Vec<Binding>, Vec<ShortcutStatus>) {
    let mut bindings: Vec<Binding> = Vec::new();
    let mut problems = Vec::new();
    for entry in config.iter().take(MAX_BINDINGS) {
        if entry.shortcut.trim().is_empty() {
            continue;
        }
        let Some(binding) = parse_shortcut_binding(&entry.shortcut) else {
            problems.push(ShortcutStatus { action: entry.action, problem: "invalid" });
            continue;
        };
        if bindings.iter().any(|known| known.modifiers == binding.modifiers && known.key_code == binding.key_code) {
            problems.push(ShortcutStatus { action: entry.action, problem: "duplicate" });
            continue;
        }
        bindings.push(Binding { action: entry.action, modifiers: binding.modifiers, key_code: binding.key_code });
    }
    (bindings, problems)
}

pub(crate) fn numpad_digit(binding: &Binding) -> Option<u32> {
    let digit = binding.key_code.checked_sub(u32::from(b'0')).filter(|digit| *digit <= 9)?;
    (binding.modifiers == MOD_CONTROL_SHIFT).then_some(digit)
}

static APP: OnceLock<AppHandle> = OnceLock::new();
static WINDOW: AtomicIsize = AtomicIsize::new(0);
static ENABLED: AtomicBool = AtomicBool::new(false);
static PRINT_SCREEN: AtomicBool = AtomicBool::new(false);
static CONFIG: Mutex<Option<Vec<ShortcutConfig>>> = Mutex::new(None);
static BOUND: Mutex<Vec<Binding>> = Mutex::new(Vec::new());
static STATUS: Mutex<Vec<ShortcutStatus>> = Mutex::new(Vec::new());

pub(super) fn start(app: &AppHandle) {
    let _ = APP.set(app.clone());
    thread::spawn(|| {
        if let Err(error) = run() {
            eprintln!("screenshot shortcuts are unavailable: {error}");
        }
    });
}

pub(super) fn is_enabled() -> bool {
    ENABLED.load(Ordering::SeqCst)
}

pub(super) fn configure(enabled: bool, shortcuts: Option<Vec<ShortcutConfig>>, print_screen: Option<bool>) {
    if let Some(shortcuts) = shortcuts {
        *CONFIG.lock().unwrap_or_else(PoisonError::into_inner) = Some(shortcuts);
    }
    if let Some(print_screen) = print_screen {
        PRINT_SCREEN.store(print_screen, Ordering::SeqCst);
    }
    ENABLED.store(enabled, Ordering::SeqCst);
    let window = WINDOW.load(Ordering::SeqCst);
    if window != 0 {
        let _ = message_window::post_message(HWND(window as *mut core::ffi::c_void), REFRESH_MESSAGE);
    }
}

pub(super) fn status() -> Vec<ShortcutStatus> {
    STATUS.lock().unwrap_or_else(PoisonError::into_inner).clone()
}

fn run() -> Result<(), String> {
    let class = "FuyuScreenshotShortcuts";
    let instance = message_window::module_instance().map_err(|error| error.to_string())?;
    message_window::register_class::<ShortcutWindow>(instance, class).map_err(|error| error.to_string())?;
    let window = message_window::create_message_only_window(instance, class, "Fuyu Screenshot Shortcuts").map_err(|error| error.to_string())?;
    WINDOW.store(window.0 as isize, Ordering::SeqCst);
    refresh(window);
    message_window::run_message_loop();
    release(window);
    Ok(())
}

fn release(window: HWND) {
    let _ = win32::win_key_hook::set_numpad(None);
    let _ = win32::win_key_hook::set_print_screen(None);
    for index in 0..MAX_BINDINGS {
        let _ = win32::hotkey::unregister(window, HOTKEY_BASE + index as i32);
    }
    BOUND.lock().unwrap_or_else(PoisonError::into_inner).clear();
}

fn refresh(window: HWND) {
    release(window);
    let mut problems = Vec::new();
    if ENABLED.load(Ordering::SeqCst) {
        let config = CONFIG.lock().unwrap_or_else(PoisonError::into_inner).clone().unwrap_or_else(default_shortcuts);
        let (bindings, invalid) = plan(&config);
        problems = invalid;
        let mut numpad = 0;
        for (index, binding) in bindings.iter().enumerate() {
            if win32::hotkey::register(window, HOTKEY_BASE + index as i32, binding.modifiers, binding.key_code).is_err() {
                problems.push(ShortcutStatus { action: binding.action, problem: "taken" });
            }
            if let Some(digit) = numpad_digit(binding) {
                numpad |= 1 << digit;
            }
        }
        *BOUND.lock().unwrap_or_else(PoisonError::into_inner) = bindings;
        if numpad != 0 {
            if let Err(error) = win32::win_key_hook::set_numpad(Some((window, NUMPAD_MESSAGE, numpad))) {
                eprintln!("the numpad screenshot shortcuts are unavailable: {error}");
            }
        }
        if PRINT_SCREEN.load(Ordering::SeqCst) {
            if let Err(error) = win32::win_key_hook::set_print_screen(Some((window, PRINT_MESSAGE))) {
                eprintln!("PrintScreen cannot be taken over: {error}");
            }
        }
    }
    *STATUS.lock().unwrap_or_else(PoisonError::into_inner) = problems.clone();
    if let Some(app) = APP.get() {
        let _ = app.emit(STATUS_EVENT, problems);
    }
}

fn bound_action(found: impl Fn(&Binding) -> bool) -> Option<ShortcutAction> {
    BOUND.lock().unwrap_or_else(PoisonError::into_inner).iter().find(|binding| found(binding)).map(|binding| binding.action)
}

fn run_action(action: ShortcutAction) {
    let Some(app) = APP.get() else { return };
    if !ENABLED.load(Ordering::SeqCst) {
        return;
    }
    match action.mode() {
        Some(mode) => session::start(app, mode),
        None => super::pin::toggle_all(app),
    }
}

struct ShortcutWindow;

impl WindowMessages for ShortcutWindow {
    fn handle(window: HWND, message: u32, wparam: WPARAM, _: LPARAM) -> Option<LRESULT> {
        let action = match message {
            WM_HOTKEY => {
                let index = wparam.0.checked_sub(HOTKEY_BASE as usize);
                index.and_then(|index| BOUND.lock().unwrap_or_else(PoisonError::into_inner).get(index).map(|binding| binding.action))
            }
            NUMPAD_MESSAGE => u32::try_from(wparam.0).ok().and_then(|digit| bound_action(|binding| numpad_digit(binding) == Some(digit))),
            PRINT_MESSAGE => Some(ShortcutAction::Region),
            REFRESH_MESSAGE => {
                refresh(window);
                return Some(LRESULT(0));
            }
            _ => return None,
        };
        if let Some(action) = action {
            run_action(action);
        }
        Some(LRESULT(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(action: ShortcutAction, shortcut: &str) -> ShortcutConfig {
        ShortcutConfig { action, shortcut: shortcut.to_string() }
    }

    #[test]
    fn the_defaults_are_ctrl_shift_digits_and_reach_the_numpad_too() {
        let (bindings, problems) = plan(&default_shortcuts());
        assert!(problems.is_empty());
        let digits: Vec<_> = bindings.iter().map(|binding| (binding.action, numpad_digit(binding))).collect();
        assert_eq!(digits, [
            (ShortcutAction::Region, Some(1)),
            (ShortcutAction::Copy, Some(2)),
            (ShortcutAction::Text, Some(3)),
            (ShortcutAction::Translate, Some(4)),
            (ShortcutAction::Fullscreen, Some(7)),
        ]);
        assert_eq!(ShortcutAction::Pins.mode(), None);
        assert_eq!(ShortcutAction::Fullscreen.mode(), Some(Mode::Fullscreen));
    }

    #[test]
    fn empty_shortcuts_are_off_and_bad_or_repeated_ones_are_reported() {
        let config = [
            entry(ShortcutAction::Region, "Alt+Q"),
            entry(ShortcutAction::Copy, ""),
            entry(ShortcutAction::Text, "Q"),
            entry(ShortcutAction::Translate, "alt+q"),
            entry(ShortcutAction::Pins, "Ctrl+Alt+P"),
        ];
        let (bindings, problems) = plan(&config);
        assert_eq!(bindings.iter().map(|binding| binding.action).collect::<Vec<_>>(), [ShortcutAction::Region, ShortcutAction::Pins]);
        assert_eq!(problems, [
            ShortcutStatus { action: ShortcutAction::Text, problem: "invalid" },
            ShortcutStatus { action: ShortcutAction::Translate, problem: "duplicate" },
        ]);
        assert!(bindings.iter().all(|binding| numpad_digit(binding).is_none()), "only Ctrl+Shift+digit listens on the numpad");
    }
}
