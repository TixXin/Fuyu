//! Desktop Window Manager attributes: turning off our windows' transitions, and reading where
//! other windows really are on screen.

use std::{ffi::c_void, mem::size_of};

use windows::{
    core::BOOL,
    Win32::{
        Foundation::{HWND, RECT},
        Graphics::Dwm::{
            DwmGetWindowAttribute, DwmSetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS,
            DWMWA_TRANSITIONS_FORCEDISABLED,
        },
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

/// The window as drawn, without the invisible resize border and shadow GetWindowRect includes
/// on Windows 10 and later. `None` when DWM does not know the window.
pub(crate) fn frame_bounds(window: HWND) -> Option<RECT> {
    let mut rect = RECT::default();
    // SAFETY: `rect` is a RECT that outlives the call, and its size is passed with it;
    // DWMWA_EXTENDED_FRAME_BOUNDS writes exactly a RECT.
    unsafe {
        DwmGetWindowAttribute(
            window,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            &mut rect as *mut RECT as *mut c_void,
            size_of::<RECT>() as u32,
        )
    }
    .ok()?;
    Some(rect)
}

/// Whether DWM hides `window` though it counts as visible: suspended Store apps, windows on
/// other virtual desktops.
pub(crate) fn is_cloaked(window: HWND) -> bool {
    let mut cloaked = 0u32;
    // SAFETY: `cloaked` is a u32 that outlives the call, and its size is passed with it;
    // DWMWA_CLOAKED writes exactly a DWORD.
    let read = unsafe {
        DwmGetWindowAttribute(
            window,
            DWMWA_CLOAKED,
            &mut cloaked as *mut u32 as *mut c_void,
            size_of::<u32>() as u32,
        )
    };
    read.is_ok() && cloaked != 0
}
