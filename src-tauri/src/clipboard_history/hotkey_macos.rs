use global_hotkey::hotkey::HotKey;
use std::sync::{Mutex, PoisonError};
use tauri::Emitter;

use crate::macos::hotkeys::{self, HotkeyError};

use super::{default_shortcut_binding, parse_shortcut_binding, service, to_hotkey};

pub(super) const HOTKEY_EVENT: &str = "clipboard-history-shortcut";
const HOTKEY_STATUS_EVENT: &str = "clipboard-history-shortcut-status";

static ERROR: Mutex<Option<String>> = Mutex::new(None);
static CURRENT: Mutex<Option<HotKey>> = Mutex::new(None);

pub(super) fn hotkey_error() -> Option<String> {
    ERROR.lock().unwrap_or_else(PoisonError::into_inner).clone()
}

fn report_hotkey_error(error: Option<String>) {
    ERROR.lock().unwrap_or_else(PoisonError::into_inner).clone_from(&error);
    if let Ok(service) = service() {
        let _ = service.app.emit(HOTKEY_STATUS_EVENT, error);
    }
}

pub(super) fn request_hotkey_refresh() {
    if let Ok(service) = service() {
        let _ = service.app.run_on_main_thread(refresh);
    }
}

fn on_shortcut() {
    if let Ok(service) = service() {
        service.emit_shortcut();
    }
}

fn refresh() {
    if let Some(hotkey) = CURRENT.lock().unwrap_or_else(PoisonError::into_inner).take() {
        hotkeys::unregister(hotkey);
    }

    let snapshot = service().ok().and_then(|service| service.snapshot().ok());
    if snapshot.as_ref().is_some_and(|snapshot| !snapshot.settings.enabled || !snapshot.settings.shortcut_enabled) {
        report_hotkey_error(None);
        return;
    }
    let Some(binding) = snapshot
        .and_then(|snapshot| parse_shortcut_binding(&snapshot.settings.shortcut))
        .or_else(default_shortcut_binding)
    else {
        return;
    };
    let Some(hotkey) = to_hotkey(&binding) else {
        report_hotkey_error(Some(format!("快捷键 {} 在 macOS 上不能用作全局快捷键", binding.label)));
        return;
    };
    match hotkeys::register(hotkey, on_shortcut) {
        Ok(()) => {
            *CURRENT.lock().unwrap_or_else(PoisonError::into_inner) = Some(hotkey);
            report_hotkey_error(None);
        }
        Err(HotkeyError::Manager(error)) => report_hotkey_error(Some(format!("无法注册全局快捷键：{error}"))),
        Err(HotkeyError::Register(error)) => report_hotkey_error(Some(format!("快捷键 {} 已被占用或无法注册：{error}", binding.label))),
    }
}

#[cfg(test)]
mod tests {
    use super::super::{default_shortcut_binding, DEFAULT_SHORTCUT};
    use super::to_hotkey;
    use global_hotkey::hotkey::{Code, HotKey, Modifiers};

    #[test]
    fn the_default_is_command_shift_v() {
        let binding = default_shortcut_binding().expect("the default shortcut is valid");
        assert_eq!(binding.label, DEFAULT_SHORTCUT);
        assert_eq!(to_hotkey(&binding), Some(HotKey::new(Some(Modifiers::SHIFT | Modifiers::META), Code::KeyV)));
    }
}
