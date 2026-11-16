use std::{
    sync::{
        mpsc::{self, RecvTimeoutError, Sender},
        Mutex, PoisonError,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{WM_CLIPBOARDUPDATE, WM_HOTKEY, WM_QUIT},
};

use super::hotkey::{
    refresh_registered_hotkey, unregister_current_hotkey, CLIPBOARD_HOTKEY_WINDOW, HOTKEY_ID,
    HOTKEY_REFRESH_MESSAGE, PASTED_MESSAGE, WIN_V_MESSAGE,
};
use super::service;
use super::workers::notify_clipboard_changed;
use crate::win32::{
    self,
    message_window::{self, WindowMessages},
};

const POLL_INTERVAL: Duration = Duration::from_secs(2);
const READY_WAIT: Duration = Duration::from_secs(2);
const CLASS_NAME: &str = "FocuSDClipboardHistoryListener";

struct Listener {
    fallback: Sender<()>,
    handle: JoinHandle<()>,
}

static LISTENER: Mutex<Option<Listener>> = Mutex::new(None);

pub(super) fn start() -> Result<(), String> {
    let mut slot = LISTENER.lock().unwrap_or_else(PoisonError::into_inner);
    if slot.as_ref().is_some_and(|listener| !listener.handle.is_finished()) {
        return Ok(());
    }
    let (fallback, stopped) = mpsc::channel::<()>();
    let handle = thread::Builder::new()
        .name("clipboard-listener".into())
        .spawn(move || {
            if let Err(error) = run_windows_clipboard_listener() {
                eprintln!("clipboard listener fell back to polling only: {error}");
                while let Err(RecvTimeoutError::Timeout) = stopped.recv_timeout(POLL_INTERVAL) {
                    notify_clipboard_changed();
                }
            }
        })
        .map_err(|error| format!("Could not start the clipboard listener: {error}"))?;
    *slot = Some(Listener { fallback, handle });
    Ok(())
}

pub(super) fn stop() {
    let Some(Listener { fallback, handle }) = LISTENER.lock().unwrap_or_else(PoisonError::into_inner).take() else {
        return;
    };
    drop(fallback);
    let started = Instant::now();
    while !handle.is_finished() {
        if let Some(hwnd) = listener_window() {
            let _ = message_window::post_message(hwnd, WM_QUIT);
            break;
        }
        if started.elapsed() >= READY_WAIT {
            eprintln!("the clipboard listener did not get ready, so it is left to finish on its own");
            return;
        }
        thread::sleep(Duration::from_millis(10));
    }
    let _ = handle.join();
}

pub(super) fn running() -> bool {
    LISTENER.lock().unwrap_or_else(PoisonError::into_inner).as_ref().is_some_and(|listener| !listener.handle.is_finished())
}

fn listener_window() -> Option<HWND> {
    CLIPBOARD_HOTKEY_WINDOW
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .map(|window| HWND(window as *mut core::ffi::c_void))
}

fn set_listener_window(window: Option<HWND>) {
    *CLIPBOARD_HOTKEY_WINDOW.lock().unwrap_or_else(PoisonError::into_inner) = window.map(|hwnd| hwnd.0 as isize);
}

fn run_windows_clipboard_listener() -> Result<(), String> {
    let instance = message_window::module_instance().map_err(|error| error.to_string())?;

    if message_window::register_class::<ClipboardWindow>(instance, CLASS_NAME).is_err() {
        return Err("Failed to register clipboard listener window class.".to_string());
    }

    let hwnd = match message_window::create_message_only_window(instance, CLASS_NAME, "FocuSD Clipboard History Listener") {
        Ok(hwnd) => hwnd,
        Err(error) => {
            let _ = message_window::unregister_class(instance, CLASS_NAME);
            return Err(error.to_string());
        }
    };

    if let Err(error) = win32::clipboard::add_format_listener(hwnd) {
        let _ = message_window::destroy_window(hwnd);
        let _ = message_window::unregister_class(instance, CLASS_NAME);
        return Err(error.to_string());
    }
    set_listener_window(Some(hwnd));
    refresh_registered_hotkey(hwnd);

    message_window::run_message_loop();

    set_listener_window(None);
    unregister_current_hotkey(hwnd);
    let _ = win32::clipboard::remove_format_listener(hwnd);
    let _ = message_window::destroy_window(hwnd);
    let _ = message_window::unregister_class(instance, CLASS_NAME);

    Ok(())
}

struct ClipboardWindow;

impl WindowMessages for ClipboardWindow {
    fn handle(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> Option<LRESULT> {
        if message == WM_HOTKEY && crate::shortcut_capture::capture_hotkey_message(lparam.0) {
            return Some(LRESULT(0));
        }
        if message == WM_CLIPBOARDUPDATE {
            notify_clipboard_changed();
            return Some(LRESULT(0));
        }

        if (message == WM_HOTKEY && wparam.0 == HOTKEY_ID as usize) || message == WIN_V_MESSAGE {
            if let Ok(service) = service() {
                service.emit_shortcut();
            }
            return Some(LRESULT(0));
        }

        if message == PASTED_MESSAGE {
            super::sequence::advance();
            return Some(LRESULT(0));
        }

        if message == HOTKEY_REFRESH_MESSAGE {
            refresh_registered_hotkey(hwnd);
            return Some(LRESULT(0));
        }

        None
    }
}
