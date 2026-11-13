use objc2_app_kit::{NSEvent, NSEventModifierFlags};
use objc2_core_graphics::{CGDisplayBounds, CGMainDisplayID};

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
