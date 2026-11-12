#[path = "shortcut.rs"]
mod shortcut;

use serde_json::Value;
use tauri::AppHandle;

pub(crate) use shortcut::parse_shortcut_binding;

pub(crate) const POPUP_WINDOW_LABEL: &str = "clipboard";

pub fn init(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}

pub(crate) fn clipboard_capture_paused() -> bool {
    false
}

fn unsupported() -> Result<Value, (u16, String)> {
    Err((501, crate::user_error::unsupported().to_string()))
}

pub(crate) fn plugin_history(_params: &Value) -> Result<Value, (u16, String)> {
    unsupported()
}

pub(crate) fn local_api_history(_params: &Value) -> Result<Value, (u16, String)> {
    unsupported()
}

pub(crate) fn plugin_item(_id: &str) -> Option<Value> {
    None
}

crate::user_error::unsupported_commands!(
    get_clipboard_history,
    set_clipboard_history_settings,
    get_clipboard_shortcut_error,
    copy_clipboard_history_item,
    copy_clipboard_history_item_as,
    paste_clipboard_history_item,
    hide_clipboard_popup,
    paste_clipboard_sequence,
    export_clipboard_history,
    import_clipboard_history,
    save_clipboard_snippet,
    delete_clipboard_snippet,
    paste_clipboard_snippet,
    toggle_clipboard_history_favorite,
    set_clipboard_history_item_note,
    delete_clipboard_history_item,
    restore_clipboard_history_item,
    clear_clipboard_history,
    get_clipboard_image_preview,
);

pub(crate) mod actions {
    pub(crate) fn toggle_capture_pause() {}

    crate::user_error::unsupported_commands!(
        paste_clipboard_text,
        add_clipboard_history_text,
        pause_clipboard_capture,
        resume_clipboard_capture,
        ignore_next_clipboard_copy,
        convert_chinese_text,
        read_clipboard_image_qr,
        get_clipboard_link_preview,
    );
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::clipboard_history::get_clipboard_history,
            crate::clipboard_history::set_clipboard_history_settings,
            crate::clipboard_history::get_clipboard_shortcut_error,
            crate::clipboard_history::copy_clipboard_history_item,
            crate::clipboard_history::copy_clipboard_history_item_as,
            crate::clipboard_history::paste_clipboard_history_item,
            crate::clipboard_history::hide_clipboard_popup,
            crate::clipboard_history::paste_clipboard_sequence,
            crate::clipboard_history::export_clipboard_history,
            crate::clipboard_history::import_clipboard_history,
            crate::clipboard_history::save_clipboard_snippet,
            crate::clipboard_history::delete_clipboard_snippet,
            crate::clipboard_history::paste_clipboard_snippet,
            crate::clipboard_history::toggle_clipboard_history_favorite,
            crate::clipboard_history::set_clipboard_history_item_note,
            crate::clipboard_history::delete_clipboard_history_item,
            crate::clipboard_history::restore_clipboard_history_item,
            crate::clipboard_history::clear_clipboard_history,
            crate::clipboard_history::get_clipboard_image_preview,
            crate::clipboard_history::actions::paste_clipboard_text,
            crate::clipboard_history::actions::add_clipboard_history_text,
            crate::clipboard_history::actions::pause_clipboard_capture,
            crate::clipboard_history::actions::resume_clipboard_capture,
            crate::clipboard_history::actions::ignore_next_clipboard_copy,
            crate::clipboard_history::actions::convert_chinese_text,
            crate::clipboard_history::actions::read_clipboard_image_qr,
            crate::clipboard_history::actions::get_clipboard_link_preview,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
