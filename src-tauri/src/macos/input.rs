use std::ffi::c_char;

use objc2_app_kit::NSEvent;
use objc2_core_foundation::{CFDictionary, CGPoint};
use objc2_core_graphics::{
    CGDisplayBounds, CGError, CGEvent, CGEventFlags, CGEventSource, CGEventSourceStateID, CGEventTapLocation, CGKeyCode, CGMainDisplayID,
    CGPreflightPostEventAccess, CGRequestPostEventAccess, CGScrollEventUnit, CGWarpMouseCursorPosition,
};

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
const KEY_ESCAPE: CGKeyCode = 53;
const WHEEL_NOTCH: i32 = 120;
const LINES_PER_NOTCH: i32 = 3;

pub(crate) fn is_escape_down() -> bool {
    CGEventSource::key_state(CGEventSourceStateID::CombinedSessionState, KEY_ESCAPE)
}

pub(crate) fn is_v_key_down() -> bool {
    CGEventSource::key_state(CGEventSourceStateID::CombinedSessionState, KEY_V)
}

pub(crate) fn is_shift_key_down() -> bool {
    CGEventSource::flags_state(CGEventSourceStateID::CombinedSessionState).contains(CGEventFlags::MaskShift)
}

const HID_SYSTEM: &[u8] = b"IOHIDSystem\0";
const HID_PARAM_CONNECT: u32 = 1;
const HID_CAPS_LOCK_STATE: i32 = 1;

#[link(name = "IOKit", kind = "framework")]
extern "C" {
    fn IOServiceMatching(name: *const c_char) -> *mut CFDictionary;
    fn IOServiceGetMatchingService(main_port: u32, matching: *mut CFDictionary) -> u32;
    fn IOServiceOpen(service: u32, owning_task: u32, kind: u32, connect: *mut u32) -> i32;
    fn IOServiceClose(connect: u32) -> i32;
    fn IOObjectRelease(object: u32) -> i32;
    fn IOHIDSetModifierLockState(connect: u32, selector: i32, state: bool) -> i32;
}

extern "C" {
    static mach_task_self_: u32;
}

pub(crate) fn is_caps_lock_on() -> bool {
    CGEventSource::flags_state(CGEventSourceStateID::CombinedSessionState).contains(CGEventFlags::MaskAlphaShift)
}

pub(crate) fn turn_off_caps_lock() -> bool {
    let service = unsafe { IOServiceGetMatchingService(0, IOServiceMatching(HID_SYSTEM.as_ptr().cast())) };
    if service == 0 {
        return false;
    }
    let mut connect = 0;
    let opened = unsafe { IOServiceOpen(service, mach_task_self_, HID_PARAM_CONNECT, &mut connect) };
    unsafe { IOObjectRelease(service) };
    if opened != 0 {
        return false;
    }
    let result = unsafe { IOHIDSetModifierLockState(connect, HID_CAPS_LOCK_STATE, false) };
    unsafe { IOServiceClose(connect) };
    result == 0
}

pub(crate) fn is_command_key_down() -> bool {
    CGEventSource::flags_state(CGEventSourceStateID::CombinedSessionState).contains(CGEventFlags::MaskCommand)
}

pub(crate) fn move_cursor(x: i32, y: i32) -> bool {
    CGWarpMouseCursorPosition(CGPoint::new(f64::from(x), f64::from(y))) == CGError::Success
}

pub(crate) fn send_wheel(delta: i32) -> bool {
    let lines = delta * LINES_PER_NOTCH / WHEEL_NOTCH;
    let Some(event) = CGEvent::new_scroll_wheel_event2(None, CGScrollEventUnit::Line, 1, lines, 0, 0) else {
        return false;
    };
    CGEvent::post(CGEventTapLocation::HIDEventTap, Some(&event));
    true
}

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

