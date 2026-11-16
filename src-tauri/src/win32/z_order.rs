use windows::Win32::{
    Foundation::HWND,
    UI::WindowsAndMessaging::{SetWindowPos, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW},
};

pub(crate) fn show_below(window: HWND, above: HWND) -> bool {
    unsafe { SetWindowPos(window, Some(above), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW) }.is_ok()
}
