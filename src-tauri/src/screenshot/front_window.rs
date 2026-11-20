use std::path::Path;

use windows::Win32::Foundation::HWND;

use crate::win32;

const TITLE_UNITS: usize = 512;
const BROWSERS: [&str; 7] = ["chrome", "msedge", "firefox", "brave", "opera", "vivaldi", "arc"];

pub(super) struct Front(isize);

pub(super) fn front() -> Option<Front> {
    let window = win32::window::foreground_window();
    if window.is_invalid() || win32::window::process_id(window) == std::process::id() {
        return None;
    }
    Some(Front(window.0 as isize))
}

pub(super) fn describe(front: Front) -> Option<(String, String, Option<String>)> {
    let window = HWND(front.0 as *mut core::ffi::c_void);
    let path = win32::process::image_path(win32::window::process_id(window))?;
    let app = Path::new(&path).file_stem()?.to_string_lossy().into_owned();
    let title = win32::window::window_text(window, TITLE_UNITS);
    let browser = BROWSERS.iter().any(|name| app.eq_ignore_ascii_case(name));
    let url = if browser { win32::browser_url::address_bar(window) } else { None };
    Some((app, title, url))
}
