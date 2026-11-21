use std::ffi::{c_void, CString};

use objc2_core_foundation::CFString;

const DEFAULT_SESSION: i32 = -2;
const NO_ERROR: i32 = 0;

type CurrentApplication = unsafe extern "C" fn() -> *const c_void;
type SetInformationItem =
    unsafe extern "C" fn(i32, *const c_void, *const c_void, *const c_void, *mut *const c_void) -> i32;

fn symbol(name: &str) -> Option<*mut c_void> {
    let name = CString::new(name).ok()?;
    let found = unsafe { libc::dlsym(libc::RTLD_DEFAULT, name.as_ptr()) };
    (!found.is_null()).then_some(found)
}

fn function<T: Copy>(name: &str) -> Option<T> {
    let found = symbol(name)?;
    Some(unsafe { std::mem::transmute_copy::<*mut c_void, T>(&found) })
}

pub(crate) fn set(name: &str) -> Result<(), String> {
    let current: CurrentApplication =
        function("_LSGetCurrentApplicationASN").ok_or("_LSGetCurrentApplicationASN is missing")?;
    let set_item: SetInformationItem =
        function("_LSSetApplicationInformationItem").ok_or("_LSSetApplicationInformationItem is missing")?;
    let key_slot = symbol("_kLSDisplayNameKey").ok_or("_kLSDisplayNameKey is missing")?;
    let key = unsafe { *key_slot.cast::<*const c_void>() };
    if key.is_null() {
        return Err("_kLSDisplayNameKey is empty".into());
    }
    let application = unsafe { current() };
    if application.is_null() {
        return Err("this process has no LaunchServices entry".into());
    }
    let value = CFString::from_str(name);
    let raw_value = (&*value as *const CFString).cast::<c_void>();
    let status = unsafe { set_item(DEFAULT_SESSION, application, key, raw_value, std::ptr::null_mut()) };
    if status == NO_ERROR {
        Ok(())
    } else {
        Err(format!("_LSSetApplicationInformationItem returned {status}"))
    }
}
