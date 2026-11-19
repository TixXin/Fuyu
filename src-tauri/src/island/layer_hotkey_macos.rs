use std::sync::{Mutex, PoisonError};

use global_hotkey::hotkey::HotKey;

use crate::clipboard_history::{parse_shortcut_binding, to_hotkey};
use crate::macos::hotkeys;

static WANTED: Mutex<Option<String>> = Mutex::new(None);
static REGISTERED: Mutex<Option<HotKey>> = Mutex::new(None);

pub(super) fn configure(shortcut: Option<String>) -> Result<(), String> {
    *WANTED.lock().unwrap_or_else(PoisonError::into_inner) = shortcut;
    let app = super::layer::app().ok_or_else(|| "The island layer shortcut has no app handle yet.".to_string())?;
    app.run_on_main_thread(refresh).map_err(|error| error.to_string())
}

fn refresh() {
    if let Some(hotkey) = REGISTERED.lock().unwrap_or_else(PoisonError::into_inner).take() {
        hotkeys::unregister(hotkey);
    }
    let wanted = WANTED.lock().unwrap_or_else(PoisonError::into_inner).clone();
    let problem = match wanted.map(|shortcut| parse_shortcut_binding(&shortcut).and_then(|binding| to_hotkey(&binding))) {
        None => None,
        Some(None) => Some("invalid"),
        Some(Some(hotkey)) => match hotkeys::register(hotkey, super::layer::pressed) {
            Ok(()) => {
                *REGISTERED.lock().unwrap_or_else(PoisonError::into_inner) = Some(hotkey);
                None
            }
            Err(_) => Some("taken"),
        },
    };
    super::layer::report(problem);
}
