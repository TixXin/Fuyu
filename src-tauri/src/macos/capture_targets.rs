use objc2_core_foundation::{CFArray, CFDictionary, CFRetained, CFString, CFType};
use objc2_core_graphics::{kCGWindowBounds, kCGWindowLayer, kCGWindowNumber, kCGWindowOwnerPID, CGWindowListCopyWindowInfo, CGWindowListOption};

use super::fullscreen::{bounds, number, Area};

const MIN_SIDE: f64 = 8.0;

pub(crate) struct ShownWindow {
    pub(crate) number: u32,
    pub(crate) pid: i32,
    pub(crate) area: Area,
}

pub(crate) fn shown_windows() -> Vec<ShownWindow> {
    let options = CGWindowListOption::OptionOnScreenOnly | CGWindowListOption::ExcludeDesktopElements;
    let Some(list) = CGWindowListCopyWindowInfo(options, 0) else {
        return Vec::new();
    };
    let list: CFRetained<CFArray<CFDictionary<CFString, CFType>>> = unsafe { CFRetained::cast_unchecked(list) };
    let (layer_key, pid_key, bounds_key, number_key) = unsafe { (kCGWindowLayer, kCGWindowOwnerPID, kCGWindowBounds, kCGWindowNumber) };
    let own = i64::from(std::process::id());
    list.iter()
        .filter(|info| number(info, layer_key) == Some(0) && number(info, pid_key) != Some(own))
        .filter_map(|info| {
            Some(ShownWindow {
                number: u32::try_from(number(&info, number_key)?).ok()?,
                pid: i32::try_from(number(&info, pid_key)?).ok()?,
                area: bounds(&info, bounds_key)?,
            })
        })
        .filter(|window| window.area.width >= MIN_SIDE && window.area.height >= MIN_SIDE)
        .collect()
}
