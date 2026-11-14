use windows::{
    core::BOOL,
    Win32::{
        Foundation::{HWND, LPARAM, POINT, RECT, WPARAM},
        Graphics::Gdi::{MonitorFromWindow, SetWindowRgn, MONITOR_DEFAULTTONEAREST},
        System::Threading::{AttachThreadInput, GetCurrentThreadId},
        UI::{
            Input::KeyboardAndMouse::IsWindowEnabled,
            Shell::{Shell_NotifyIconGetRect, NOTIFYICONIDENTIFIER},
            WindowsAndMessaging::{
                AllowSetForegroundWindow, BringWindowToTop, EnumWindows, FlashWindowEx, IsGUIThread,
                FLASHWINFO, FLASHW_ALL, FLASHW_TIMERNOFG, GetClassNameW, GetCursorPos,
                GetForegroundWindow, GetWindow, GetWindowLongPtrW, GetWindowPlacement,
                GetWindowRect, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindowVisible, SendMessageTimeoutW,
                SetForegroundWindow, SetWindowDisplayAffinity, SetWindowLongPtrW, ShowWindow, GWL_EXSTYLE, WDA_EXCLUDEFROMCAPTURE, WDA_NONE, GW_OWNER, SMTO_ABORTIFHUNG,
                SMTO_BLOCK, SMTO_ERRORONEXIT, SW_HIDE, SW_RESTORE, SW_SHOWNOACTIVATE, WINDOWPLACEMENT, WM_NULL,
                WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
            },
        },
    },
};

const MAX_CLASS_NAME_UNITS: usize = 256;

pub(crate) fn for_each_top_level_window(mut visit: impl FnMut(HWND)) -> windows::core::Result<()> {
    unsafe extern "system" fn visit_window(window: HWND, context: LPARAM) -> BOOL {
        let visit = unsafe { &mut *(context.0 as *mut &mut dyn FnMut(HWND)) };
        visit(window);
        true.into()
    }

    let mut visit: &mut dyn FnMut(HWND) = &mut visit;
    unsafe {
        EnumWindows(
            Some(visit_window),
            LPARAM(&mut visit as *mut &mut dyn FnMut(HWND) as isize),
        )
    }
}

pub(crate) fn window_text(window: HWND, capacity: usize) -> String {
    let mut text = vec![0u16; capacity];
    let length = unsafe { GetWindowTextW(window, &mut text) } as usize;
    String::from_utf16_lossy(&text[..length])
}

pub(crate) fn class_name(window: HWND) -> String {
    let mut class = [0u16; MAX_CLASS_NAME_UNITS];
    let length = unsafe { GetClassNameW(window, &mut class) } as usize;
    String::from_utf16_lossy(&class[..length])
}

pub(crate) fn has_owner(window: HWND) -> bool {
    unsafe { GetWindow(window, GW_OWNER) }.is_ok_and(|owner| !owner.is_invalid())
}

pub(crate) fn normal_position(window: HWND) -> Option<RECT> {
    let mut placement = WINDOWPLACEMENT {
        length: std::mem::size_of::<WINDOWPLACEMENT>() as u32,
        ..Default::default()
    };
    unsafe { GetWindowPlacement(window, &mut placement) }.ok()?;
    Some(placement.rcNormalPosition)
}

pub(crate) fn is_visible(window: HWND) -> bool {
    unsafe { IsWindowVisible(window) }.as_bool()
}

pub(crate) fn is_minimized(window: HWND) -> bool {
    unsafe { IsIconic(window) }.as_bool()
}

pub(crate) fn foreground_window() -> HWND {
    unsafe { GetForegroundWindow() }
}

pub(crate) fn allow_set_foreground_window(process_id: u32) {
    let _ = unsafe { AllowSetForegroundWindow(process_id) };
}

pub(crate) fn send_message_with_timeout(
    window: HWND,
    message: u32,
    wparam: usize,
    lparam: isize,
    timeout_ms: u32,
) -> bool {
    unsafe {
        SendMessageTimeoutW(
            window,
            message,
            WPARAM(wparam),
            LPARAM(lparam),
            SMTO_ABORTIFHUNG | SMTO_BLOCK | SMTO_ERRORONEXIT,
            timeout_ms,
            None,
        )
    }
    .0 != 0
}

pub(crate) fn notify_icon_exists(owner: HWND, id: u32) -> bool {
    let identifier = NOTIFYICONIDENTIFIER {
        cbSize: std::mem::size_of::<NOTIFYICONIDENTIFIER>() as u32,
        hWnd: owner,
        uID: id,
        ..Default::default()
    };
    unsafe { Shell_NotifyIconGetRect(&identifier) }.is_ok()
}

pub(crate) fn window_rect(window: HWND) -> Option<RECT> {
    let mut rect = RECT::default();
    unsafe { GetWindowRect(window, &mut rect) }.ok()?;
    Some(rect)
}

pub(crate) fn cursor_position() -> Option<POINT> {
    let mut cursor = POINT::default();
    unsafe { GetCursorPos(&mut cursor) }.ok()?;
    Some(cursor)
}

