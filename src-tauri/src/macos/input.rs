use objc2_app_kit::{NSEvent, NSEventModifierFlags};

pub(crate) fn is_option_key_down() -> bool {
    NSEvent::modifierFlags_class().contains(NSEventModifierFlags::Option)
}

pub(crate) fn is_left_button_down() -> bool {
    NSEvent::pressedMouseButtons() & 1 != 0
}
