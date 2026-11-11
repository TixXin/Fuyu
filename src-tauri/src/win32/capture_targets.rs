//! What a screenshot can snap to (C41.2): the windows on screen, top first, and the controls
//! inside a window as UI Automation reports them. Rectangles are physical pixels on the virtual
//! screen (the process is per-monitor DPI aware).

use windows::Win32::{
    Foundation::{HWND, RECT},
    UI::Accessibility::{TreeScope_Descendants, UIA_BoundingRectanglePropertyId, UIA_IsOffscreenPropertyId},
};

use super::{com::ComApartment, dwm, process, uia_list, window};

/// A window on screen and where it is drawn.
pub(crate) struct ShownWindow {
    pub(crate) handle: HWND,
    pub(crate) rect: RECT,
}

fn has_area(rect: &RECT) -> bool {
    rect.right > rect.left && rect.bottom > rect.top
}

/// Every visible, non-minimized top-level window of other processes, top of the z-order first.
/// Our own windows (the island, the screenshot overlays) are left out.
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

/// The on-screen rectangles of the controls in `window` (UI Automation's control view), at most
/// `limit`. Empty when the app does not answer UI Automation in time (one call, cached, so a busy
/// app costs at most the client's timeout).
pub(crate) fn control_rects(window: HWND, limit: usize) -> Vec<RECT> {
    let _com = ComApartment::multithreaded().ok();
    read_control_rects(window, limit).unwrap_or_default()
}

fn read_control_rects(window: HWND, limit: usize) -> windows::core::Result<Vec<RECT>> {
    // SAFETY: COM is initialized on this thread (above) for the whole call; every interface here
    // is an owned, reference-counted value used only within it, and the HWND is passed by value
    // (UI Automation fails for windows that do not exist).
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
