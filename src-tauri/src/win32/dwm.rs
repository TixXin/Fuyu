//! Desktop Window Manager attributes of our own windows.

use std::{ffi::c_void, mem::size_of};

use windows::{
    core::BOOL,
    Win32::{
        Foundation::HWND,
        Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_TRANSITIONS_FORCEDISABLED},
    },
};

/// Turns off the animations Windows plays when `window` is shown or hidden (the zoom and fade).
/// The screenshot overlays cover a whole monitor and must appear and vanish at once.
pub(crate) fn disable_transitions(window: HWND) -> windows::core::Result<()> {
    let disabled = BOOL::from(true);
    // SAFETY: `disabled` is a BOOL that outlives the call, and its size is passed with it;
    // DWMWA_TRANSITIONS_FORCEDISABLED takes exactly a BOOL.
    unsafe {
        DwmSetWindowAttribute(
            window,
            DWMWA_TRANSITIONS_FORCEDISABLED,
            &disabled as *const BOOL as *const c_void,
            size_of::<BOOL>() as u32,
        )
    }
}
