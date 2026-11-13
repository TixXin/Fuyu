use std::{
    sync::{atomic::Ordering, mpsc, Mutex, PoisonError},
    time::Duration,
};

use global_hotkey::hotkey::HotKey;
use tauri::AppHandle;

use crate::clipboard_history::{parse_shortcut_binding, to_hotkey, ShortcutBinding};
use crate::macos::hotkeys;
use crate::user_error::UserError;

use super::{capture_and_emit_selection, open_translator, APP, DEFAULT_SELECTION_SHORTCUT, DEFAULT_SHORTCUT, ENABLED};

static WINDOW_HOTKEY: Mutex<Option<HotKey>> = Mutex::new(None);
static SELECTION_HOTKEY: Mutex<Option<HotKey>> = Mutex::new(None);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Slot {
    Window,
    Selection,
}

impl Slot {
    fn current(self) -> &'static Mutex<Option<HotKey>> {
        match self {
            Self::Window => &WINDOW_HOTKEY,
            Self::Selection => &SELECTION_HOTKEY,
        }
    }

    fn handler(self) -> fn() {
        match self {
            Self::Window => open_window,
            Self::Selection => capture_and_emit_selection,
        }
    }
}

fn open_window() {
    if let Some(app) = APP.get() {
        open_translator(app);
    }
}

fn taken(binding: &ShortcutBinding) -> UserError {
    UserError::new("shortcut.taken", format!("The shortcut {} is taken or cannot be registered.", binding.label)).arg("shortcut", binding.label.as_str())
}

fn register(slot: Slot, binding: &ShortcutBinding) -> Result<HotKey, UserError> {
    let hotkey = to_hotkey(binding).ok_or_else(|| taken(binding))?;
    hotkeys::register(hotkey, slot.handler()).map_err(|error| {
        let detail = match error {
            hotkeys::HotkeyError::Manager(detail) | hotkeys::HotkeyError::Register(detail) => detail,
        };
        taken(binding).detail(detail)
    })?;
    Ok(hotkey)
}

fn apply(slot: Slot, binding: Option<ShortcutBinding>, previous: Option<ShortcutBinding>) -> Result<String, UserError> {
    let current = slot.current();
    if let Some(hotkey) = current.lock().unwrap_or_else(PoisonError::into_inner).take() {
        hotkeys::unregister(hotkey);
    }
    let Some(binding) = binding else {
        return Ok(String::new());
    };
    match register(slot, &binding) {
        Ok(hotkey) => {
            *current.lock().unwrap_or_else(PoisonError::into_inner) = Some(hotkey);
            Ok(binding.label)
        }
        Err(error) => {
            if let Some(hotkey) = previous.and_then(|old| register(slot, &old).ok()) {
                *current.lock().unwrap_or_else(PoisonError::into_inner) = Some(hotkey);
            }
            Err(error)
        }
    }
}

static WINDOW_BINDING: Mutex<Option<ShortcutBinding>> = Mutex::new(None);
static SELECTION_BINDING: Mutex<Option<ShortcutBinding>> = Mutex::new(None);

fn binding_slot(slot: Slot) -> &'static Mutex<Option<ShortcutBinding>> {
    match slot {
        Slot::Window => &WINDOW_BINDING,
        Slot::Selection => &SELECTION_BINDING,
    }
}

fn apply_and_remember(slot: Slot, binding: Option<ShortcutBinding>) -> Result<String, UserError> {
    let remembered = binding_slot(slot);
    let previous = remembered.lock().unwrap_or_else(PoisonError::into_inner).take();
    let result = apply(slot, binding.clone(), previous.clone());
    *remembered.lock().unwrap_or_else(PoisonError::into_inner) = if result.is_ok() { binding } else { previous };
    result
}

pub(super) fn start(app: &AppHandle) {
    let _ = app.run_on_main_thread(|| {
        for (slot, shortcut) in [(Slot::Window, DEFAULT_SHORTCUT), (Slot::Selection, DEFAULT_SELECTION_SHORTCUT)] {
            if let Some(binding) = parse_shortcut_binding(shortcut).filter(|_| ENABLED.load(Ordering::SeqCst)) {
                let _ = apply_and_remember(slot, Some(binding));
            }
        }
    });
}

fn on_main_thread(slot: Slot, binding: Option<ShortcutBinding>) -> Result<String, UserError> {
    let app = APP.get().ok_or_else(|| UserError::new("shortcut.notReady", "The shortcut service is not ready yet."))?;
    let (sender, receiver) = mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = sender.send(apply_and_remember(slot, binding));
    })
    .map_err(|error| UserError::new("shortcut.update", "Could not change the shortcut.").detail(error))?;
    receiver
        .recv_timeout(Duration::from_secs(2))
        .map_err(|error| UserError::new("shortcut.timeout", "Changing the shortcut took too long.").detail(error))?
}

pub(super) fn change_hotkey(binding: Option<ShortcutBinding>) -> Result<String, UserError> {
    on_main_thread(Slot::Window, binding)
}

pub(super) fn change_selection_hotkey(binding: Option<ShortcutBinding>) -> Result<String, UserError> {
    on_main_thread(Slot::Selection, binding)
}

#[cfg(test)]
mod tests {
    use super::{parse_shortcut_binding, to_hotkey, DEFAULT_SELECTION_SHORTCUT, DEFAULT_SHORTCUT};
    use global_hotkey::hotkey::{Code, HotKey, Modifiers};

    #[test]
    fn the_defaults_use_control_so_they_stay_clear_of_command_shortcuts() {
        let window = parse_shortcut_binding(DEFAULT_SHORTCUT).and_then(|binding| to_hotkey(&binding));
        assert_eq!(window, Some(HotKey::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyF)));
        let selection = parse_shortcut_binding(DEFAULT_SELECTION_SHORTCUT).and_then(|binding| to_hotkey(&binding));
        assert_eq!(selection, Some(HotKey::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyT)));
    }
}
