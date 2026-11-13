use std::{
    sync::{atomic::Ordering, mpsc, Mutex},
    thread,
    time::{Duration, Instant},
};

use tauri::AppHandle;
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{WM_APP, WM_HOTKEY},
};

use crate::clipboard_history::{parse_shortcut_binding, ShortcutBinding};
use crate::user_error::UserError;
use crate::win32::{
    self,
    message_window::{self, WindowMessages},
};

use super::{capture_and_emit_selection, open_translator, APP, DEFAULT_SELECTION_SHORTCUT, DEFAULT_SHORTCUT, ENABLED};

const HOTKEY_ID: i32 = 0x4654;
const SELECTION_HOTKEY_ID: i32 = 0x4655;
const CHANGE_HOTKEY_MESSAGE: u32 = WM_APP + 0x52;
const CHANGE_SELECTION_HOTKEY_MESSAGE: u32 = WM_APP + 0x53;

static HOTKEY_WINDOW: Mutex<Option<isize>> = Mutex::new(None);
static ACTIVE_BINDING: Mutex<Option<ShortcutBinding>> = Mutex::new(None);
static SELECTION_BINDING: Mutex<Option<ShortcutBinding>> = Mutex::new(None);
type PendingBinding = (Option<ShortcutBinding>, mpsc::Sender<Result<String, UserError>>);

static PENDING_BINDING: Mutex<Option<PendingBinding>> = Mutex::new(None);
static PENDING_SELECTION_BINDING: Mutex<Option<PendingBinding>> = Mutex::new(None);

pub(super) fn start(_app: &AppHandle) {
    thread::spawn(|| {
        if let Err(error) = run_hotkey_loop() {
            eprintln!("failed to initialize translation shortcut: {error}");
        }
    });
}

pub(super) fn change_hotkey(binding: Option<ShortcutBinding>) -> Result<String, UserError> {
    post_binding(&PENDING_BINDING, CHANGE_HOTKEY_MESSAGE, binding)
}

pub(super) fn change_selection_hotkey(binding: Option<ShortcutBinding>) -> Result<String, UserError> {
    post_binding(&PENDING_SELECTION_BINDING, CHANGE_SELECTION_HOTKEY_MESSAGE, binding)
}

fn post_binding(
    slot: &Mutex<Option<PendingBinding>>,
    message: u32,
    binding: Option<ShortcutBinding>,
) -> Result<String, UserError> {
    let started = Instant::now();
    let hwnd = loop {
        if let Some(hwnd) = *HOTKEY_WINDOW.lock().map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))? {
            break hwnd;
        }
        if started.elapsed() >= Duration::from_secs(2) {
            return Err(UserError::new("shortcut.notReady", "The shortcut service is not ready yet."));
        }
        thread::sleep(Duration::from_millis(25));
    };
    let (sender, receiver) = mpsc::channel();
    {
        let mut pending = slot.lock().map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?;
        if pending.is_some() {
            return Err(UserError::new("shortcut.busy", "The shortcut is being changed already."));
        }
        *pending = Some((binding, sender));
    }
    if let Err(error) = message_window::post_message(HWND(hwnd as *mut _), message) {
        *slot.lock().map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))? = None;
        return Err(UserError::new("shortcut.update", "Could not change the shortcut.").detail(error));
    }
    receiver
        .recv_timeout(Duration::from_secs(2))
        .map_err(|error| UserError::new("shortcut.timeout", "Changing the shortcut took too long.").detail(error))?
}

fn run_hotkey_loop() -> Result<(), String> {
    let class_name = "FocuSDTranslationHotkey";
    let instance = message_window::module_instance().map_err(|error| error.to_string())?;
    if message_window::register_class::<TranslationHotkeyWindow>(instance, class_name).is_err() {
        return Err("Could not register the translation shortcut window.".to_string());
    }
    let hwnd = message_window::create_message_only_window(
        instance,
        class_name,
        "FocuSD Translation Hotkey",
    )
    .map_err(|error| error.to_string())?;
    register_default(hwnd, DEFAULT_SHORTCUT, HOTKEY_ID, &ACTIVE_BINDING)?;
    register_default(hwnd, DEFAULT_SELECTION_SHORTCUT, SELECTION_HOTKEY_ID, &SELECTION_BINDING)?;
    *HOTKEY_WINDOW.lock().map_err(|error| error.to_string())? = Some(hwnd.0 as isize);
    message_window::run_message_loop();
    let _ = win32::hotkey::unregister(hwnd, HOTKEY_ID);
    let _ = win32::hotkey::unregister(hwnd, SELECTION_HOTKEY_ID);
    Ok(())
}

fn register_default(
    hwnd: HWND,
    shortcut: &str,
    id: i32,
    slot: &Mutex<Option<ShortcutBinding>>,
) -> Result<(), String> {
    if let Some(binding) = parse_shortcut_binding(shortcut).filter(|_| ENABLED.load(Ordering::SeqCst)) {
        if register_binding(hwnd, id, &binding).is_ok() {
            *slot.lock().map_err(|error| error.to_string())? = Some(binding);
        }
    }
    Ok(())
}

fn register_binding(hwnd: HWND, id: i32, binding: &ShortcutBinding) -> Result<(), UserError> {
    win32::hotkey::register(hwnd, id, binding.modifiers, binding.key_code)
        .map_err(|error| UserError::new("shortcut.taken", format!("The shortcut {} is taken or cannot be registered.", binding.label)).arg("shortcut", binding.label.as_str()).detail(error))
}

fn apply_binding_change(
    hwnd: HWND,
    id: i32,
    pending_slot: &Mutex<Option<PendingBinding>>,
    active_slot: &Mutex<Option<ShortcutBinding>>,
) {
    let pending = pending_slot.lock().ok().and_then(|mut value| value.take());
    let Some((binding, sender)) = pending else {
        return;
    };
    let previous = active_slot.lock().ok().and_then(|mut value| value.take());
    if previous.is_some() {
        let _ = win32::hotkey::unregister(hwnd, id);
    }
    let Some(binding) = binding else {
        let _ = sender.send(Ok(String::new()));
        return;
    };
    let result = register_binding(hwnd, id, &binding).map(|()| binding.label.clone());
    if let Ok(mut active) = active_slot.lock() {
        *active = if result.is_ok() {
            Some(binding)
        } else {
            previous.and_then(|old| register_binding(hwnd, id, &old).ok().map(|()| old))
        };
    }
    let _ = sender.send(result);
}

struct TranslationHotkeyWindow;

impl WindowMessages for TranslationHotkeyWindow {
    fn handle(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> Option<LRESULT> {
        if message == WM_HOTKEY && crate::shortcut_capture::capture_hotkey_message(lparam.0) {
            return Some(LRESULT(0));
        }
        if message == WM_HOTKEY && wparam.0 == HOTKEY_ID as usize {
            if let Some(app) = APP.get() {
                open_translator(app);
            }
            return Some(LRESULT(0));
        }
        if message == WM_HOTKEY && wparam.0 == SELECTION_HOTKEY_ID as usize {
            capture_and_emit_selection();
            return Some(LRESULT(0));
        }
        if message == CHANGE_HOTKEY_MESSAGE {
            apply_binding_change(hwnd, HOTKEY_ID, &PENDING_BINDING, &ACTIVE_BINDING);
            return Some(LRESULT(0));
        }
        if message == CHANGE_SELECTION_HOTKEY_MESSAGE {
            apply_binding_change(hwnd, SELECTION_HOTKEY_ID, &PENDING_SELECTION_BINDING, &SELECTION_BINDING);
            return Some(LRESULT(0));
        }
        None
    }
}
