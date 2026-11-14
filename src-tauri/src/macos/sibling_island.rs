use objc2_core_foundation::{CFArray, CFDictionary, CFRetained, CFString, CFType};
use objc2_core_graphics::{kCGWindowBounds, kCGWindowOwnerPID, CGWindowListCopyWindowInfo, CGWindowListOption};

use super::fullscreen::{bounds, number, Area};

pub(crate) fn shown_windows_of(pid: u32) -> Vec<Area> {
    let options = CGWindowListOption::OptionOnScreenOnly | CGWindowListOption::ExcludeDesktopElements;
    let Some(list) = CGWindowListCopyWindowInfo(options, 0) else {
        return Vec::new();
    };
    let list: CFRetained<CFArray<CFDictionary<CFString, CFType>>> = unsafe { CFRetained::cast_unchecked(list) };
    let (pid_key, bounds_key) = unsafe { (kCGWindowOwnerPID, kCGWindowBounds) };
    let pid = i64::from(pid);
    list.iter().filter(|info| number(info, pid_key) == Some(pid)).filter_map(|info| bounds(&info, bounds_key)).collect()
}
