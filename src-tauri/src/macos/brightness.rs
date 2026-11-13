use std::ffi::{c_void, CString};

use objc2_core_graphics::{CGDirectDisplayID, CGDisplayIsBuiltin, CGGetActiveDisplayList};

const LIBRARY: &str = "/System/Library/PrivateFrameworks/DisplayServices.framework/DisplayServices";
const GET: &str = "DisplayServicesGetBrightness";
const MAX_DISPLAYS: usize = 16;

type GetBrightness = unsafe extern "C" fn(CGDirectDisplayID, *mut f32) -> i32;

pub(crate) struct BuiltinBrightness {
    display: CGDirectDisplayID,
    get: GetBrightness,
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
    let name = CString::new(GET).ok()?;
    let symbol: *mut c_void = unsafe { libc::dlsym(handle, name.as_ptr()) };
    if symbol.is_null() {
        return None;
    }
    let get = unsafe { std::mem::transmute::<*mut c_void, GetBrightness>(symbol) };
    Some(BuiltinBrightness { display, get })
}

impl BuiltinBrightness {
    pub(crate) fn level(&self) -> Option<f32> {
        let mut level = 0.0f32;
        let status = unsafe { (self.get)(self.display, &mut level) };
        (status == 0 && level.is_finite()).then_some(level.clamp(0.0, 1.0))
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
