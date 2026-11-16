use std::{
    sync::{mpsc, Mutex, PoisonError},
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use tauri::AppHandle;
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{WM_APP, WM_HOTKEY, WM_QUIT},
};

use crate::clipboard_history::{parse_shortcut_binding, ShortcutBinding};
use crate::user_error::UserError;
use crate::win32::{
    self,
    message_window::{self, WindowMessages},
};

use super::{capture_and_emit_selection, open_translator, APP, DEFAULT_SELECTION_SHORTCUT, DEFAULT_SHORTCUT};

const HOTKEY_ID: i32 = 0x4654;
const SELECTION_HOTKEY_ID: i32 = 0x4655;
const CHANGE_HOTKEY_MESSAGE: u32 = WM_APP + 0x52;
const CHANGE_SELECTION_HOTKEY_MESSAGE: u32 = WM_APP + 0x53;
const COEXIST_MESSAGE: u32 = WM_APP + 0x54;
const CLASS_NAME: &str = "FuyuTranslationHotkey";
const READY_WAIT: Duration = Duration::from_secs(2);

static HOTKEY_WINDOW: Mutex<Option<isize>> = Mutex::new(None);
static HOTKEY_THREAD: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);
static ACTIVE_BINDING: Mutex<Option<ShortcutBinding>> = Mutex::new(None);
static SELECTION_BINDING: Mutex<Option<ShortcutBinding>> = Mutex::new(None);
static WANTED_BINDING: Mutex<Option<ShortcutBinding>> = Mutex::new(None);
static WANTED_SELECTION_BINDING: Mutex<Option<ShortcutBinding>> = Mutex::new(None);
type PendingBinding = (Option<ShortcutBinding>, mpsc::Sender<Result<String, UserError>>);

static PENDING_BINDING: Mutex<Option<PendingBinding>> = Mutex::new(None);
static PENDING_SELECTION_BINDING: Mutex<Option<PendingBinding>> = Mutex::new(None);

pub(super) fn start(_app: &AppHandle) -> Result<(), String> {
    let mut slot = HOTKEY_THREAD.lock().unwrap_or_else(PoisonError::into_inner);
    if slot.as_ref().is_some_and(|handle| !handle.is_finished()) {
        return Ok(());
    }
    let handle = thread::Builder::new()
        .name("translation-hotkeys".into())
        .spawn(|| {
            if let Err(error) = run_hotkey_loop() {
                eprintln!("failed to initialize translation shortcut: {error}");
            }
        })
        .map_err(|error| format!("Could not start the translation shortcuts: {error}"))?;
    *slot = Some(handle);
    Ok(())
}

pub(super) fn stop() {
    let Some(handle) = HOTKEY_THREAD.lock().unwrap_or_else(PoisonError::into_inner).take() else {
        return;
    };
    let started = Instant::now();
    while !handle.is_finished() {
        let window = *HOTKEY_WINDOW.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(window) = window {
            let _ = message_window::post_message(HWND(window as *mut _), WM_QUIT);
            break;
        }
        if started.elapsed() >= READY_WAIT {
            eprintln!("the translation shortcut thread did not get ready, so it is left to finish on its own");
            return;
        }
        thread::sleep(Duration::from_millis(10));
    }
    let _ = handle.join();
}

pub(super) fn running() -> bool {
    HOTKEY_THREAD.lock().unwrap_or_else(PoisonError::into_inner).as_ref().is_some_and(|handle| !handle.is_finished())
}

pub(super) fn want(binding: ShortcutBinding) {
    remember(&WANTED_BINDING, Some(binding));
}

pub(super) fn want_selection(binding: ShortcutBinding) {
    remember(&WANTED_SELECTION_BINDING, Some(binding));
}

pub(super) fn coexist_refresh() {
    let window = HOTKEY_WINDOW.lock().ok().and_then(|window| *window);
    if let Some(window) = window {
        let _ = message_window::post_message(HWND(window as *mut _), COEXIST_MESSAGE);
    }
}

fn remember(slot: &Mutex<Option<ShortcutBinding>>, binding: Option<ShortcutBinding>) {
    if let Ok(mut wanted) = slot.lock() {
        *wanted = binding;
    }
}

