use windows::Win32::UI::Input::KeyboardAndMouse::{
    keybd_event, GetAsyncKeyState, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_CONTROL,
    VK_LBUTTON, VK_MENU, VK_RBUTTON, VK_RETURN,
};

pub(crate) fn is_alt_key_down() -> bool {
    is_key_down(VK_MENU)
}

pub(crate) fn is_left_button_down() -> bool {
    is_key_down(VK_LBUTTON)
}

pub(crate) fn is_any_button_down() -> bool {
    is_key_down(VK_LBUTTON) || is_key_down(VK_RBUTTON)
}

pub(crate) fn send_key_down(key: VIRTUAL_KEY) {
    send_key_event(key, KEYBD_EVENT_FLAGS(0));
}

pub(crate) fn send_key_up(key: VIRTUAL_KEY) {
    send_key_event(key, KEYEVENTF_KEYUP);
}

pub(crate) fn send_copy_shortcut() {
    let key_c = VIRTUAL_KEY(u16::from(b'C'));
    send_key_down(VK_CONTROL);
    send_key_down(key_c);
    send_key_up(key_c);
    send_key_up(VK_CONTROL);
}

pub(crate) fn send_paste_shortcut() {
    let key_v = VIRTUAL_KEY(u16::from(b'V'));
    send_key_down(VK_CONTROL);
    send_key_down(key_v);
    send_key_up(key_v);
    send_key_up(VK_CONTROL);
}

pub(crate) fn send_enter() {
    send_key_down(VK_RETURN);
    send_key_up(VK_RETURN);
}

fn send_key_event(key: VIRTUAL_KEY, flags: KEYBD_EVENT_FLAGS) {
    unsafe { keybd_event(key.0 as u8, 0, flags, 0) };
}

fn is_key_down(key: VIRTUAL_KEY) -> bool {
    let state = unsafe { GetAsyncKeyState(i32::from(key.0)) };
    state < 0
}
