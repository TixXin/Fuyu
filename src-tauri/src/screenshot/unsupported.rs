use tauri::AppHandle;

pub(crate) const WINDOW_PREFIX: &str = "screenshot-";
pub(crate) const PIN_PREFIX: &str = "pin-";

pub(crate) fn init(_app: &AppHandle) {}

pub(crate) fn cancel(_app: &AppHandle) {}

pub(crate) fn forget_pin(_label: &str) {}


crate::user_error::unsupported_commands!(
    screenshot_session,
    screenshot_frame,
    screenshot_targets,
    screenshot_overlay_ready,
    screenshot_finish,
    screenshot_cancel,
    screenshot_pin_info,
    screenshot_pin_image,
    screenshot_pin_ready,
    screenshot_pin_zoom,
    screenshot_pin_click_through,
    screenshot_pin_copy,
    screenshot_pin_save,
    screenshot_pin_close,
    screenshot_pins_toggle,
    screenshot_pins_close_all,
    screenshot_drag,
    screenshot_paste_to_front,
    screenshot_start,
    screenshot_find_words,
    screenshot_long_bar,
    screenshot_long_pause,
    screenshot_long_end,
    screenshot_history,
    screenshot_history_copy,
    screenshot_history_pin,
    screenshot_history_delete,
);

pub(crate) fn is_enabled() -> bool {
    false
}

pub(crate) fn start_from_tray(_app: &AppHandle) {}

#[tauri::command]
pub fn screenshot_configure() {}

#[tauri::command]
pub fn screenshot_shortcut_status() -> Vec<()> {
    Vec::new()
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::screenshot::screenshot_configure,
            crate::screenshot::screenshot_shortcut_status,
            crate::screenshot::screenshot_start,
            crate::screenshot::screenshot_find_words,
            crate::screenshot::screenshot_long_bar,
            crate::screenshot::screenshot_long_pause,
            crate::screenshot::screenshot_long_end,
            crate::screenshot::screenshot_history,
            crate::screenshot::screenshot_history_copy,
            crate::screenshot::screenshot_history_pin,
            crate::screenshot::screenshot_history_delete,
            crate::screenshot::screenshot_session,
            crate::screenshot::screenshot_frame,
            crate::screenshot::screenshot_targets,
            crate::screenshot::screenshot_overlay_ready,
            crate::screenshot::screenshot_finish,
            crate::screenshot::screenshot_cancel,
            crate::screenshot::screenshot_pin_info,
            crate::screenshot::screenshot_pin_image,
            crate::screenshot::screenshot_pin_ready,
            crate::screenshot::screenshot_pin_zoom,
            crate::screenshot::screenshot_pin_click_through,
            crate::screenshot::screenshot_pin_copy,
            crate::screenshot::screenshot_pin_save,
            crate::screenshot::screenshot_pin_close,
            crate::screenshot::screenshot_pins_toggle,
            crate::screenshot::screenshot_pins_close_all,
            crate::screenshot::screenshot_drag,
            crate::screenshot::screenshot_paste_to_front,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
