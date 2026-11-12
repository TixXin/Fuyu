//! Showing the desktop the way the taskbar does: minimizing every app window, and putting them
//! back. The first-run guide clears the screen with it, so the island stands alone.

use windows::{
    core::w,
    Win32::{
        Foundation::{LPARAM, WPARAM},
        UI::WindowsAndMessaging::{FindWindowW, PostMessageW, WM_COMMAND},
    },
};

/// The taskbar's own commands behind "Minimize all windows" (Win+M) and its undo
/// (Shift+Win+M). Unlike Win+D they leave windows that cannot be minimized, such as the
/// island, where they are, and they do not toggle.
const MINIMIZE_ALL: usize = 419;
const UNDO_MINIMIZE_ALL: usize = 416;

fn taskbar_command(command: usize) -> bool {
    // SAFETY: both strings are static, NUL-terminated wide literals; a missing taskbar is an error.
    let Ok(taskbar) = (unsafe { FindWindowW(w!("Shell_TrayWnd"), None) }) else {
        return false;
    };
    // SAFETY: posting a plain command with no pointers in it to a window handle just found.
    unsafe { PostMessageW(Some(taskbar), WM_COMMAND, WPARAM(command), LPARAM(0)) }.is_ok()
}

/// Minimizes every app window, showing the desktop. False when there is no taskbar to ask.
pub(crate) fn minimize_all_windows() -> bool {
    taskbar_command(MINIMIZE_ALL)
}

/// Brings back the windows `minimize_all_windows` minimized.
pub(crate) fn undo_minimize_all_windows() -> bool {
    taskbar_command(UNDO_MINIMIZE_ALL)
}
