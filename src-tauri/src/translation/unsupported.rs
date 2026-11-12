use tauri::AppHandle;

pub(crate) const WINDOW_LABEL: &str = "translation";

pub fn init(_app: &AppHandle) {}

pub(crate) fn is_enabled() -> bool {
    false
}

pub(crate) fn open_translator(_app: &AppHandle) {}

crate::user_error::unsupported_commands!(
    toggle_translation_window,
    hide_translation_window,
    read_translation_clipboard,
    copy_translation_result,
    has_translation_secret,
    save_translation_secret,
    delete_translation_secret,
    translate_text,
    set_translation_shortcut,
    set_translation_selection_shortcut,
    set_translation_enabled,
    present_translation_window,
    set_translation_target,
);

pub(crate) mod rewrite {
    crate::user_error::unsupported_commands!(
        rewrite_text,
    );
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::translation::toggle_translation_window,
            crate::translation::hide_translation_window,
            crate::translation::read_translation_clipboard,
            crate::translation::copy_translation_result,
            crate::translation::has_translation_secret,
            crate::translation::save_translation_secret,
            crate::translation::delete_translation_secret,
            crate::translation::translate_text,
            crate::translation::rewrite::rewrite_text,
            crate::translation::set_translation_shortcut,
            crate::translation::set_translation_selection_shortcut,
            crate::translation::set_translation_enabled,
            crate::translation::present_translation_window,
            crate::translation::set_translation_target,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
