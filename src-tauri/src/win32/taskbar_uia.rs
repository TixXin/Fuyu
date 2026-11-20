use windows::{
    core::BSTR,
    Win32::{
        Foundation::{HWND, RECT},
        System::Variant::VARIANT,
        UI::Accessibility::{
            IUIAutomationCondition, IUIAutomationElement, IUIAutomationElementArray, TreeScope_Children,
            UIA_AutomationIdPropertyId,
        },
    },
};

use super::{com::ComApartment, uia_list::automation};

const FRAME_ID: &str = "TaskbarFrame";
const START_ID: &str = "StartButton";
const WIDGETS_ID: &str = "WidgetsButton";
const TASK_BUTTON_CLASS: &str = "Taskbar.TaskListButtonAutomationPeer";
const TRAY_CLASS_PREFIX: &str = "SystemTray.";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum PartKind {
    Start,
    Widgets,
    TaskButton,
    Button,
    Tray,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct TaskbarPart {
    pub kind: PartKind,
    pub rect: RECT,
}

pub(crate) fn taskbar_parts(taskbar: HWND) -> Option<Vec<TaskbarPart>> {
    if taskbar.is_invalid() {
        return None;
    }
    let _com = ComApartment::multithreaded().ok();
    read(taskbar).ok().flatten()
}

fn read(taskbar: HWND) -> windows::core::Result<Option<Vec<TaskbarPart>>> {
    unsafe {
        let automation = automation()?;
        let root = automation.ElementFromHandle(taskbar)?;
        let is_frame = automation.CreatePropertyCondition(
            UIA_AutomationIdPropertyId,
            &VARIANT::from(BSTR::from(FRAME_ID)),
        )?;
        let everything = automation.CreateTrueCondition()?;
        let Some((host, frame)) = find_frame(&root.FindAll(TreeScope_Children, &everything)?, &is_frame)? else {
            return Ok(None);
        };
        let mut parts = Vec::new();
        let buttons = frame.FindAll(TreeScope_Children, &everything)?;
        for index in 0..buttons.Length()? {
            let element = buttons.GetElement(index)?;
            if let Some(rect) = visible_rect(&element) {
                parts.push(TaskbarPart { kind: frame_part_kind(&element), rect });
            }
        }
        let siblings = host.FindAll(TreeScope_Children, &everything)?;
        for index in 0..siblings.Length()? {
            let element = siblings.GetElement(index)?;
            let class = element.CurrentClassName().map(|name| name.to_string()).unwrap_or_default();
            if class.starts_with(TRAY_CLASS_PREFIX) {
                if let Some(rect) = visible_rect(&element) {
                    parts.push(TaskbarPart { kind: PartKind::Tray, rect });
                }
            }
        }
        Ok(Some(parts))
    }
}

unsafe fn find_frame(
    children: &IUIAutomationElementArray,
    is_frame: &IUIAutomationCondition,
) -> windows::core::Result<Option<(IUIAutomationElement, IUIAutomationElement)>> {
    for index in 0..unsafe { children.Length() }? {
        let child = unsafe { children.GetElement(index) }?;
        if let Ok(frame) = unsafe { child.FindFirst(TreeScope_Children, is_frame) } {
            return Ok(Some((child, frame)));
        }
    }
    Ok(None)
}

unsafe fn frame_part_kind(element: &IUIAutomationElement) -> PartKind {
    let id = unsafe { element.CurrentAutomationId() }.map(|id| id.to_string()).unwrap_or_default();
    let class = unsafe { element.CurrentClassName() }.map(|name| name.to_string()).unwrap_or_default();
    match (id.as_str(), class.as_str()) {
        (START_ID, _) => PartKind::Start,
        (WIDGETS_ID, _) => PartKind::Widgets,
        (_, TASK_BUTTON_CLASS) => PartKind::TaskButton,
        _ => PartKind::Button,
    }
}

unsafe fn visible_rect(element: &IUIAutomationElement) -> Option<RECT> {
    if unsafe { element.CurrentIsOffscreen() }.is_ok_and(|offscreen| offscreen.as_bool()) {
        return None;
    }
    unsafe { element.CurrentBoundingRectangle() }
        .ok()
        .filter(|rect| rect.right > rect.left && rect.bottom > rect.top)
}
