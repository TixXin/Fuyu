use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Mutex, PoisonError,
    },
    time::Duration,
};

use global_hotkey::hotkey::HotKey;
use tauri::AppHandle;

use crate::clipboard_history::{mac_label, to_hotkey, ShortcutBinding};
use crate::macos::hotkeys;
use crate::user_error::UserError;

use super::{capture_and_emit_selection, open_translator, WantedBinding, APP, DEFAULT_SELECTION_SHORTCUT, DEFAULT_SHORTCUT};

static STARTED: AtomicBool = AtomicBool::new(false);
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
    let label = mac_label(&binding.label);
    UserError::new("shortcut.taken", format!("The shortcut {label} is taken or cannot be registered.")).arg("shortcut", label.as_str())
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

static WINDOW_BINDING: Mutex<WantedBinding> = Mutex::new(WantedBinding::Default);
static SELECTION_BINDING: Mutex<WantedBinding> = Mutex::new(WantedBinding::Default);

fn binding_slot(slot: Slot) -> &'static Mutex<WantedBinding> {
    match slot {
        Slot::Window => &WINDOW_BINDING,
        Slot::Selection => &SELECTION_BINDING,
    }
}

fn apply_and_remember(slot: Slot, binding: Option<ShortcutBinding>) -> Result<String, UserError> {
    let remembered = binding_slot(slot);
    let previous = match &*remembered.lock().unwrap_or_else(PoisonError::into_inner) {
        WantedBinding::Set(old) => Some(old.clone()),
        WantedBinding::Default | WantedBinding::Off => None,
    };
    let result = apply(slot, binding.clone(), previous.clone());
    *remembered.lock().unwrap_or_else(PoisonError::into_inner) = if result.is_ok() {
        WantedBinding::from_option(binding)
    } else {
        WantedBinding::from_option(previous)
    };
    result
}

pub(super) fn start(app: &AppHandle) -> Result<(), String> {
    STARTED.store(true, Ordering::SeqCst);
    app.run_on_main_thread(|| {
        if !STARTED.load(Ordering::SeqCst) {
            return;
        }
        for (slot, shortcut) in [(Slot::Window, DEFAULT_SHORTCUT), (Slot::Selection, DEFAULT_SELECTION_SHORTCUT)] {
            let wanted = binding_slot(slot).lock().unwrap_or_else(PoisonError::into_inner).resolve(shortcut);
            if let Some(binding) = wanted {
                let _ = apply_and_remember(slot, Some(binding));
            }
        }
    })
    .map_err(|error| format!("Could not start the translation shortcuts: {error}"))
}

fn release_all() {
    for slot in [Slot::Window, Slot::Selection] {
        if let Some(hotkey) = slot.current().lock().unwrap_or_else(PoisonError::into_inner).take() {
            hotkeys::unregister(hotkey);
        }
    }
}

pub(super) fn stop() {
    STARTED.store(false, Ordering::SeqCst);
    if let Some(app) = APP.get() {
        let _ = app.run_on_main_thread(release_all);
    }
}

pub(super) fn running() -> bool {
    STARTED.load(Ordering::SeqCst)
}

pub(super) fn want(binding: Option<ShortcutBinding>) {
    *binding_slot(Slot::Window).lock().unwrap_or_else(PoisonError::into_inner) = WantedBinding::from_option(binding);
}

pub(super) fn want_selection(binding: Option<ShortcutBinding>) {
    *binding_slot(Slot::Selection).lock().unwrap_or_else(PoisonError::into_inner) = WantedBinding::from_option(binding);
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
    use super::{to_hotkey, DEFAULT_SELECTION_SHORTCUT, DEFAULT_SHORTCUT};
    use crate::clipboard_history::parse_shortcut_binding;
    use global_hotkey::hotkey::{Code, HotKey, Modifiers};

    #[test]
    fn the_defaults_use_control_so_they_stay_clear_of_command_shortcuts() {
        let window = parse_shortcut_binding(DEFAULT_SHORTCUT).and_then(|binding| to_hotkey(&binding));
        assert_eq!(window, Some(HotKey::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyF)));
        let selection = parse_shortcut_binding(DEFAULT_SELECTION_SHORTCUT).and_then(|binding| to_hotkey(&binding));
        assert_eq!(selection, Some(HotKey::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyT)));
    }
}
