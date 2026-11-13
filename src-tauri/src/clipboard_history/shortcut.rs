pub(crate) const MOD_ALT: u32 = 0x0001;
pub(crate) const MOD_CONTROL: u32 = 0x0002;
pub(crate) const MOD_SHIFT: u32 = 0x0004;
pub(crate) const MOD_WIN: u32 = 0x0008;

#[derive(Clone)]
pub(crate) struct ShortcutBinding {
    pub(crate) label: String,
    pub(crate) modifiers: u32,
    pub(crate) key_code: u32,
}

pub(crate) fn parse_shortcut_binding(shortcut: &str) -> Option<ShortcutBinding> {
    let mut has_ctrl = false;
    let mut has_alt = false;
    let mut has_shift = false;
    let mut has_win = false;
    let mut key_label: Option<String> = None;
    let mut key_code: Option<u32> = None;

    for part in shortcut
        .split('+')
        .map(|part| part.trim())
        .filter(|part| !part.is_empty())
    {
        let normalized = part.to_ascii_lowercase();

        match normalized.as_str() {
            "ctrl" | "control" => has_ctrl = true,
            "alt" | "option" => has_alt = true,
            "shift" => has_shift = true,
            "win" | "windows" | "meta" | "cmd" | "super" => has_win = true,
            _ => {
                if key_code.is_some() {
                    return None;
                }

                let (label, code) = shortcut_key_code(part)?;
                key_label = Some(label);
                key_code = Some(code);
            }
        }
    }

    if !(has_ctrl || has_alt || has_shift || has_win) {
        return None;
    }

    let mut label_parts = Vec::new();
    let mut modifiers = 0;

    if has_ctrl {
        label_parts.push("Ctrl".to_string());
        modifiers |= MOD_CONTROL;
    }

    if has_alt {
        label_parts.push("Alt".to_string());
        modifiers |= MOD_ALT;
    }

    if has_shift {
        label_parts.push("Shift".to_string());
        modifiers |= MOD_SHIFT;
    }

    if has_win {
        label_parts.push("Win".to_string());
        modifiers |= MOD_WIN;
    }

    label_parts.push(key_label?);

    Some(ShortcutBinding {
        label: label_parts.join("+"),
        modifiers,
        key_code: key_code?,
    })
}

pub(crate) fn binding_label(modifiers: u32, key_code: u32) -> Option<String> {
    let key = match key_code {
        0x30..=0x39 | 0x41..=0x5A => char::from_u32(key_code)?.to_string(),
        0x70..=0x87 => format!("F{}", key_code - 0x70 + 1),
        0x1B => "Esc".to_string(),
        0x09 => "Tab".to_string(),
        0x0D => "Enter".to_string(),
        0x20 => "Space".to_string(),
        0x08 => "Backspace".to_string(),
        0x2E => "Delete".to_string(),
        0x2D => "Insert".to_string(),
        0x24 => "Home".to_string(),
        0x23 => "End".to_string(),
        0x21 => "PageUp".to_string(),
        0x22 => "PageDown".to_string(),
        0x26 => "Up".to_string(),
        0x28 => "Down".to_string(),
        0x25 => "Left".to_string(),
        0x27 => "Right".to_string(),
        _ => return None,
    };
    let names = [(MOD_CONTROL, "Ctrl"), (MOD_ALT, "Alt"), (MOD_SHIFT, "Shift"), (MOD_WIN, "Win")];
    let mut parts: Vec<String> = names.iter().filter(|(flag, _)| modifiers & flag != 0).map(|(_, name)| (*name).to_string()).collect();
    if parts.is_empty() {
        return None;
    }
    parts.push(key);
    Some(parts.join("+"))
}

fn shortcut_key_code(key: &str) -> Option<(String, u32)> {
    let upper = key.trim().to_ascii_uppercase();

    if upper.len() == 1 {
        let byte = upper.as_bytes()[0];

        if byte.is_ascii_alphanumeric() {
            return Some((upper, byte as u32));
        }
    }

    if let Some(number) = upper
        .strip_prefix('F')
        .and_then(|value| value.parse::<u32>().ok())
    {
        if (1..=24).contains(&number) {
            return Some((format!("F{number}"), 0x70 + number - 1));
        }
    }

    match upper.as_str() {
        "ESC" | "ESCAPE" => Some(("Esc".to_string(), 0x1B)),
        "TAB" => Some(("Tab".to_string(), 0x09)),
        "ENTER" | "RETURN" => Some(("Enter".to_string(), 0x0D)),
        "SPACE" => Some(("Space".to_string(), 0x20)),
        "BACKSPACE" => Some(("Backspace".to_string(), 0x08)),
        "DELETE" | "DEL" => Some(("Delete".to_string(), 0x2E)),
        "INSERT" | "INS" => Some(("Insert".to_string(), 0x2D)),
        "HOME" => Some(("Home".to_string(), 0x24)),
        "END" => Some(("End".to_string(), 0x23)),
        "PAGEUP" | "PAGE UP" => Some(("PageUp".to_string(), 0x21)),
        "PAGEDOWN" | "PAGE DOWN" => Some(("PageDown".to_string(), 0x22)),
        "ARROWUP" | "UP" => Some(("Up".to_string(), 0x26)),
        "ARROWDOWN" | "DOWN" => Some(("Down".to_string(), 0x28)),
        "ARROWLEFT" | "LEFT" => Some(("Left".to_string(), 0x25)),
        "ARROWRIGHT" | "RIGHT" => Some(("Right".to_string(), 0x27)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn space_shortcuts_parse_but_a_bare_space_key_does_not() {
        let binding = parse_shortcut_binding("Ctrl+Space").expect("Ctrl+Space is valid");
        assert_eq!(binding.label, "Ctrl+Space");
        assert_eq!(binding.key_code, 0x20);
        assert!(parse_shortcut_binding("Ctrl+ ").is_none());
    }

    #[test]
    fn a_pressed_binding_reads_back_as_the_saved_shortcut() {
        for shortcut in ["Ctrl+Shift+1", "Ctrl+Alt+T", "Shift+Win+V", "Alt+F5", "Ctrl+Space", "Ctrl+Shift+Left"] {
            let binding = parse_shortcut_binding(shortcut).expect("valid");
            assert_eq!(binding_label(binding.modifiers, binding.key_code).as_deref(), Some(shortcut));
        }
        assert_eq!(binding_label(0, 0x41), None);
        assert_eq!(binding_label(MOD_CONTROL, 0xBA), None);
    }
}
