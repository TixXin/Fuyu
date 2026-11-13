use global_hotkey::hotkey::{Code, HotKey, Modifiers};

use super::shortcut::{ShortcutBinding, MOD_ALT, MOD_CONTROL, MOD_SHIFT, MOD_WIN};

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

pub(crate) fn to_hotkey(binding: &ShortcutBinding) -> Option<HotKey> {
    let mut modifiers = Modifiers::empty();
    for (flag, modifier) in [(MOD_CONTROL, Modifiers::CONTROL), (MOD_ALT, Modifiers::ALT), (MOD_SHIFT, Modifiers::SHIFT), (MOD_WIN, Modifiers::META)] {
        if binding.modifiers & flag != 0 {
            modifiers |= modifier;
        }
    }
    Some(HotKey::new(Some(modifiers), key_code(binding.key_code)?))
}

#[cfg(test)]
mod tests {
    use super::super::parse_shortcut_binding;
    use super::{key_code, to_hotkey, Code, HotKey, Modifiers};

    #[test]
    fn saved_shortcuts_map_to_mac_keys() {
        let binding = parse_shortcut_binding("Ctrl+Alt+F5").expect("valid");
        assert_eq!(to_hotkey(&binding), Some(HotKey::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::F5)));
        assert_eq!(key_code(0x39), Some(Code::Digit9));
        assert_eq!(key_code(0x27), Some(Code::ArrowRight));
        assert_eq!(key_code(0x87), None);
    }
}
