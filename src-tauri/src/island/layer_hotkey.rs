use std::{
    sync::{Mutex, PoisonError},
    thread::{self, JoinHandle},
};

use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{WM_APP, WM_HOTKEY},
};

use crate::clipboard_history::parse_shortcut_binding;
use crate::win32::{
    self,
    message_window::{self, WindowMessages},
};

const HOTKEY_ID: i32 = 0x5730;
const REFRESH_MESSAGE: u32 = WM_APP + 0x78;
const CLASS_NAME: &str = "FuyuIslandLayerShortcut";

static WINDOW: Mutex<Option<isize>> = Mutex::new(None);
static THREAD: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);
static WANTED: Mutex<Option<String>> = Mutex::new(None);

pub(super) fn configure(shortcut: Option<String>) -> Result<(), String> {
    *WANTED.lock().unwrap_or_else(PoisonError::into_inner) = shortcut;
    let mut slot = THREAD.lock().unwrap_or_else(PoisonError::into_inner);
    if slot.as_ref().is_some_and(|handle| !handle.is_finished()) {
        refresh_later();
        return Ok(());
    }
    let handle = thread::Builder::new()
        .name("island-layer-shortcut".into())
        .spawn(|| {
            if let Err(error) = run() {
                eprintln!("the island layer shortcut is unavailable: {error}");
            }
        })
        .map_err(|error| format!("Could not start the island layer shortcut: {error}"))?;
    *slot = Some(handle);
    Ok(())
}

pub(super) fn refresh_later() {
    let window = *WINDOW.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(window) = window {
        let _ = message_window::post_message(HWND(window as *mut _), REFRESH_MESSAGE);
    }
}

fn run() -> Result<(), String> {
    let instance = message_window::module_instance().map_err(|error| error.to_string())?;
    let _ = message_window::register_class::<ShortcutWindow>(instance, CLASS_NAME);
    let window = match message_window::create_message_only_window(instance, CLASS_NAME, "Fuyu Island Layer Shortcut") {
        Ok(window) => window,
        Err(error) => {
            let _ = message_window::unregister_class(instance, CLASS_NAME);
            return Err(error.to_string());
        }
    };
    *WINDOW.lock().unwrap_or_else(PoisonError::into_inner) = Some(window.0 as isize);
    refresh(window);
    message_window::run_message_loop();
    *WINDOW.lock().unwrap_or_else(PoisonError::into_inner) = None;
    let _ = win32::hotkey::unregister(window, HOTKEY_ID);
    let _ = message_window::destroy_window(window);
    let _ = message_window::unregister_class(instance, CLASS_NAME);
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
    super::layer::report(problem);
}

struct ShortcutWindow;

impl WindowMessages for ShortcutWindow {
    fn handle(window: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> Option<LRESULT> {
        if message == WM_HOTKEY && crate::shortcut_capture::capture_hotkey_message(lparam.0) {
            return Some(LRESULT(0));
        }
        match message {
            WM_HOTKEY if wparam.0 == HOTKEY_ID as usize => super::layer::pressed(),
            REFRESH_MESSAGE => refresh(window),
            _ => return None,
        }
        Some(LRESULT(0))
    }
}
