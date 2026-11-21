use windows::Win32::{
    Foundation::{HWND, RECT},
    Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    UI::{
        HiDpi::GetDpiForWindow,
        Shell::{SHAppBarMessage, ABM_GETSTATE, ABS_AUTOHIDE, APPBARDATA},
        WindowsAndMessaging::{
            FindWindowW, GetWindow, HWND_TOPMOST, SWP_NOMOVE, SWP_NOSIZE, GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWLP_HWNDPARENT,
            GWL_EXSTYLE, GW_OWNER, SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_NOZORDER,
            WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
        },
    },
};
use windows::core::w;

use super::{registry, window};

const SECONDARY_CLASS: &str = "Shell_SecondaryTrayWnd";
const VERSION_KEY: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion";
const FIRST_WINDOWS_11_BUILD: u32 = 22000;
const PERSONALIZE_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";

#[derive(Clone, Copy, Debug)]
pub(crate) struct TaskbarWindow {
    pub handle: HWND,
    pub rect: RECT,
    pub monitor: RECT,
    pub primary: bool,
}

pub(crate) fn taskbars() -> Vec<TaskbarWindow> {
    let mut found = Vec::new();
    if let Some(primary) = primary_taskbar().and_then(|handle| describe(handle, true)) {
        found.push(primary);
    }
    let _ = window::for_each_top_level_window(|handle| {
        if window::class_name(handle) == SECONDARY_CLASS {
            if let Some(bar) = describe(handle, false) {
                found.push(bar);
            }
        }
    });
    found
}

fn primary_taskbar() -> Option<HWND> {
    unsafe { FindWindowW(w!("Shell_TrayWnd"), None) }.ok().filter(|handle| !handle.is_invalid())
}

fn describe(handle: HWND, primary: bool) -> Option<TaskbarWindow> {
    let rect = window::window_rect(handle)?;
    let mut info = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
    let monitor = unsafe { MonitorFromWindow(handle, MONITOR_DEFAULTTONEAREST) };
    unsafe { GetMonitorInfoW(monitor, &mut info) }.as_bool().then_some(TaskbarWindow {
        handle,
        rect,
        monitor: info.rcMonitor,
        primary,
    })
}

pub(crate) fn is_windows_11() -> bool {
    registry::read_string(windows::Win32::System::Registry::HKEY_LOCAL_MACHINE, VERSION_KEY, "CurrentBuild")
        .and_then(|build| build.trim().parse::<u32>().ok())
        .is_some_and(|build| build >= FIRST_WINDOWS_11_BUILD)
}

pub(crate) fn dpi_scale(handle: HWND) -> f64 {
    match unsafe { GetDpiForWindow(handle) } {
        0 => 1.0,
        dpi => f64::from(dpi) / 96.0,
    }
}

pub(crate) fn uses_light_theme() -> bool {
    registry::read_u32(windows::Win32::System::Registry::HKEY_CURRENT_USER, PERSONALIZE_KEY, "SystemUsesLightTheme") == Some(1)
}

pub(crate) fn auto_hide_enabled() -> bool {
    let mut data = APPBARDATA { cbSize: std::mem::size_of::<APPBARDATA>() as u32, ..Default::default() };
    let state = unsafe { SHAppBarMessage(ABM_GETSTATE, &mut data) };
    state & ABS_AUTOHIDE as usize != 0
}

pub(crate) fn owner(handle: HWND) -> Option<HWND> {
    unsafe { GetWindow(handle, GW_OWNER) }.ok().filter(|owner| !owner.is_invalid())
}

pub(crate) fn set_owner(handle: HWND, owner: Option<HWND>) {
    let value = owner.map_or(0, |owner| owner.0 as isize);
    unsafe {
        let _ = SetWindowLongPtrW(handle, GWLP_HWNDPARENT, value);
    }
}

pub(crate) fn extended_style_flags(handle: HWND) -> (bool, bool) {
    let style = unsafe { GetWindowLongPtrW(handle, GWL_EXSTYLE) } as u32;
    (style & WS_EX_TOOLWINDOW.0 != 0, style & WS_EX_NOACTIVATE.0 != 0)
}

pub(crate) fn set_extended_style_flags(handle: HWND, tool_window: bool, no_activate: bool) {
    unsafe {
        let style = GetWindowLongPtrW(handle, GWL_EXSTYLE);
        let mut next = style & !((WS_EX_TOOLWINDOW.0 | WS_EX_NOACTIVATE.0) as isize);
        if tool_window {
            next |= WS_EX_TOOLWINDOW.0 as isize;
        }
        if no_activate {
            next |= WS_EX_NOACTIVATE.0 as isize;
        }
        if next != style {
            let _ = SetWindowLongPtrW(handle, GWL_EXSTYLE, next);
        }
    }
}

pub(crate) fn raise(handle: HWND) {
    unsafe {
        let _ = SetWindowPos(handle, Some(HWND_TOPMOST), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS);
    }
}

pub(crate) fn move_to(handle: HWND, rect: RECT) {
    unsafe {
        let _ = SetWindowPos(
            handle,
            None,
            rect.left,
            rect.top,
            rect.right - rect.left,
            rect.bottom - rect.top,
            SWP_NOACTIVATE | SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_ASYNCWINDOWPOS,
        );
    }
}
