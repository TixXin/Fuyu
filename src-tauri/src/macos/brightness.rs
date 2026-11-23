use std::ffi::{c_void, CString};

use objc2_core_graphics::{CGDirectDisplayID, CGDisplayIsBuiltin, CGGetActiveDisplayList};

const LIBRARY: &str = "/System/Library/PrivateFrameworks/DisplayServices.framework/DisplayServices";
const GET: &str = "DisplayServicesGetBrightness";
const SET: &str = "DisplayServicesSetBrightness";
const CAN_CHANGE: &str = "DisplayServicesCanChangeBrightness";
const CHANGED: &str = "DisplayServicesBrightnessChanged";
const MAX_DISPLAYS: usize = 16;

type GetBrightness = unsafe extern "C" fn(CGDirectDisplayID, *mut f32) -> i32;
type SetBrightness = unsafe extern "C" fn(CGDirectDisplayID, f32) -> i32;
type CanChange = unsafe extern "C" fn(CGDirectDisplayID) -> bool;

pub(crate) struct BuiltinBrightness {
    display: CGDirectDisplayID,
    get: GetBrightness,
    set: Option<SetBrightness>,
    can_change: Option<CanChange>,
    changed: Option<SetBrightness>,
}

fn symbol(handle: *mut c_void, name: &str) -> Option<*mut c_void> {
    let name = CString::new(name).ok()?;
    let found = unsafe { libc::dlsym(handle, name.as_ptr()) };
    (!found.is_null()).then_some(found)
}

fn builtin_display() -> Option<CGDirectDisplayID> {
    let mut ids: [CGDirectDisplayID; MAX_DISPLAYS] = [0; MAX_DISPLAYS];
    let mut count: u32 = 0;
    let result = unsafe { CGGetActiveDisplayList(MAX_DISPLAYS as u32, ids.as_mut_ptr(), &mut count) };
    if result.0 != 0 {
        return None;
    }
    ids.into_iter().take(count as usize).find(|&id| CGDisplayIsBuiltin(id))
}

pub(crate) fn open() -> Option<BuiltinBrightness> {
    let display = builtin_display()?;
    let library = CString::new(LIBRARY).ok()?;
    let handle = unsafe { libc::dlopen(library.as_ptr(), libc::RTLD_NOW | libc::RTLD_LOCAL) };
    if handle.is_null() {
        return None;
    }
    let get = unsafe { std::mem::transmute::<*mut c_void, GetBrightness>(symbol(handle, GET)?) };
    let set = symbol(handle, SET).map(|found| unsafe { std::mem::transmute::<*mut c_void, SetBrightness>(found) });
    let can_change = symbol(handle, CAN_CHANGE).map(|found| unsafe { std::mem::transmute::<*mut c_void, CanChange>(found) });
    let changed = symbol(handle, CHANGED).map(|found| unsafe { std::mem::transmute::<*mut c_void, SetBrightness>(found) });
    Some(BuiltinBrightness { display, get, set, can_change, changed })
}

impl BuiltinBrightness {
    pub(crate) fn level(&self) -> Option<f32> {
        let mut level = 0.0f32;
        let status = unsafe { (self.get)(self.display, &mut level) };
        (status == 0 && level.is_finite()).then_some(level.clamp(0.0, 1.0))
    }

    pub(crate) fn can_set(&self) -> bool {
        self.set.is_some() && self.can_change.is_none_or(|can_change| unsafe { can_change(self.display) })
    }

    pub(crate) fn set_level(&self, level: f32) -> bool {
        let Some(set) = self.set.filter(|_| self.can_set() && level.is_finite()) else {
            return false;
        };
        let level = level.clamp(0.0, 1.0);
        let ok = unsafe { set(self.display, level) } == 0;
        if let Some(changed) = self.changed.filter(|_| ok) {
            let _ = unsafe { changed(self.display, level) };
        }
        ok
    }
}

#[cfg(test)]
mod tests {
    use super::open;

    #[test]
    fn a_built_in_screen_reports_a_level_between_zero_and_one() {
        if let Some(brightness) = open() {
            assert!(brightness.level().is_some_and(|level| (0.0..=1.0).contains(&level)));
        }
    }
}
