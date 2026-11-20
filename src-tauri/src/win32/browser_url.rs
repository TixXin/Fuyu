use windows::Win32::{
    Foundation::HWND,
    System::Variant::VARIANT,
    UI::Accessibility::{IUIAutomationValuePattern, TreeScope_Descendants, UIA_ControlTypePropertyId, UIA_EditControlTypeId, UIA_ValuePatternId},
};

use super::{com::ComApartment, uia_list};

pub(crate) fn address_bar(window: HWND) -> Option<String> {
    if window.is_invalid() {
        return None;
    }
    let _com = ComApartment::multithreaded().ok();
    read(window).ok()
}

fn read(window: HWND) -> windows::core::Result<String> {
    unsafe {
        let automation = uia_list::automation()?;
        let root = automation.ElementFromHandle(window)?;
        let is_edit = VARIANT::from(UIA_EditControlTypeId.0);
        let condition = automation.CreatePropertyCondition(UIA_ControlTypePropertyId, &is_edit)?;
        let field = root.FindFirst(TreeScope_Descendants, &condition)?;
        let pattern: IUIAutomationValuePattern = field.GetCurrentPatternAs(UIA_ValuePatternId)?;
        Ok(pattern.CurrentValue()?.to_string())
    }
}
