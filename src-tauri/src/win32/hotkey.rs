use windows::{
    core::Result,
    Win32::{
        Foundation::HWND,
        UI::Input::KeyboardAndMouse::{
            RegisterHotKey, UnregisterHotKey, HOT_KEY_MODIFIERS, MOD_NOREPEAT,
        },
    },
};

pub(crate) fn register(window: HWND, id: i32, modifiers: u32, key_code: u32) -> Result<()> {
    unsafe {
        RegisterHotKey(
            Some(window),
            id,
            HOT_KEY_MODIFIERS(modifiers | MOD_NOREPEAT.0),
            key_code,
        )
    }
}

pub(crate) fn unregister(window: HWND, id: i32) -> Result<()> {
    unsafe { UnregisterHotKey(Some(window), id) }
}
