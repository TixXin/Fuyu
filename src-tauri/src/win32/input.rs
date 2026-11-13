use std::mem::size_of;

use windows::Win32::UI::{
    Input::KeyboardAndMouse::{
        keybd_event, GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_MOUSE, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
        MOUSEEVENTF_WHEEL, MOUSEINPUT, VIRTUAL_KEY, VK_CONTROL, VK_ESCAPE, VK_LBUTTON, VK_MENU, VK_RBUTTON, VK_RETURN,
    },
    WindowsAndMessaging::SetCursorPos,
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

pub(crate) fn is_escape_down() -> bool {
    is_key_down(VK_ESCAPE)
}

pub(crate) fn move_cursor(x: i32, y: i32) -> bool {
    unsafe { SetCursorPos(x, y) }.is_ok()
}

pub(crate) fn send_wheel(delta: i32) -> bool {
    let input = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT { dx: 0, dy: 0, mouseData: delta as u32, dwFlags: MOUSEEVENTF_WHEEL, time: 0, dwExtraInfo: 0 },
        },
    };
    unsafe { SendInput(&[input], size_of::<INPUT>() as i32) == 1 }
}

fn send_key_event(key: VIRTUAL_KEY, flags: KEYBD_EVENT_FLAGS) {
    unsafe { keybd_event(key.0 as u8, 0, flags, 0) };
}

fn is_key_down(key: VIRTUAL_KEY) -> bool {
    let state = unsafe { GetAsyncKeyState(i32::from(key.0)) };
    state < 0
}
