use std::ptr::NonNull;

use objc2_core_foundation::{CFRetained, CFString, CFType};

const MESSAGING_TIMEOUT_SECONDS: f32 = 0.5;

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> u8;
    fn AXUIElementCreateSystemWide() -> *mut CFType;
    fn AXUIElementSetMessagingTimeout(element: *const CFType, timeout: f32) -> i32;
    fn AXUIElementCopyAttributeValue(element: *const CFType, attribute: *const CFString, value: *mut *mut CFType) -> i32;
}

pub(crate) fn is_trusted() -> bool {
    unsafe { AXIsProcessTrusted() != 0 }
}

fn attribute(element: &CFType, name: &str) -> Option<CFRetained<CFType>> {
    let name = CFString::from_str(name);
    let mut value: *mut CFType = std::ptr::null_mut();
    let status = unsafe { AXUIElementCopyAttributeValue(element, &*name, &mut value) };
    if status != 0 {
        return None;
    }
    NonNull::new(value).map(|value| unsafe { CFRetained::from_raw(value) })
}

pub(crate) fn selected_text() -> Option<String> {
    if !is_trusted() {
        return None;
    }
    let system = unsafe { CFRetained::from_raw(NonNull::new(AXUIElementCreateSystemWide())?) };
    unsafe { AXUIElementSetMessagingTimeout(&*system, MESSAGING_TIMEOUT_SECONDS) };
    let focused = attribute(&system, "AXFocusedUIElement")?;
    let text = attribute(&focused, "AXSelectedText")?;
    Some(text.downcast_ref::<CFString>()?.to_string())
}

#[cfg(test)]
mod tests {
    use super::selected_text;

    #[test]
    fn reading_the_selection_never_fails_hard() {
        let _ = selected_text();
    }
}
