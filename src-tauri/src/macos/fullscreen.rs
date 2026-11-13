use objc2_core_foundation::{CFArray, CFDictionary, CFNumber, CFRetained, CFString, CFType, CGRect};
use objc2_core_graphics::{
    kCGWindowBounds, kCGWindowLayer, kCGWindowOwnerPID, CGDirectDisplayID, CGDisplayBounds, CGGetActiveDisplayList,
    CGRectMakeWithDictionaryRepresentation, CGWindowListCopyWindowInfo, CGWindowListOption,
};

const MAX_DISPLAYS: usize = 16;
const EDGE_TOLERANCE: f64 = 1.0;

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct Area {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
}

impl Area {
    pub(crate) fn contains(&self, x: f64, y: f64) -> bool {
        x >= self.x && x < self.x + self.width && y >= self.y && y < self.y + self.height
    }

    fn from_rect(rect: CGRect) -> Self {
        Self { x: rect.origin.x, y: rect.origin.y, width: rect.size.width, height: rect.size.height }
    }
}

pub(crate) fn covers(window: Area, display: Area) -> bool {
    let close = |a: f64, b: f64| (a - b).abs() <= EDGE_TOLERANCE;
    close(window.x, display.x) && close(window.y, display.y) && close(window.width, display.width) && close(window.height, display.height)
}

fn displays() -> Vec<Area> {
    let mut ids: [CGDirectDisplayID; MAX_DISPLAYS] = [0; MAX_DISPLAYS];
    let mut count: u32 = 0;
    let result = unsafe { CGGetActiveDisplayList(MAX_DISPLAYS as u32, ids.as_mut_ptr(), &mut count) };
    if result.0 != 0 {
        return Vec::new();
    }
    ids.iter().take(count as usize).map(|&id| Area::from_rect(CGDisplayBounds(id))).collect()
}

fn number(info: &CFDictionary<CFString, CFType>, key: &CFString) -> Option<i64> {
    info.get(key)?.downcast_ref::<CFNumber>()?.as_i64()
}

fn bounds(info: &CFDictionary<CFString, CFType>, key: &CFString) -> Option<Area> {
    let value = info.get(key)?;
    let dictionary = value.downcast_ref::<CFDictionary>()?;
    let mut rect = CGRect::default();
    unsafe { CGRectMakeWithDictionaryRepresentation(Some(dictionary), &mut rect) }.then(|| Area::from_rect(rect))
}

fn front_window(own_pid: i64) -> Option<Area> {
    let options = CGWindowListOption::OptionOnScreenOnly | CGWindowListOption::ExcludeDesktopElements;
    let list = CGWindowListCopyWindowInfo(options, 0)?;
    let list: CFRetained<CFArray<CFDictionary<CFString, CFType>>> = unsafe { CFRetained::cast_unchecked(list) };
    let (layer_key, pid_key, bounds_key) = unsafe { (kCGWindowLayer, kCGWindowOwnerPID, kCGWindowBounds) };
    list.iter().find_map(|info| {
        if number(&info, layer_key) != Some(0) || number(&info, pid_key) == Some(own_pid) {
            return None;
        }
        bounds(&info, bounds_key)
    })
}

pub(crate) fn fullscreen_display_in_front() -> Option<Area> {
    let window = front_window(i64::from(std::process::id()))?;
    displays().into_iter().find(|&display| covers(window, display))
}

#[cfg(test)]
mod tests {
    use super::{covers, Area};

    #[test]
    fn a_window_covers_a_display_only_when_its_edges_match() {
        let display = Area { x: 0.0, y: 0.0, width: 1710.0, height: 1107.0 };
        assert!(covers(Area { x: 0.0, y: 0.0, width: 1710.0, height: 1107.0 }, display));
        assert!(covers(Area { x: 0.5, y: 0.0, width: 1709.5, height: 1107.0 }, display));
        assert!(!covers(Area { x: 0.0, y: 33.0, width: 1710.0, height: 1074.0 }, display), "a zoomed window leaves the menu bar");
        let right = Area { x: 1710.0, y: 0.0, width: 1920.0, height: 1080.0 };
        assert!(!covers(Area { x: 0.0, y: 0.0, width: 1710.0, height: 1107.0 }, right));
        assert!(right.contains(2000.0, 10.0) && !right.contains(100.0, 10.0));
    }
}
