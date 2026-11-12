use windows::{
    core::{w, Error, Result},
    Win32::{
        Foundation::HWND,
        UI::WindowsAndMessaging::{
            DeregisterShellHookWindow, RegisterShellHookWindow, RegisterWindowMessageW,
        },
    },
};

pub(crate) fn hook_message() -> Result<u32> {
    match unsafe { RegisterWindowMessageW(w!("SHELLHOOK")) } {
        0 => Err(Error::from_win32()),
        message => Ok(message),
    }
}

pub(crate) fn register_window(window: HWND) -> Result<()> {
    unsafe { RegisterShellHookWindow(window) }.ok()
}

pub(crate) fn deregister_window(window: HWND) -> Result<()> {
    unsafe { DeregisterShellHookWindow(window) }.ok()
}
