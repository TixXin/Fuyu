use std::{
    sync::{
        atomic::{AtomicI64, Ordering},
        OnceLock,
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};

use crate::clipboard_history::shortcut::binding_label;

const SHORTCUT_CAPTURED_EVENT: &str = "shortcut-captured";
const CAPTURE_LIMIT_MS: i64 = 60_000;

static CAPTURE_UNTIL: AtomicI64 = AtomicI64::new(0);
static APP: OnceLock<AppHandle> = OnceLock::new();

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX))
        .unwrap_or(0)
}

#[tauri::command]
pub fn set_shortcut_capture(app: AppHandle, enabled: bool) {
    let _ = APP.set(app);
    #[cfg(target_os = "macos")]
    crate::macos::hotkeys::set_interceptor(capture_hotkey);
    let until = if enabled { now_ms() + CAPTURE_LIMIT_MS } else { 0 };
    CAPTURE_UNTIL.store(until, Ordering::SeqCst);
}

pub(crate) fn capture(modifiers: u32, key_code: u32) -> bool {
    if now_ms() >= CAPTURE_UNTIL.load(Ordering::SeqCst) {
        return false;
    }
    if let (Some(app), Some(shortcut)) = (APP.get(), binding_label(modifiers, key_code)) {
        let _ = app.emit(SHORTCUT_CAPTURED_EVENT, shortcut);
    }
    true
}

#[cfg(windows)]
pub(crate) fn capture_hotkey_message(lparam: isize) -> bool {
    let modifiers = u32::try_from(lparam & 0xFFFF).unwrap_or(0);
    let key_code = u32::try_from((lparam >> 16) & 0xFFFF).unwrap_or(0);
    capture(modifiers, key_code)
}

#[cfg(target_os = "macos")]
fn capture_hotkey(hotkey: &global_hotkey::hotkey::HotKey) -> bool {
    use crate::clipboard_history::shortcut_macos::{binding_modifiers, virtual_key};
    capture(binding_modifiers(hotkey.mods), virtual_key(hotkey.key).unwrap_or(0))
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::shortcut_capture::set_shortcut_capture,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
