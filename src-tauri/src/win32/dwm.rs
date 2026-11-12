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

pub(crate) fn disable_transitions(window: HWND) -> windows::core::Result<()> {
    let disabled = BOOL::from(true);
    unsafe {
        DwmSetWindowAttribute(
            window,
            DWMWA_TRANSITIONS_FORCEDISABLED,
            &disabled as *const BOOL as *const c_void,
            size_of::<BOOL>() as u32,
        )
    }
}

pub(crate) fn frame_bounds(window: HWND) -> Option<RECT> {
    let mut rect = RECT::default();
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

pub(crate) fn is_cloaked(window: HWND) -> bool {
    let mut cloaked = 0u32;
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
