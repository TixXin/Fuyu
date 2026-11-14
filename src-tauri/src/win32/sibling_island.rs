use windows::{
    core::PCWSTR,
    Win32::{
        Foundation::{CloseHandle, HWND},
        System::Threading::{OpenMutexW, SYNCHRONIZATION_SYNCHRONIZE},
        UI::{HiDpi::GetDpiForWindow, WindowsAndMessaging::GetWindowThreadProcessId},
    },
};

use super::window::{for_each_top_level_window, is_visible, window_rect};

pub(crate) struct ProcessWindow {
    pub(crate) left: i32,
    pub(crate) top: i32,
    pub(crate) width: i32,
    pub(crate) height: i32,
    pub(crate) scale: f64,
}

pub(crate) fn mutex_exists(name: &str) -> bool {
    let wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
    match unsafe { OpenMutexW(SYNCHRONIZATION_SYNCHRONIZE, false, PCWSTR(wide.as_ptr())) } {
        Ok(handle) => {
            let _ = unsafe { CloseHandle(handle) };
            true
        }
        Err(_) => false,
    }
}

fn owner_pid(window: HWND) -> u32 {
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(window, Some(&mut pid)) };
    pid
}

fn scale_of(window: HWND) -> f64 {
    f64::from(unsafe { GetDpiForWindow(window) }.max(96)) / 96.0
}

pub(crate) fn shown_windows_of(pid: u32) -> Vec<ProcessWindow> {
    let mut found = Vec::new();
    let _ = for_each_top_level_window(|window| {
        if owner_pid(window) != pid || !is_visible(window) {
            return;
        }
        if let Some(rect) = window_rect(window) {
            found.push(ProcessWindow {
                left: rect.left,
                top: rect.top,
                width: rect.right - rect.left,
                height: rect.bottom - rect.top,
                scale: scale_of(window),
            });
        }
    });
    found
}
