use windows::Win32::{
    Foundation::HWND,
    UI::WindowsAndMessaging::{SetWindowPos, HWND_BOTTOM, HWND_NOTOPMOST, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW},
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
