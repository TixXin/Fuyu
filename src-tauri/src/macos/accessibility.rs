use std::ptr::NonNull;

use objc2_core_foundation::{CFArray, CFBoolean, CFDictionary, CFRetained, CFString, CFType};
use objc2_foundation::NSURL;

const MESSAGING_TIMEOUT_SECONDS: f32 = 0.5;
const WINDOW_TIMEOUT_SECONDS: f32 = 0.15;

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> u8;
    fn AXIsProcessTrustedWithOptions(options: *const CFDictionary) -> u8;
    fn AXUIElementCreateSystemWide() -> *mut CFType;
    fn AXUIElementCreateApplication(pid: i32) -> *mut CFType;
    fn AXUIElementSetMessagingTimeout(element: *const CFType, timeout: f32) -> i32;
    fn AXUIElementCopyAttributeValue(element: *const CFType, attribute: *const CFString, value: *mut *mut CFType) -> i32;
    fn AXUIElementSetAttributeValue(element: *const CFType, attribute: *const CFString, value: *const CFType) -> i32;
    fn AXUIElementPerformAction(element: *const CFType, action: *const CFString) -> i32;
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

pub(crate) fn ask_for_trust() -> bool {
    let key = CFString::from_static_str("AXTrustedCheckOptionPrompt");
    let options = CFDictionary::<CFString, CFBoolean>::from_slices(&[&*key], &[CFBoolean::new(true)]);
    let options: &CFDictionary = options.as_opaque();
    unsafe { AXIsProcessTrustedWithOptions(options) != 0 }
}

#[derive(Clone)]
pub(crate) struct Element(CFRetained<CFType>);

impl Element {
    pub(crate) fn application(pid: i32) -> Option<Self> {
        Self::application_with_timeout(pid, MESSAGING_TIMEOUT_SECONDS)
    }

    pub(crate) fn application_with_timeout(pid: i32, timeout: f32) -> Option<Self> {
        let element = unsafe { CFRetained::from_raw(NonNull::new(AXUIElementCreateApplication(pid))?) };
        unsafe { AXUIElementSetMessagingTimeout(&*element, timeout) };
        Some(Self(element))
    }

    fn elements(&self, name: &str) -> Vec<Element> {
        let Some(value) = attribute(&self.0, name) else {
            return Vec::new();
        };
        let Some(array) = value.downcast_ref::<CFArray>() else {
            return Vec::new();
        };
        let array: &CFArray<CFType> = unsafe { array.cast_unchecked() };
        array.iter().map(Element).collect()
    }

    pub(crate) fn children(&self) -> Vec<Element> {
        self.elements("AXChildren")
    }

    pub(crate) fn windows(&self) -> Vec<Element> {
        self.elements("AXWindows")
            .into_iter()
            .filter(|window| window.text("AXRole").as_deref() == Some("AXWindow"))
            .collect()
    }

    pub(crate) fn text(&self, name: &str) -> Option<String> {
        Some(attribute(&self.0, name)?.downcast_ref::<CFString>()?.to_string())
    }

    pub(crate) fn boolean(&self, name: &str) -> Option<bool> {
        Some(attribute(&self.0, name)?.downcast_ref::<CFBoolean>()?.as_bool())
    }

    pub(crate) fn set_boolean(&self, name: &str, value: bool) -> bool {
        let name = CFString::from_str(name);
        let flag = CFBoolean::new(value);
        let flag: &CFType = flag.as_ref();
        unsafe { AXUIElementSetAttributeValue(&*self.0, &*name, flag) == 0 }
    }

    pub(crate) fn perform(&self, action: &str) -> bool {
        let action = CFString::from_str(action);
        unsafe { AXUIElementPerformAction(&*self.0, &*action) == 0 }
    }

    pub(crate) fn raise_window(&self) -> bool {
        if self.boolean("AXMinimized") == Some(true) {
            let _ = self.set_boolean("AXMinimized", false);
        }
        let main = self.set_boolean("AXMain", true);
        let raised = self.perform("AXRaise");
        main || raised
    }

    pub(crate) fn url_path(&self, name: &str) -> Option<String> {
        let value = attribute(&self.0, name)?;
        let url: &NSURL = unsafe { &*(CFRetained::as_ptr(&value).as_ptr() as *const NSURL) };
        Some(url.path()?.to_string())
    }
}

pub(crate) fn app_windows(pid: i32) -> Vec<(Element, String)> {
    if !is_trusted() {
        return Vec::new();
    }
    let Some(app) = Element::application_with_timeout(pid, WINDOW_TIMEOUT_SECONDS) else {
        return Vec::new();
    };
    app.windows()
        .into_iter()
        .map(|window| {
            let title = window.text("AXTitle").unwrap_or_default();
            (window, title)
        })
        .collect()
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
