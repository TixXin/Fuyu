use windows::Win32::{
    Foundation::{HWND, RECT},
    UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON, VK_MBUTTON, VK_RBUTTON},
    UI::WindowsAndMessaging::{
        GetTopWindow, GetWindow, GetWindowLongW, GetWindowRect, IsIconic, IsWindowVisible, SetForegroundWindow, SetWindowPos, GWL_EXSTYLE,
        GW_HWNDNEXT, GW_OWNER, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, WS_EX_APPWINDOW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
    },
};

use crate::win32::{dwm, window::class_name};

const MAX_WINDOWS: usize = 4096;

fn owner(window: HWND) -> Option<HWND> {
    unsafe { GetWindow(window, GW_OWNER) }.ok().filter(|owner| !owner.is_invalid())
}

pub(super) fn mouse_button_down() -> bool {
    [VK_LBUTTON, VK_RBUTTON, VK_MBUTTON].into_iter().any(|button| unsafe { GetAsyncKeyState(i32::from(button.0)) } < 0)
}

pub(super) fn pass_to_desktop(widget: HWND) {
    if let Some(desktop) = owner(widget) {
        let _ = unsafe { SetForegroundWindow(desktop) };
    }
}

fn is_program(window: HWND) -> bool {
    let style = unsafe { GetWindowLongW(window, GWL_EXSTYLE) } as u32;
    let listed = style & WS_EX_APPWINDOW.0 != 0 || (owner(window).is_none() && style & (WS_EX_TOOLWINDOW.0 | WS_EX_NOACTIVATE.0) == 0);
    let mut rect = RECT::default();
    let sized = unsafe { GetWindowRect(window, &mut rect) }.is_ok() && rect.right > rect.left && rect.bottom > rect.top;
    listed
        && sized
        && style & WS_EX_TOPMOST.0 == 0
        && unsafe { IsWindowVisible(window) }.as_bool()
        && !unsafe { IsIconic(window) }.as_bool()
        && !dwm::is_cloaked(window)
        && !matches!(class_name(window).as_str(), "Progman" | "WorkerW")
}

pub(super) fn anchor<T: Copy + PartialEq>(order: impl IntoIterator<Item = (T, bool)>, desktop: T) -> Option<T> {
    let mut lowest = None;
    let mut passed_desktop = false;
    let mut covers_a_program = false;
    for (window, program) in order {
        if window == desktop {
            passed_desktop = true;
        } else if program {
            lowest = Some(window);
            covers_a_program |= passed_desktop;
        }
    }
    lowest.filter(|_| covers_a_program)
}

fn z_order() -> Vec<HWND> {
    let mut windows = Vec::new();
    let mut next = unsafe { GetTopWindow(None) }.ok();
    while let Some(window) = next.filter(|window| !window.is_invalid() && windows.len() < MAX_WINDOWS) {
        windows.push(window);
        next = unsafe { GetWindow(window, GW_HWNDNEXT) }.ok();
    }
    windows
}

pub(super) fn lower_below_programs(widget: HWND) {
    let Some(desktop) = owner(widget) else { return };
    let order = z_order().into_iter().map(|window| (window, window != desktop && owner(window) != Some(desktop) && is_program(window)));
    if let Some(lowest) = anchor(order, desktop) {
        let _ = unsafe { SetWindowPos(desktop, Some(lowest), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE) };
    }
}

#[cfg(test)]
mod tests {
    use super::anchor;

    #[test]
    fn the_desktop_goes_under_the_lowest_program_only_when_it_covers_one() {
        let raised = [(1, true), (9, false), (5, false), (2, true), (3, true), (4, false)];
        assert_eq!(anchor(raised, 5), Some(3), "a program lies under the desktop: put the desktop under the lowest one");
        let normal = [(1, true), (2, true), (4, false), (5, false), (6, false)];
        assert_eq!(anchor(normal, 5), None, "every program is already above the desktop");
        assert_eq!(anchor([(5, false)], 5), None);
        assert_eq!(anchor([(1, true), (2, false)], 5), None, "no desktop in the list");
    }
}