pub(crate) fn exclude_from_capture(window: HWND, excluded: bool) -> bool {
    let affinity = if excluded { WDA_EXCLUDEFROMCAPTURE } else { WDA_NONE };
    unsafe { SetWindowDisplayAffinity(window, affinity) }.is_ok()
}

pub(crate) fn clear_window_region(window: HWND) -> bool {
    let result = unsafe { SetWindowRgn(window, None, true) };
    result != 0
}

pub(crate) fn is_interactive(window: HWND) -> bool {
    unsafe {
        let style = GetWindowLongPtrW(window, GWL_EXSTYLE) as u32;
        IsWindowVisible(window).as_bool()
            && !IsIconic(window).as_bool()
            && IsWindowEnabled(window).as_bool()
            && style & (WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0) == 0
            && SendMessageTimeoutW(
                window,
                WM_NULL,
                WPARAM(0),
                LPARAM(0),
                SMTO_ABORTIFHUNG | SMTO_BLOCK | SMTO_ERRORONEXIT,
                250,
                None,
            )
            .0 != 0
    }
}

pub(crate) fn restore_minimized(window: HWND) {
    if is_minimized(window) {
        let _ = unsafe { ShowWindow(window, SW_RESTORE) };
    }
}

pub(crate) fn activate_from_background(window: HWND) -> bool {
    let foreground = foreground_window();
    if foreground == window {
        return true;
    }
    let (foreground_thread, own_thread) =
        unsafe { (GetWindowThreadProcessId(foreground, None), GetCurrentThreadId()) };
    let attach = foreground_thread != 0 && foreground_thread != own_thread;
    unsafe {
        let attached = attach && AttachThreadInput(own_thread, foreground_thread, true).as_bool();
        let _ = SetForegroundWindow(window);
        if attached {
            let _ = AttachThreadInput(own_thread, foreground_thread, false);
        }
    }
    foreground_window() == window
}

pub(crate) fn show_without_activating(window: HWND) {
    let _ = unsafe { ShowWindow(window, SW_SHOWNOACTIVATE) };
}

pub(crate) fn hide_window(window: HWND) {
    let _ = unsafe { ShowWindow(window, SW_HIDE) };
}

pub(crate) fn set_no_activate(window: HWND, enabled: bool) {
    unsafe {
        let style = GetWindowLongPtrW(window, GWL_EXSTYLE);
        let flag = WS_EX_NOACTIVATE.0 as isize;
        let next = if enabled { style | flag } else { style & !flag };
        if next != style {
            let _ = SetWindowLongPtrW(window, GWL_EXSTYLE, next);
        }
    }
}

pub(crate) fn share_monitor(a: HWND, b: HWND) -> bool {
    unsafe { MonitorFromWindow(a, MONITOR_DEFAULTTONEAREST) == MonitorFromWindow(b, MONITOR_DEFAULTTONEAREST) }
}

pub(crate) fn bring_to_foreground(window: HWND) -> bool {
    unsafe { GetForegroundWindow() == window || SetForegroundWindow(window).as_bool() }
}

pub(crate) fn force_foreground(window: HWND) -> bool {
    restore_minimized(window);
    if bring_to_foreground(window) && foreground_window() == window {
        return true;
    }
    let foreground = foreground_window();
    let (foreground_thread, own_thread) = unsafe {
        let _ = IsGUIThread(true);
        (GetWindowThreadProcessId(foreground, None), GetCurrentThreadId())
    };
    let attach = foreground_thread != 0 && foreground_thread != own_thread;
    unsafe {
        let attached = attach && AttachThreadInput(own_thread, foreground_thread, true).as_bool();
        let _ = BringWindowToTop(window);
        let _ = SetForegroundWindow(window);
        if attached {
            let _ = AttachThreadInput(own_thread, foreground_thread, false);
        }
    }
    foreground_window() == window
}

pub(crate) fn flash(window: HWND) {
    let info = FLASHWINFO {
        cbSize: std::mem::size_of::<FLASHWINFO>() as u32,
        hwnd: window,
        dwFlags: FLASHW_ALL | FLASHW_TIMERNOFG,
        uCount: 0,
        dwTimeout: 0,
    };
    let _ = unsafe { FlashWindowEx(&info) };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_windows_have_no_rect_and_are_not_interactive() {
        assert_eq!(window_rect(HWND::default()).map(|_| ()), None);
        assert!(!is_interactive(HWND::default()));
        assert!(!clear_window_region(HWND::default()));
        assert_eq!(window_text(HWND::default(), 32), "");
        assert_eq!(class_name(HWND::default()), "");
        assert!(!has_owner(HWND::default()));
        assert_eq!(normal_position(HWND::default()).map(|_| ()), None);
        assert!(!is_visible(HWND::default()));
        assert!(!notify_icon_exists(HWND::default(), 1));
    }

    #[test]
    fn enumeration_visits_top_level_windows_through_the_closure() {
        let mut visited = Vec::new();
        for_each_top_level_window(|window| visited.push(window)).unwrap();
        assert!(!visited.is_empty());
        assert!(visited.iter().all(|window| !window.is_invalid()));
    }
}
