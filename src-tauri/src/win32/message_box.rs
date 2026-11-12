use windows::{
    core::HSTRING,
    Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONWARNING, MB_OK, MB_SETFOREGROUND, MB_TOPMOST},
};

pub(crate) fn show_warning(title: &str, text: &str) {
    let title = HSTRING::from(title);
    let text = HSTRING::from(text);
    unsafe {
        MessageBoxW(None, &text, &title, MB_OK | MB_ICONWARNING | MB_TOPMOST | MB_SETFOREGROUND);
    }
}
