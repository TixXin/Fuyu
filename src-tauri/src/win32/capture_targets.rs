use windows::Win32::{
    Foundation::{HWND, RECT},
    UI::Accessibility::{TreeScope_Descendants, UIA_BoundingRectanglePropertyId, UIA_IsOffscreenPropertyId},
};

use super::{com::ComApartment, dwm, process, uia_list, window};

pub(crate) struct ShownWindow {
    pub(crate) handle: HWND,
    pub(crate) rect: RECT,
}

fn has_area(rect: &RECT) -> bool {
    rect.right > rect.left && rect.bottom > rect.top
}

pub(crate) fn shown_windows() -> Vec<ShownWindow> {
    let own = std::process::id();
    let mut shown = Vec::new();
    let _ = window::for_each_top_level_window(|handle| {
        if !window::is_visible(handle) || window::is_minimized(handle) || dwm::is_cloaked(handle) || process::window_process_id(handle) == own {
            return;
        }
        if let Some(rect) = dwm::frame_bounds(handle).or_else(|| window::window_rect(handle)).filter(has_area) {
            shown.push(ShownWindow { handle, rect });
        }
    });
    shown
}

pub(crate) fn control_rects(window: HWND, limit: usize) -> Vec<RECT> {
    let _com = ComApartment::multithreaded().ok();
    read_control_rects(window, limit).unwrap_or_default()
}

fn read_control_rects(window: HWND, limit: usize) -> windows::core::Result<Vec<RECT>> {
    unsafe {
        let automation = uia_list::automation()?;
        let root = automation.ElementFromHandle(window)?;
        let cache = automation.CreateCacheRequest()?;
        cache.AddProperty(UIA_BoundingRectanglePropertyId)?;
        cache.AddProperty(UIA_IsOffscreenPropertyId)?;
        let found = root.FindAllBuildCache(TreeScope_Descendants, &automation.ControlViewCondition()?, &cache)?;
        let count = usize::try_from(found.Length()?).unwrap_or(0).min(limit);
        let mut rects = Vec::with_capacity(count);
        for index in 0..count {
            let element = found.GetElement(index as i32)?;
            if element.CachedIsOffscreen().is_ok_and(|offscreen| offscreen.as_bool()) {
                continue;
            }
            if let Ok(rect) = element.CachedBoundingRectangle() {
                if has_area(&rect) {
                    rects.push(rect);
                }
            }
        }
        Ok(rects)
    }
}