fn follow_coexist(hwnd: HWND, id: i32, active_slot: &Mutex<Option<ShortcutBinding>>, wanted_slot: &Mutex<Option<ShortcutBinding>>) {
    let Ok(mut active) = active_slot.lock() else { return };
    if crate::coexist::yielding() {
        if active.take().is_some() {
            let _ = win32::hotkey::unregister(hwnd, id);
        }
        return;
    }
    if active.is_some() {
        return;
    }
    let wanted = wanted_slot.lock().ok().and_then(|wanted| wanted.clone());
    if let Some(binding) = wanted {
        if register_binding(hwnd, id, &binding).is_ok() {
            *active = Some(binding);
        }
    }
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
        if started.elapsed() >= READY_WAIT {
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
    let instance = message_window::module_instance().map_err(|error| error.to_string())?;
    if message_window::register_class::<TranslationHotkeyWindow>(instance, CLASS_NAME).is_err() {
        return Err("Could not register the translation shortcut window.".to_string());
    }
    let hwnd = match message_window::create_message_only_window(instance, CLASS_NAME, "Fuyu Translation Hotkey") {
        Ok(hwnd) => hwnd,
        Err(error) => {
            let _ = message_window::unregister_class(instance, CLASS_NAME);
            return Err(error.to_string());
        }
    };
    register_default(hwnd, DEFAULT_SHORTCUT, HOTKEY_ID, &ACTIVE_BINDING, &WANTED_BINDING);
    register_default(hwnd, DEFAULT_SELECTION_SHORTCUT, SELECTION_HOTKEY_ID, &SELECTION_BINDING, &WANTED_SELECTION_BINDING);
    *HOTKEY_WINDOW.lock().unwrap_or_else(PoisonError::into_inner) = Some(hwnd.0 as isize);
    message_window::run_message_loop();
    *HOTKEY_WINDOW.lock().unwrap_or_else(PoisonError::into_inner) = None;
    for (id, slot) in [(HOTKEY_ID, &ACTIVE_BINDING), (SELECTION_HOTKEY_ID, &SELECTION_BINDING)] {
        if slot.lock().unwrap_or_else(PoisonError::into_inner).take().is_some() {
            let _ = win32::hotkey::unregister(hwnd, id);
        }
    }
    for slot in [&PENDING_BINDING, &PENDING_SELECTION_BINDING] {
        if let Some((binding, sender)) = slot.lock().unwrap_or_else(PoisonError::into_inner).take() {
            let label = binding.map(|binding| binding.label).unwrap_or_default();
            let _ = sender.send(Ok(label));
        }
    }
    let _ = message_window::destroy_window(hwnd);
    let _ = message_window::unregister_class(instance, CLASS_NAME);
    Ok(())
}

fn register_default(
    hwnd: HWND,
    shortcut: &str,
    id: i32,
    slot: &Mutex<Option<ShortcutBinding>>,
    wanted_slot: &Mutex<Option<ShortcutBinding>>,
) {
    let wanted = wanted_slot.lock().unwrap_or_else(PoisonError::into_inner).clone();
    if let Some(binding) = wanted.or_else(|| parse_shortcut_binding(shortcut)) {
        if crate::coexist::yielding() {
            remember(wanted_slot, Some(binding));
        } else if register_binding(hwnd, id, &binding).is_ok() {
            remember(wanted_slot, Some(binding.clone()));
            *slot.lock().unwrap_or_else(PoisonError::into_inner) = Some(binding);
        }
    }
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
    wanted_slot: &Mutex<Option<ShortcutBinding>>,
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
        remember(wanted_slot, None);
        let _ = sender.send(Ok(String::new()));
        return;
    };
    if crate::coexist::yielding() {
        let label = binding.label.clone();
        remember(wanted_slot, Some(binding));
        let _ = sender.send(Ok(label));
        return;
    }
    let result = register_binding(hwnd, id, &binding).map(|()| binding.label.clone());
    if let Ok(mut active) = active_slot.lock() {
        *active = if result.is_ok() {
            Some(binding)
        } else {
            previous.and_then(|old| register_binding(hwnd, id, &old).ok().map(|()| old))
        };
        remember(wanted_slot, active.clone());
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
            apply_binding_change(hwnd, HOTKEY_ID, &PENDING_BINDING, &ACTIVE_BINDING, &WANTED_BINDING);
            return Some(LRESULT(0));
        }
        if message == CHANGE_SELECTION_HOTKEY_MESSAGE {
            apply_binding_change(hwnd, SELECTION_HOTKEY_ID, &PENDING_SELECTION_BINDING, &SELECTION_BINDING, &WANTED_SELECTION_BINDING);
            return Some(LRESULT(0));
        }
        if message == COEXIST_MESSAGE {
            follow_coexist(hwnd, HOTKEY_ID, &ACTIVE_BINDING, &WANTED_BINDING);
            follow_coexist(hwnd, SELECTION_HOTKEY_ID, &SELECTION_BINDING, &WANTED_SELECTION_BINDING);
            return Some(LRESULT(0));
        }
        None
    }
}
