use std::{
    ffi::{c_void, CString},
    sync::OnceLock,
};

use objc2_core_foundation::{CFArray, CFNumber, CFRetained};

const LIBRARY: &str = "/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics";
const SHOWN_SPACE_FLAG: isize = 1;
const TOP_LEVEL: i32 = i32::MAX;

type Connection = i32;
type SpaceId = u64;
type DefaultConnection = unsafe extern "C" fn() -> Connection;
type SpaceCreate = unsafe extern "C" fn(Connection, isize, *const c_void) -> SpaceId;
type SpaceSetLevel = unsafe extern "C" fn(Connection, SpaceId, i32);
type SpacesCall = unsafe extern "C" fn(Connection, *const c_void);
type WindowsToSpaces = unsafe extern "C" fn(Connection, *const c_void, *const c_void);

struct TopSpace {
    connection: Connection,
    space: SpaceId,
    add: WindowsToSpaces,
}

unsafe impl Send for TopSpace {}
unsafe impl Sync for TopSpace {}

fn symbol<T: Copy>(handle: *mut c_void, name: &str) -> Option<T> {
    let name = CString::new(name).ok()?;
    let found: *mut c_void = unsafe { libc::dlsym(handle, name.as_ptr()) };
    if found.is_null() {
        return None;
    }
    Some(unsafe { std::mem::transmute_copy::<*mut c_void, T>(&found) })
}

fn array_of(values: &[i64]) -> CFRetained<CFArray<CFNumber>> {
    let numbers: Vec<CFRetained<CFNumber>> = values.iter().map(|&value| CFNumber::new_i64(value)).collect();
    CFArray::from_retained_objects(&numbers)
}

fn as_raw(array: &CFArray<CFNumber>) -> *const c_void {
    (array as *const CFArray<CFNumber>).cast()
}

fn create() -> Option<TopSpace> {
    let library = CString::new(LIBRARY).ok()?;
    let handle = unsafe { libc::dlopen(library.as_ptr(), libc::RTLD_NOW | libc::RTLD_LOCAL) };
    if handle.is_null() {
        return None;
    }
    let default_connection: DefaultConnection = symbol(handle, "_CGSDefaultConnection")?;
    let space_create: SpaceCreate = symbol(handle, "CGSSpaceCreate")?;
    let set_level: SpaceSetLevel = symbol(handle, "CGSSpaceSetAbsoluteLevel")?;
    let show: SpacesCall = symbol(handle, "CGSShowSpaces")?;
    let add: WindowsToSpaces = symbol(handle, "CGSAddWindowsToSpaces")?;
    let connection = unsafe { default_connection() };
    let space = unsafe { space_create(connection, SHOWN_SPACE_FLAG, std::ptr::null()) };
    if space == 0 {
        return None;
    }
    unsafe { set_level(connection, space, TOP_LEVEL) };
    let spaces = array_of(&[space as i64]);
    unsafe { show(connection, as_raw(&spaces)) };
    Some(TopSpace { connection, space, add })
}

pub(crate) fn pin(window_number: u32) -> bool {
    static SPACE: OnceLock<Option<TopSpace>> = OnceLock::new();
    let Some(top) = SPACE.get_or_init(create) else {
        return false;
    };
    let windows = array_of(&[i64::from(window_number)]);
    let spaces = array_of(&[top.space as i64]);
    unsafe { (top.add)(top.connection, as_raw(&windows), as_raw(&spaces)) };
    true
}
