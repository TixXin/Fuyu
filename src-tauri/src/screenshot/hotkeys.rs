//! The screenshot shortcuts: Ctrl+Shift + a digit, on the number row (RegisterHotKey) and on the
//! numpad (the low-level keyboard hook, win32::win_key_hook, since Shift turns numpad digits into
//! navigation keys). They are registered only while the module is on, so turning it off gives the
//! keys back to other apps. A message-only window on its own thread receives them.

use std::sync::{
    atomic::{AtomicBool, AtomicIsize, Ordering},
    OnceLock,
};
use std::thread;

use tauri::AppHandle;
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::{
        Input::KeyboardAndMouse::{MOD_CONTROL, MOD_SHIFT},
        WindowsAndMessaging::{WM_APP, WM_HOTKEY},
    },
};

use super::session::{self, Mode};
use crate::win32::{
    self,
    message_window::{self, WindowMessages},
};

/// The digit after Ctrl+Shift and what it does (plan: docs/architecture/screenshot-plan.md,
/// "快捷键"). Shortcuts for features not built yet are not registered, so they take no keys.
const SHORTCUTS: [(u32, Mode); 2] = [(1, Mode::Region), (7, Mode::Fullscreen)];
/// RegisterHotKey ids: this base plus the digit.
const HOTKEY_BASE: i32 = 0x5300;
const REFRESH_MESSAGE: u32 = WM_APP + 0x61;
/// Posted by the keyboard hook for a numpad digit, the digit as wparam.
const NUMPAD_MESSAGE: u32 = WM_APP + 0x62;

static APP: OnceLock<AppHandle> = OnceLock::new();
static WINDOW: AtomicIsize = AtomicIsize::new(0);
static ENABLED: AtomicBool = AtomicBool::new(false);

/// Starts the thread that owns the shortcuts; they stay off until `set_enabled(true)`.
pub(super) fn start(app: &AppHandle) {
    let _ = APP.set(app.clone());
    thread::spawn(|| {
        if let Err(error) = run() {
            eprintln!("screenshot shortcuts are unavailable: {error}");
        }
    });
}

/// Turns the shortcuts on or off (the module switch).
pub(super) fn set_enabled(enabled: bool) {
    ENABLED.store(enabled, Ordering::SeqCst);
    let window = WINDOW.load(Ordering::SeqCst);
    if window != 0 {
        let _ = message_window::post_message(HWND(window as *mut core::ffi::c_void), REFRESH_MESSAGE);
    }
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
    for (digit, _) in SHORTCUTS {
        let _ = win32::hotkey::unregister(window, HOTKEY_BASE + digit as i32);
    }
}

fn refresh(window: HWND) {
    release(window);
    if !ENABLED.load(Ordering::SeqCst) {
        return;
    }
    for (digit, _) in SHORTCUTS {
        let key = u32::from(b'0') + digit;
        if let Err(error) = win32::hotkey::register(window, HOTKEY_BASE + digit as i32, MOD_CONTROL.0 | MOD_SHIFT.0, key) {
            eprintln!("Ctrl+Shift+{digit} is taken by another app: {error}");
        }
    }
    let digits = SHORTCUTS.iter().fold(0, |mask, (digit, _)| mask | (1 << digit));
    if let Err(error) = win32::win_key_hook::set_numpad(Some((window, NUMPAD_MESSAGE, digits))) {
        eprintln!("the numpad screenshot shortcuts are unavailable: {error}");
    }
}

/// The mode a digit starts, if it is one of the shortcuts.
fn mode_for(digit: u32) -> Option<Mode> {
    SHORTCUTS.iter().find(|(key, _)| *key == digit).map(|(_, mode)| *mode)
}

struct ShortcutWindow;

impl WindowMessages for ShortcutWindow {
    fn handle(window: HWND, message: u32, wparam: WPARAM, _: LPARAM) -> Option<LRESULT> {
        let digit = match message {
            WM_HOTKEY => u32::try_from(wparam.0).ok().and_then(|id| id.checked_sub(HOTKEY_BASE as u32)),
            NUMPAD_MESSAGE => u32::try_from(wparam.0).ok(),
            REFRESH_MESSAGE => {
                refresh(window);
                return Some(LRESULT(0));
            }
            _ => return None,
        };
        if let (Some(mode), Some(app)) = (digit.and_then(mode_for), APP.get()) {
            if ENABLED.load(Ordering::SeqCst) {
                session::start(app, mode);
            }
        }
        Some(LRESULT(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn digit_1_selects_a_region_and_7_takes_the_whole_monitor() {
        assert_eq!(mode_for(1), Some(Mode::Region));
        assert_eq!(mode_for(7), Some(Mode::Fullscreen));
        assert_eq!(mode_for(2), None);
    }
}
