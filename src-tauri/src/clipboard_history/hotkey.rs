use std::sync::{Mutex, OnceLock};
use tauri::Emitter;
use windows::Win32::{Foundation::HWND, UI::WindowsAndMessaging::WM_APP};

use super::{default_shortcut_binding, parse_shortcut_binding, service};
use crate::win32;

pub(super) const HOTKEY_EVENT: &str = "clipboard-history-shortcut";

const HOTKEY_STATUS_EVENT: &str = "clipboard-history-shortcut-status";

pub(super) const HOTKEY_ID: i32 = 0x4643;

pub(super) const HOTKEY_REFRESH_MESSAGE: u32 = WM_APP + 0x51;

pub(super) const WIN_V_MESSAGE: u32 = WM_APP + 0x52;

pub(super) const PASTED_MESSAGE: u32 = WM_APP + 0x53;

pub(super) static CLIPBOARD_HOTKEY_WINDOW: OnceLock<Mutex<Option<isize>>> = OnceLock::new();

static CLIPBOARD_HOTKEY_REGISTERED: OnceLock<Mutex<bool>> = OnceLock::new();

static CLIPBOARD_HOTKEY_ERROR: Mutex<Option<String>> = Mutex::new(None);

pub(super) fn hotkey_error() -> Option<String> {
    CLIPBOARD_HOTKEY_ERROR
        .lock()
        .ok()
        .and_then(|error| error.clone())
}

fn report_hotkey_error(error: Option<String>) {
    if let Ok(mut current) = CLIPBOARD_HOTKEY_ERROR.lock() {
        current.clone_from(&error);
    }
    if let Ok(service) = service() {
        let _ = service.app.emit(HOTKEY_STATUS_EVENT, error);
    }
}

pub(super) fn request_hotkey_refresh() {
    let hwnd = CLIPBOARD_HOTKEY_WINDOW
        .get()
        .and_then(|window| window.lock().ok())
        .and_then(|window| *window)
        .map(|window| HWND(window as *mut core::ffi::c_void));

    if let Some(hwnd) = hwnd {
        let _ = win32::message_window::post_message(hwnd, HOTKEY_REFRESH_MESSAGE);
    }
}

pub(super) fn refresh_registered_hotkey(hwnd: HWND) {
    unregister_current_hotkey(hwnd);

    let snapshot = service().ok().and_then(|service| service.snapshot().ok());

    let win_v = snapshot
        .as_ref()
        .is_some_and(|snapshot| snapshot.settings.enabled && snapshot.settings.win_v);
    let sequence = super::sequence::is_running();
    if let Err(error) = win32::win_key_hook::set(win_v.then_some((hwnd, WIN_V_MESSAGE)), sequence.then_some((hwnd, PASTED_MESSAGE))) {
        eprintln!("failed to take Win+V: {error}");
    }

    if snapshot
        .as_ref()
        .is_some_and(|snapshot| !snapshot.settings.enabled || !snapshot.settings.shortcut_enabled)
    {
        report_hotkey_error(None);
        return;
    }

    let Some(binding) = snapshot
        .and_then(|snapshot| parse_shortcut_binding(&snapshot.settings.shortcut))
        .or_else(default_shortcut_binding)
    else {
        return;
    };

    match win32::hotkey::register(hwnd, HOTKEY_ID, binding.modifiers, binding.key_code) {
        Ok(()) => {
            set_hotkey_registered(true);
            report_hotkey_error(None);
        }
        Err(error) => {
            set_hotkey_registered(false);
            report_hotkey_error(Some(format!(
                "快捷键 {} 已被占用或无法注册：{error}",
                binding.label
            )));
        }
    }
}

pub(super) fn unregister_current_hotkey(hwnd: HWND) {
    let _ = win32::win_key_hook::set(None, None);
    if hotkey_registered() {
        let _ = win32::hotkey::unregister(hwnd, HOTKEY_ID);
        set_hotkey_registered(false);
    }
}

fn hotkey_registered() -> bool {
    CLIPBOARD_HOTKEY_REGISTERED
        .get_or_init(|| Mutex::new(false))
        .lock()
        .map(|registered| *registered)
        .unwrap_or(false)
}

fn set_hotkey_registered(value: bool) {
    if let Ok(mut registered) = CLIPBOARD_HOTKEY_REGISTERED
        .get_or_init(|| Mutex::new(false))
        .lock()
    {
        *registered = value;
    }
}

#[cfg(test)]
mod tests {
    use super::super::{ClipboardHistorySettings, DEFAULT_SHORTCUT};
    use super::*;

    #[test]
    fn the_default_shortcut_parses_to_its_own_label() {
        let binding = default_shortcut_binding().expect("the default shortcut is valid");
        assert_eq!(binding.label, DEFAULT_SHORTCUT);
    }

    #[test]
    fn saved_settings_on_the_old_default_move_to_the_new_one() {
        let saved = |shortcut: &str| ClipboardHistorySettings {
            shortcut: shortcut.to_string(),
            ..ClipboardHistorySettings::default()
        };
        assert_eq!(saved("Ctrl+X").normalized().shortcut, DEFAULT_SHORTCUT);
        assert_eq!(saved("ctrl + x").normalized().shortcut, DEFAULT_SHORTCUT);
        assert_eq!(saved("Ctrl+Alt+V").normalized().shortcut, "Ctrl+Alt+V");
    }
}
