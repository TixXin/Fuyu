use windows::Win32::{
    Foundation::HWND,
    System::Variant::VARIANT,
    UI::Accessibility::{
        IUIAutomationSelectionItemPattern, TreeScope_Descendants, UIA_ControlTypePropertyId,
        UIA_SelectionItemPatternId, UIA_TabItemControlTypeId,
    },
};

use super::{com::ComApartment, uia_list};

pub(crate) fn select_tab(window: HWND, choose: impl FnOnce(&[String]) -> Option<usize>) -> bool {
    if window.is_invalid() {
        return false;
    }
    let _com = ComApartment::multithreaded().ok();
    select(window, choose).unwrap_or(false)
}

fn select(window: HWND, choose: impl FnOnce(&[String]) -> Option<usize>) -> windows::core::Result<bool> {
    unsafe {
        let automation = uia_list::automation()?;
        let root = automation.ElementFromHandle(window)?;
        let is_tab = VARIANT::from(UIA_TabItemControlTypeId.0);
        let condition = automation.CreatePropertyCondition(UIA_ControlTypePropertyId, &is_tab)?;
        let found = root.FindAll(TreeScope_Descendants, &condition)?;
        let mut tabs = Vec::new();
        let mut titles = Vec::new();
        for index in 0..found.Length()? {
            let tab = found.GetElement(index)?;
            titles.push(tab.CurrentName().map(|name| name.to_string()).unwrap_or_default());
            tabs.push(tab);
        }
        let Some(tab) = choose(&titles).and_then(|index| tabs.get(index)) else {
            return Ok(false);
        };
        let pattern: IUIAutomationSelectionItemPattern = tab.GetCurrentPatternAs(UIA_SelectionItemPatternId)?;
        pattern.Select()?;
        Ok(true)
    }
}
