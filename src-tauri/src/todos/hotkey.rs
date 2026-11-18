use std::{
    sync::{Mutex, PoisonError},
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{WM_APP, WM_HOTKEY, WM_QUIT},
};

use crate::clipboard_history::parse_shortcut_binding;
use crate::win32::{
    self,
    message_window::{self, WindowMessages},
};

const HOTKEY_ID: i32 = 0x5710;
const REFRESH_MESSAGE: u32 = WM_APP + 0x76;
const CLASS_NAME: &str = "FuyuTodoShortcut";
const READY_WAIT: Duration = Duration::from_secs(2);

static WINDOW: Mutex<Option<isize>> = Mutex::new(None);
static THREAD: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);
static WANTED: Mutex<Option<String>> = Mutex::new(None);

pub(super) fn start(shortcut: Option<String>) -> Result<(), String> {
    *WANTED.lock().unwrap_or_else(PoisonError::into_inner) = shortcut;
    let mut slot = THREAD.lock().unwrap_or_else(PoisonError::into_inner);
    if slot.as_ref().is_some_and(|handle| !handle.is_finished()) {
        refresh_later();
        return Ok(());
    }
    let handle = thread::Builder::new()
        .name("todo-shortcut".into())
        .spawn(|| {
            if let Err(error) = run() {
                eprintln!("the todo quick-add shortcut is unavailable: {error}");
            }
        })
        .map_err(|error| format!("Could not start the todo quick-add shortcut: {error}"))?;
    *slot = Some(handle);
    Ok(())
}

pub(super) fn stop() {
    let Some(handle) = THREAD.lock().unwrap_or_else(PoisonError::into_inner).take() else {
        return;
    };
    let started = Instant::now();
    while !handle.is_finished() {
        let window = *WINDOW.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(window) = window {
            let _ = message_window::post_message(HWND(window as *mut _), WM_QUIT);
            break;
        }
        if started.elapsed() >= READY_WAIT {
            eprintln!("the todo shortcut thread did not get ready, so it is left to finish on its own");
            return;
        }
        thread::sleep(Duration::from_millis(10));
    }
    let _ = handle.join();
    super::shortcut::report(None);
}

pub(super) fn running() -> bool {
    THREAD.lock().unwrap_or_else(PoisonError::into_inner).as_ref().is_some_and(|handle| !handle.is_finished())
}

pub(super) fn configure(shortcut: Option<String>) {
    *WANTED.lock().unwrap_or_else(PoisonError::into_inner) = shortcut;
    refresh_later();
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
    let window = match message_window::create_message_only_window(instance, CLASS_NAME, "Fuyu Todo Shortcut") {
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
    super::shortcut::report(problem);
}

struct ShortcutWindow;

impl WindowMessages for ShortcutWindow {
    fn handle(window: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> Option<LRESULT> {
        if message == WM_HOTKEY && crate::shortcut_capture::capture_hotkey_message(lparam.0) {
            return Some(LRESULT(0));
        }
        match message {
            WM_HOTKEY if wparam.0 == HOTKEY_ID as usize => super::shortcut::pressed(),
            REFRESH_MESSAGE => refresh(window),
            _ => return None,
        }
        Some(LRESULT(0))
    }
}
