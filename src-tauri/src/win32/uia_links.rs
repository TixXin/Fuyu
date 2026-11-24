use std::time::Duration;

use windows::Win32::{
    Foundation::HWND,
    System::Variant::VARIANT,
    UI::Accessibility::{
        ExpandCollapseState_Collapsed, IUIAutomation, IUIAutomationElement,
        IUIAutomationExpandCollapsePattern, IUIAutomationInvokePattern, IUIAutomationValuePattern,
        TreeScope_Descendants, UIA_ButtonControlTypeId, UIA_ControlTypePropertyId,
        UIA_DocumentControlTypeId, UIA_ExpandCollapsePatternId, UIA_HyperlinkControlTypeId,
        UIA_InvokePatternId, UIA_LandmarkTypePropertyId, UIA_NavigationLandmarkTypeId,
        UIA_ValuePatternId,
    },
};

use super::{com::ComApartment, uia_list};

const EXPAND_WAIT: Duration = Duration::from_millis(120);
const EXPAND_POLLS: usize = 3;

pub(crate) fn activate_link(
    window: HWND,
    matches_url: impl Fn(&str) -> bool,
    expand_folder: Option<&str>,
) -> bool {
    if window.is_invalid() {
        return false;
    }
    let _com = ComApartment::multithreaded().ok();
    activate(window, &matches_url, expand_folder).unwrap_or(false)
}

pub(crate) fn document_matches(window: HWND, matches_url: impl Fn(&str) -> bool) -> bool {
    if window.is_invalid() {
        return false;
    }
    let _com = ComApartment::multithreaded().ok();
    check_documents(window, &matches_url).unwrap_or(false)
}

fn check_documents(window: HWND, matches_url: &impl Fn(&str) -> bool) -> windows::core::Result<bool> {
    unsafe {
        let automation = uia_list::automation()?;
        let root = automation.ElementFromHandle(window)?;
        has_matching_document(&automation, &root, matches_url)
    }
}

fn activate(
    window: HWND,
    matches_url: &impl Fn(&str) -> bool,
    expand_folder: Option<&str>,
) -> windows::core::Result<bool> {
    unsafe {
        let automation = uia_list::automation()?;
        let root = automation.ElementFromHandle(window)?;
        if has_matching_document(&automation, &root, matches_url)? {
            return Ok(true);
        }
        let nav = match find_navigation(&automation, &root)? {
            Some(nav) => nav,
            None => {
                if invoke_collapsed_button(&automation, &root, "Toggle Sidebar")? {
                    wait_for_navigation(&automation, &root)?.unwrap_or_else(|| root.clone())
                } else {
                    root.clone()
                }
            }
        };
        if invoke_matching_link(&automation, &nav, matches_url)? {
            return Ok(true);
        }
        let mut expanded = invoke_collapsed_button(&automation, &nav, "Projects")?;
        if let Some(folder) = expand_folder {
            if expanded {
                std::thread::sleep(EXPAND_WAIT);
            }
            if invoke_collapsed_button(&automation, &nav, folder)? {
                expanded = true;
            }
        }
        if !expanded {
            return Ok(false);
        }
        for _ in 0..EXPAND_POLLS {
            std::thread::sleep(EXPAND_WAIT);
            if invoke_matching_link(&automation, &nav, matches_url)? {
                return Ok(true);
            }
        }
        Ok(false)
    }
}

unsafe fn has_matching_document(
    automation: &IUIAutomation,
    root: &IUIAutomationElement,
    matches_url: &impl Fn(&str) -> bool,
) -> windows::core::Result<bool> {
    let is_doc = automation.CreatePropertyCondition(
        UIA_ControlTypePropertyId,
        &VARIANT::from(UIA_DocumentControlTypeId.0),
    )?;
    let docs = root.FindAll(TreeScope_Descendants, &is_doc)?;
    for index in 0..docs.Length()? {
        let doc = docs.GetElement(index)?;
        if let Some(url) = element_value(&doc) {
            if matches_url(&url) {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

unsafe fn find_navigation(
    automation: &IUIAutomation,
    root: &IUIAutomationElement,
) -> windows::core::Result<Option<IUIAutomationElement>> {
    let is_nav = automation.CreatePropertyCondition(
        UIA_LandmarkTypePropertyId,
        &VARIANT::from(UIA_NavigationLandmarkTypeId.0),
    )?;
    Ok(root.FindFirst(TreeScope_Descendants, &is_nav).ok())
}

unsafe fn wait_for_navigation(
    automation: &IUIAutomation,
    root: &IUIAutomationElement,
) -> windows::core::Result<Option<IUIAutomationElement>> {
    for _ in 0..EXPAND_POLLS {
        std::thread::sleep(EXPAND_WAIT);
        if let Some(nav) = find_navigation(automation, root)? {
            return Ok(Some(nav));
        }
    }
    Ok(None)
}

unsafe fn invoke_matching_link(
    automation: &IUIAutomation,
    container: &IUIAutomationElement,
    matches_url: &impl Fn(&str) -> bool,
) -> windows::core::Result<bool> {
    let is_link = automation.CreatePropertyCondition(
        UIA_ControlTypePropertyId,
        &VARIANT::from(UIA_HyperlinkControlTypeId.0),
    )?;
    let links = container.FindAll(TreeScope_Descendants, &is_link)?;
    for index in 0..links.Length()? {
        let link = links.GetElement(index)?;
        if let Some(url) = element_value(&link) {
            if matches_url(&url) {
                let invoke: IUIAutomationInvokePattern =
                    link.GetCurrentPatternAs(UIA_InvokePatternId)?;
                invoke.Invoke()?;
                return Ok(true);
            }
        }
    }
    Ok(false)
}

unsafe fn invoke_collapsed_button(
    automation: &IUIAutomation,
    container: &IUIAutomationElement,
    target_name: &str,
) -> windows::core::Result<bool> {
    let is_button = automation.CreatePropertyCondition(
        UIA_ControlTypePropertyId,
        &VARIANT::from(UIA_ButtonControlTypeId.0),
    )?;
    let buttons = container.FindAll(TreeScope_Descendants, &is_button)?;
    for index in 0..buttons.Length()? {
        let button = buttons.GetElement(index)?;
        let name = button
            .CurrentName()
            .map(|name| name.to_string())
            .unwrap_or_default();
        if !name.eq_ignore_ascii_case(target_name) {
            continue;
        }
        if let Ok(expand) =
            button.GetCurrentPatternAs::<IUIAutomationExpandCollapsePattern>(UIA_ExpandCollapsePatternId)
        {
            if expand.CurrentExpandCollapseState()? == ExpandCollapseState_Collapsed {
                if expand.Expand().is_ok() {
                    return Ok(true);
                }
                if let Ok(invoke) =
                    button.GetCurrentPatternAs::<IUIAutomationInvokePattern>(UIA_InvokePatternId)
                {
                    invoke.Invoke()?;
                    return Ok(true);
                }
            }
            return Ok(false);
        }
        if let Ok(invoke) =
            button.GetCurrentPatternAs::<IUIAutomationInvokePattern>(UIA_InvokePatternId)
        {
            invoke.Invoke()?;
            return Ok(true);
        }
    }
    Ok(false)
}

unsafe fn element_value(element: &IUIAutomationElement) -> Option<String> {
    let pattern: IUIAutomationValuePattern = element.GetCurrentPatternAs(UIA_ValuePatternId).ok()?;
    pattern.CurrentValue().ok().map(|value| value.to_string())
}
