use std::ffi::c_void;

const SYSTEM_OBJECT: u32 = 1;
const HARDWARE_DEVICES: u32 = u32::from_be_bytes(*b"dev#");
const RUNNING_SOMEWHERE: u32 = u32::from_be_bytes(*b"gone");
const SCOPE_GLOBAL: u32 = u32::from_be_bytes(*b"glob");
const ELEMENT_MAIN: u32 = 0;

#[repr(C)]
struct PropertyAddress {
    selector: u32,
    scope: u32,
    element: u32,
}

#[link(name = "CoreMediaIO", kind = "framework")]
extern "C" {
    fn CMIOObjectGetPropertyDataSize(object: u32, address: *const PropertyAddress, qualifier_size: u32, qualifier: *const c_void, size: *mut u32) -> i32;
    fn CMIOObjectGetPropertyData(
        object: u32,
        address: *const PropertyAddress,
        qualifier_size: u32,
        qualifier: *const c_void,
        size: u32,
        used: *mut u32,
        data: *mut c_void,
    ) -> i32;
}

fn address(selector: u32) -> PropertyAddress {
    PropertyAddress { selector, scope: SCOPE_GLOBAL, element: ELEMENT_MAIN }
}

fn devices() -> Vec<u32> {
    let address = address(HARDWARE_DEVICES);
    let mut size: u32 = 0;
    if unsafe { CMIOObjectGetPropertyDataSize(SYSTEM_OBJECT, &address, 0, std::ptr::null(), &mut size) } != 0 {
        return Vec::new();
    }
    let item = std::mem::size_of::<u32>();
    let mut ids = vec![0u32; size as usize / item];
    if ids.is_empty() {
        return ids;
    }
    let mut used: u32 = 0;
    let status = unsafe { CMIOObjectGetPropertyData(SYSTEM_OBJECT, &address, 0, std::ptr::null(), size, &mut used, ids.as_mut_ptr().cast()) };
    if status != 0 {
        return Vec::new();
    }
    ids.truncate(used as usize / item);
    ids
}

fn running(device: u32) -> bool {
    let address = address(RUNNING_SOMEWHERE);
    let mut value: u32 = 0;
    let mut used: u32 = 0;
    let size = std::mem::size_of::<u32>() as u32;
    let status = unsafe { CMIOObjectGetPropertyData(device, &address, 0, std::ptr::null(), size, &mut used, std::ptr::from_mut(&mut value).cast()) };
    status == 0 && value != 0
}

pub(crate) fn in_use() -> bool {
    devices().into_iter().any(running)
}

#[cfg(test)]
mod tests {
    use super::{in_use, HARDWARE_DEVICES, RUNNING_SOMEWHERE};

    #[test]
    fn selectors_are_four_char_codes() {
        assert_eq!(HARDWARE_DEVICES, 0x6465_7623);
        assert_eq!(RUNNING_SOMEWHERE, 0x676f_6e65);
        let _ = in_use();
    }
}
