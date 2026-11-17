use std::{
    sync::{
        atomic::{AtomicIsize, Ordering},
        Mutex, OnceLock, PoisonError,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use tauri::{AppHandle, Emitter};
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{WM_APP, WM_HOTKEY, WM_QUIT},
};

use super::{on_hotkey, SHORTCUT_EVENT};
use crate::clipboard_history::parse_shortcut_binding;
use crate::win32::{
    self,
    message_window::{self, WindowMessages},
};

const HOTKEY_ID: i32 = 0x5600;
const REFRESH_MESSAGE: u32 = WM_APP + 0x71;
const CLASS_NAME: &str = "FuyuVoiceInputShortcut";
const READY_WAIT: Duration = Duration::from_secs(2);

static APP: OnceLock<AppHandle> = OnceLock::new();
static WINDOW: AtomicIsize = AtomicIsize::new(0);
static WANTED: Mutex<Option<String>> = Mutex::new(None);
static PROBLEM: Mutex<Option<&'static str>> = Mutex::new(None);
static THREAD: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);

pub(super) fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
}

pub(super) fn start() -> Result<(), String> {
    let mut slot = THREAD.lock().unwrap_or_else(PoisonError::into_inner);
    if slot.as_ref().is_some_and(|handle| !handle.is_finished()) {
        return Ok(());
    }
    let handle = thread::Builder::new()
        .name("voice-input-hotkeys".into())
        .spawn(|| {
            if let Err(error) = run() {
                eprintln!("the voice input shortcut is unavailable: {error}");
            }
        })
        .map_err(|error| format!("Could not start the voice input shortcut: {error}"))?;
    *slot = Some(handle);
    Ok(())
}

pub(super) fn stop() {
    let Some(handle) = THREAD.lock().unwrap_or_else(PoisonError::into_inner).take() else {
        return;
    };
    let started = Instant::now();
    while !handle.is_finished() {
        let window = WINDOW.load(Ordering::SeqCst);
        if window != 0 {
            let _ = message_window::post_message(HWND(window as *mut core::ffi::c_void), WM_QUIT);
            break;
        }
        if started.elapsed() >= READY_WAIT {
            eprintln!("the voice input shortcut thread did not get ready, so it is left to finish on its own");
            return;
        }
        thread::sleep(Duration::from_millis(10));
    }
    let _ = handle.join();
}

pub(super) fn running() -> bool {
    THREAD.lock().unwrap_or_else(PoisonError::into_inner).as_ref().is_some_and(|handle| !handle.is_finished())
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

fn report(problem: Option<&'static str>) {
    *PROBLEM.lock().unwrap_or_else(PoisonError::into_inner) = problem;
    if let Some(app) = APP.get() {
        let _ = app.emit(SHORTCUT_EVENT, problem);
    }
}

fn run() -> Result<(), String> {
    let instance = message_window::module_instance().map_err(|error| error.to_string())?;
    message_window::register_class::<ShortcutWindow>(instance, CLASS_NAME).map_err(|error| error.to_string())?;
    let window = match message_window::create_message_only_window(instance, CLASS_NAME, "Fuyu Voice Input Shortcut") {
        Ok(window) => window,
        Err(error) => {
            let _ = message_window::unregister_class(instance, CLASS_NAME);
            return Err(error.to_string());
        }
    };
    WINDOW.store(window.0 as isize, Ordering::SeqCst);
    refresh(window);
    message_window::run_message_loop();
    WINDOW.store(0, Ordering::SeqCst);
    let _ = win32::hotkey::unregister(window, HOTKEY_ID);
    report(None);
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
    report(problem);
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
