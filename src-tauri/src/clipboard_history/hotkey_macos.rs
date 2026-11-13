use global_hotkey::{
    hotkey::{Code, HotKey, Modifiers},
    GlobalHotKeyEvent, GlobalHotKeyManager, HotKeyState,
};
use std::{
    cell::RefCell,
    sync::{
        atomic::{AtomicU32, Ordering},
        Mutex, PoisonError,
    },
};
use tauri::Emitter;

use super::shortcut::{MOD_ALT, MOD_CONTROL, MOD_SHIFT, MOD_WIN};
use super::{default_shortcut_binding, parse_shortcut_binding, service, ShortcutBinding};

pub(super) const HOTKEY_EVENT: &str = "clipboard-history-shortcut";
const HOTKEY_STATUS_EVENT: &str = "clipboard-history-shortcut-status";

const LETTERS: [Code; 26] = [
    Code::KeyA, Code::KeyB, Code::KeyC, Code::KeyD, Code::KeyE, Code::KeyF, Code::KeyG, Code::KeyH, Code::KeyI,
    Code::KeyJ, Code::KeyK, Code::KeyL, Code::KeyM, Code::KeyN, Code::KeyO, Code::KeyP, Code::KeyQ, Code::KeyR,
    Code::KeyS, Code::KeyT, Code::KeyU, Code::KeyV, Code::KeyW, Code::KeyX, Code::KeyY, Code::KeyZ,
];
const DIGITS: [Code; 10] = [
    Code::Digit0, Code::Digit1, Code::Digit2, Code::Digit3, Code::Digit4,
    Code::Digit5, Code::Digit6, Code::Digit7, Code::Digit8, Code::Digit9,
];
const FUNCTION_KEYS: [Code; 20] = [
    Code::F1, Code::F2, Code::F3, Code::F4, Code::F5, Code::F6, Code::F7, Code::F8, Code::F9, Code::F10,
    Code::F11, Code::F12, Code::F13, Code::F14, Code::F15, Code::F16, Code::F17, Code::F18, Code::F19, Code::F20,
];

static ERROR: Mutex<Option<String>> = Mutex::new(None);
static ACTIVE_ID: AtomicU32 = AtomicU32::new(0);

thread_local! {
    static MANAGER: RefCell<Option<(GlobalHotKeyManager, Option<HotKey>)>> = const { RefCell::new(None) };
}

fn key_code(code: u32) -> Option<Code> {
    let at = |base: u32| usize::try_from(code - base).ok();
    Some(match code {
        0x41..=0x5A => LETTERS[at(0x41)?],
        0x30..=0x39 => DIGITS[at(0x30)?],
        0x70..=0x83 => FUNCTION_KEYS[at(0x70)?],
        0x1B => Code::Escape,
        0x09 => Code::Tab,
        0x0D => Code::Enter,
        0x20 => Code::Space,
        0x08 => Code::Backspace,
        0x2E => Code::Delete,
        0x2D => Code::Insert,
        0x24 => Code::Home,
        0x23 => Code::End,
        0x21 => Code::PageUp,
        0x22 => Code::PageDown,
        0x26 => Code::ArrowUp,
        0x28 => Code::ArrowDown,
        0x25 => Code::ArrowLeft,
        0x27 => Code::ArrowRight,
        _ => return None,
    })
}

fn to_hotkey(binding: &ShortcutBinding) -> Option<HotKey> {
    let mut modifiers = Modifiers::empty();
    for (flag, modifier) in [(MOD_CONTROL, Modifiers::CONTROL), (MOD_ALT, Modifiers::ALT), (MOD_SHIFT, Modifiers::SHIFT), (MOD_WIN, Modifiers::META)] {
        if binding.modifiers & flag != 0 {
            modifiers |= modifier;
        }
    }
    Some(HotKey::new(Some(modifiers), key_code(binding.key_code)?))
}

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

fn on_hotkey(event: GlobalHotKeyEvent) {
    if event.state() == HotKeyState::Pressed && event.id() == ACTIVE_ID.load(Ordering::SeqCst) {
        if let Ok(service) = service() {
            service.emit_shortcut();
        }
    }
}

fn refresh() {
    MANAGER.with(|cell| {
        let mut slot = cell.borrow_mut();
        if slot.is_none() {
            match GlobalHotKeyManager::new() {
                Ok(manager) => {
                    GlobalHotKeyEvent::set_event_handler(Some(on_hotkey));
                    *slot = Some((manager, None));
                }
                Err(error) => {
                    report_hotkey_error(Some(format!("无法注册全局快捷键：{error}")));
                    return;
                }
            }
        }
        let Some((manager, current)) = slot.as_mut() else {
            return;
        };
        if let Some(hotkey) = current.take() {
            let _ = manager.unregister(hotkey);
            ACTIVE_ID.store(0, Ordering::SeqCst);
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
        match manager.register(hotkey) {
            Ok(()) => {
                ACTIVE_ID.store(hotkey.id(), Ordering::SeqCst);
                *current = Some(hotkey);
                report_hotkey_error(None);
            }
            Err(error) => report_hotkey_error(Some(format!("快捷键 {} 已被占用或无法注册：{error}", binding.label))),
        }
    });
}

#[cfg(test)]
mod tests {
    use super::super::{default_shortcut_binding, parse_shortcut_binding, DEFAULT_SHORTCUT};
    use super::{key_code, to_hotkey, Code, HotKey, Modifiers};

    #[test]
    fn the_default_is_command_shift_v() {
        let binding = default_shortcut_binding().expect("the default shortcut is valid");
        assert_eq!(binding.label, DEFAULT_SHORTCUT);
        assert_eq!(to_hotkey(&binding), Some(HotKey::new(Some(Modifiers::SHIFT | Modifiers::META), Code::KeyV)));
    }

    #[test]
    fn saved_shortcuts_map_to_mac_keys() {
        let binding = parse_shortcut_binding("Ctrl+Alt+F5").expect("valid");
        assert_eq!(to_hotkey(&binding), Some(HotKey::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::F5)));
        assert_eq!(key_code(0x39), Some(Code::Digit9));
        assert_eq!(key_code(0x27), Some(Code::ArrowRight));
        assert_eq!(key_code(0x87), None);
    }
}
