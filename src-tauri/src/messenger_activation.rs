use windows::Win32::Foundation::HWND;

use crate::{user_error::UserError, win32};

pub fn is_interactive_window(window: HWND) -> bool {
    win32::window::is_interactive(window)
}

pub fn activate_window(window: HWND, name: &str) -> Result<(), UserError> {
    if !is_interactive_window(window) {
        return Err(UserError::new(
            "messenger.notInteractive",
            format!("{name} has not restored an interactive main window yet; open it from the system tray."),
        )
        .arg("name", name));
    }
    if win32::window::bring_to_foreground(window) {
        return Ok(());
    }
    Err(UserError::new(
        "messenger.foreground",
        format!("Found the {name} window, but could not bring it to the front; click {name} in the taskbar or tray."),
    )
    .arg("name", name))
}

#[allow(dead_code)]
pub fn activate_existing_window(window: HWND, name: &str) -> Result<(), String> {
    activate_window(window, name).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::{
        core::w,
        Win32::UI::WindowsAndMessaging::{
            CreateWindowExW, DestroyWindow, IsWindowVisible, WINDOW_EX_STYLE, WS_POPUP,
        },
    };

    #[test]
    fn a_hidden_preloaded_window_is_never_forced_visible() {
        unsafe {
            let window = CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                w!("STATIC"),
                w!("Fuyu activation test"),
                WS_POPUP,
                0,
                0,
                10,
                10,
                None,
                None,
                None,
                None,
            )
            .unwrap();
            let result = activate_window(window, "QQ");
            let visible = IsWindowVisible(window).as_bool();
            DestroyWindow(window).unwrap();
            assert_eq!(result.unwrap_err().code(), "messenger.notInteractive");
            assert!(!visible, "A rejected hidden window must remain hidden");
        }
    }
}
