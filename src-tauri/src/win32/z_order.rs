use windows::Win32::{
    Foundation::HWND,
    UI::WindowsAndMessaging::{
        GetWindow, GetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GW_HWNDPREV, HWND_BOTTOM, HWND_NOTOPMOST, HWND_TOPMOST,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
        WS_EX_TRANSPARENT,
    },
};

pub(crate) fn show_below(window: HWND, above: HWND) -> bool {
    unsafe { SetWindowPos(window, Some(above), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW) }.is_ok()
}

pub(crate) fn set_topmost(window: HWND, topmost: bool) -> bool {
    let place = |after: HWND| unsafe { SetWindowPos(window, Some(after), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE) }.is_ok();
    if topmost {
        place(HWND_TOPMOST)
    } else {
        place(HWND_NOTOPMOST) && place(HWND_BOTTOM)
    }
}

pub(crate) fn windows_above(window: HWND, limit: usize) -> Vec<HWND> {
    let mut found = Vec::new();
    let mut current = window;
    while found.len() < limit {
        match unsafe { GetWindow(current, GW_HWNDPREV) } {
            Ok(previous) if !previous.is_invalid() => {
                found.push(previous);
                current = previous;
            }
            _ => break,
        }
    }
    found
}

fn ex_style(window: HWND) -> u32 {
    unsafe { GetWindowLongPtrW(window, GWL_EXSTYLE) as u32 }
}

pub(crate) fn is_topmost(window: HWND) -> bool {
    ex_style(window) & WS_EX_TOPMOST.0 != 0
}

pub(crate) fn is_popup_like(window: HWND) -> bool {
    ex_style(window) & (WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0 | WS_EX_TRANSPARENT.0) != 0
}
