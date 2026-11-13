use crate::win32;

pub(super) fn is_marked_private() -> bool {
    win32::clipboard::is_marked_private()
}

pub(super) fn source_app_path() -> Option<String> {
    let window = win32::clipboard::owner_window().unwrap_or_else(win32::window::foreground_window);
    win32::process::image_path(win32::process::window_process_id(window))
}

pub(super) fn recognize_text(width: u32, height: u32, rgba: &[u8]) -> Option<String> {
    win32::ocr::recognize(width, height, rgba)
}

pub(super) fn to_simplified(text: &str) -> Option<String> {
    win32::chinese::to_simplified(text)
}

pub(super) fn to_traditional(text: &str) -> Option<String> {
    win32::chinese::to_traditional(text)
}
