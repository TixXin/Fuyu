use std::{
    sync::{
        atomic::{AtomicIsize, Ordering},
        Mutex, OnceLock, PoisonError,
    },
    thread,
};

use tauri::{AppHandle, Emitter};
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{WM_APP, WM_HOTKEY},
};

use super::{on_hotkey, SHORTCUT_EVENT};
use crate::clipboard_history::parse_shortcut_binding;
use crate::win32::{
    self,
    message_window::{self, WindowMessages},
};

const HOTKEY_ID: i32 = 0x5600;
const REFRESH_MESSAGE: u32 = WM_APP + 0x71;

static APP: OnceLock<AppHandle> = OnceLock::new();
static WINDOW: AtomicIsize = AtomicIsize::new(0);
static WANTED: Mutex<Option<String>> = Mutex::new(None);
static PROBLEM: Mutex<Option<&'static str>> = Mutex::new(None);

pub(super) fn start(app: &AppHandle) {
    let _ = APP.set(app.clone());
    thread::spawn(|| {
        if let Err(error) = run() {
            eprintln!("the voice input shortcut is unavailable: {error}");
        }
    });
}

pub(super) fn configure(shortcut: Option<String>) {
    *WANTED.lock().unwrap_or_else(PoisonError::into_inner) = shortcut;
    let window = WINDOW.load(Ordering::SeqCst);
    if window != 0 {
        let _ = message_window::post_message(HWND(window as *mut core::ffi::c_void), REFRESH_MESSAGE);
    }
}

pub(super) fn problem() -> Option<&'static str> {
    *PROBLEM.lock().unwrap_or_else(PoisonError::into_inner)
}

fn run() -> Result<(), String> {
    let class = "FuyuVoiceInputShortcut";
    let instance = message_window::module_instance().map_err(|error| error.to_string())?;
    message_window::register_class::<ShortcutWindow>(instance, class).map_err(|error| error.to_string())?;
    let window = message_window::create_message_only_window(instance, class, "Fuyu Voice Input Shortcut").map_err(|error| error.to_string())?;
    WINDOW.store(window.0 as isize, Ordering::SeqCst);
    refresh(window);
    message_window::run_message_loop();
    let _ = win32::hotkey::unregister(window, HOTKEY_ID);
    Ok(())
}

fn refresh(window: HWND) {
    let _ = win32::hotkey::unregister(window, HOTKEY_ID);
    let wanted = WANTED.lock().unwrap_or_else(PoisonError::into_inner).clone();
    let problem = match wanted {
        Some(shortcut) if !crate::coexist::yielding() => match parse_shortcut_binding(&shortcut) {
            None => Some("invalid"),
            Some(binding) => win32::hotkey::register(window, HOTKEY_ID, binding.modifiers, binding.key_code).err().map(|_| "taken"),
        },
        _ => None,
    };
    *PROBLEM.lock().unwrap_or_else(PoisonError::into_inner) = problem;
    if let Some(app) = APP.get() {
        let _ = app.emit(SHORTCUT_EVENT, problem);
    }
}

struct ShortcutWindow;

impl WindowMessages for ShortcutWindow {
    fn handle(window: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> Option<LRESULT> {
        if message == WM_HOTKEY && crate::shortcut_capture::capture_hotkey_message(lparam.0) {
            return Some(LRESULT(0));
        }
        match message {
            WM_HOTKEY if wparam.0 == HOTKEY_ID as usize => on_hotkey(),
            REFRESH_MESSAGE => refresh(window),
            _ => return None,
        }
        Some(LRESULT(0))
    }
}
