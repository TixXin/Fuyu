use objc2_app_kit::{NSEvent, NSEventModifierFlags};
use objc2_core_graphics::{
    CGDisplayBounds, CGEvent, CGEventFlags, CGEventTapLocation, CGKeyCode, CGMainDisplayID, CGPreflightPostEventAccess,
    CGRequestPostEventAccess,
};

pub(crate) fn is_option_key_down() -> bool {
    NSEvent::modifierFlags_class().contains(NSEventModifierFlags::Option)
}

pub(crate) fn is_left_button_down() -> bool {
    NSEvent::pressedMouseButtons() & 1 != 0
}

pub(crate) fn cursor_point() -> (f64, f64) {
    let point = NSEvent::mouseLocation();
    let main_height = CGDisplayBounds(CGMainDisplayID()).size.height;
    (point.x, main_height - point.y)
}

const KEY_C: CGKeyCode = 8;
const KEY_V: CGKeyCode = 9;
const KEY_RETURN: CGKeyCode = 36;

pub(crate) fn can_post_keys() -> bool {
    CGPreflightPostEventAccess()
}

pub(crate) fn ask_to_post_keys() -> bool {
    CGRequestPostEventAccess()
}

fn tap_key(key: CGKeyCode, flags: CGEventFlags) {
    for down in [true, false] {
        let Some(event) = CGEvent::new_keyboard_event(None, key, down) else {
            return;
        };
        CGEvent::set_flags(Some(&event), flags);
        CGEvent::post(CGEventTapLocation::HIDEventTap, Some(&event));
    }
}

pub(crate) fn send_copy_shortcut() {
    tap_key(KEY_C, CGEventFlags::MaskCommand);
}

pub(crate) fn send_paste_shortcut() {
    tap_key(KEY_V, CGEventFlags::MaskCommand);
}

pub(crate) fn send_enter() {
    tap_key(KEY_RETURN, CGEventFlags::empty());
}
