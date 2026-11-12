use windows::{
    core::w,
    Win32::{
        Foundation::{LPARAM, WPARAM},
        UI::WindowsAndMessaging::{FindWindowW, PostMessageW, WM_COMMAND},
    },
};

const MINIMIZE_ALL: usize = 419;
const UNDO_MINIMIZE_ALL: usize = 416;

fn taskbar_command(command: usize) -> bool {
    let Ok(taskbar) = (unsafe { FindWindowW(w!("Shell_TrayWnd"), None) }) else {
        return false;
    };
    unsafe { PostMessageW(Some(taskbar), WM_COMMAND, WPARAM(command), LPARAM(0)) }.is_ok()
}

pub(crate) fn minimize_all_windows() -> bool {
    taskbar_command(MINIMIZE_ALL)
}

pub(crate) fn undo_minimize_all_windows() -> bool {
    taskbar_command(UNDO_MINIMIZE_ALL)
}
