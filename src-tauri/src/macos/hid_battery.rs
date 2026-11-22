use std::{
    ffi::{c_char, c_void},
    ptr::NonNull,
};

use objc2_core_foundation::{CFData, CFDictionary, CFNumber, CFRetained, CFString, CFType};

use super::bluetooth::address_key;

type IoObject = u32;

const SERVICE_CLASS: &[u8] = b"AppleDeviceManagementHIDEventService\0";
const MAIN_PORT_DEFAULT: u32 = 0;

#[link(name = "IOKit", kind = "framework")]
extern "C" {
    fn IOServiceMatching(name: *const c_char) -> *mut CFDictionary;
    fn IOServiceGetMatchingServices(main_port: u32, matching: *mut CFDictionary, existing: *mut IoObject) -> i32;
    fn IOIteratorNext(iterator: IoObject) -> IoObject;
    fn IORegistryEntryCreateCFProperty(entry: IoObject, key: *const CFString, allocator: *const c_void, options: u32) -> *mut CFType;
    fn IOObjectRelease(object: IoObject) -> i32;
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct HidFields {
    pub(crate) battery: Option<i64>,
    pub(crate) address: Option<String>,
    pub(crate) product: Option<String>,
    pub(crate) usage_page: Option<i64>,
    pub(crate) usage: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct HidBattery {
    pub(crate) key: String,
    pub(crate) name: String,
    pub(crate) usage_page: Option<i64>,
    pub(crate) usage: Option<i64>,
    pub(crate) battery: u8,
}

pub(crate) fn describe(fields: HidFields) -> Option<HidBattery> {
    let battery = u8::try_from(fields.battery?).ok().filter(|&level| level <= 100)?;
    let product = fields.product.map(|name| name.trim().to_string()).filter(|name| !name.is_empty());
    if product.as_deref().is_some_and(|name| name.to_ascii_lowercase().contains("internal")) {
        return None;
    }
    let key = fields.address.as_deref().and_then(address_key).or_else(|| product.clone())?;
    let name = product.unwrap_or_else(|| key.clone());
    Some(HidBattery { key, name, usage_page: fields.usage_page, usage: fields.usage, battery })
}

struct Entry(IoObject);

impl Drop for Entry {
    fn drop(&mut self) {
        unsafe { IOObjectRelease(self.0) };
    }
}

impl Entry {
    fn property(&self, key: &str) -> Option<CFRetained<CFType>> {
        let key = CFString::from_str(key);
        let value = unsafe { IORegistryEntryCreateCFProperty(self.0, &*key, std::ptr::null(), 0) };
        Some(unsafe { CFRetained::from_raw(NonNull::new(value)?) })
    }

    fn number(&self, key: &str) -> Option<i64> {
        self.property(key)?.downcast_ref::<CFNumber>()?.as_i64()
    }

    fn text(&self, key: &str) -> Option<String> {
        let value = self.property(key)?;
        if let Some(text) = value.downcast_ref::<CFString>() {
            return Some(text.to_string());
        }
        let bytes = value.downcast_ref::<CFData>()?.to_vec();
        Some(bytes.iter().map(|byte| format!("{byte:02x}")).collect::<Vec<_>>().join("-"))
    }

    fn fields(&self) -> HidFields {
        HidFields {
            battery: self.number("BatteryPercent"),
            address: self.text("DeviceAddress"),
            product: self.text("Product"),
            usage_page: self.number("PrimaryUsagePage"),
            usage: self.number("PrimaryUsage"),
        }
    }
}

pub(crate) fn connected_batteries() -> Vec<HidBattery> {
    let matching = unsafe { IOServiceMatching(SERVICE_CLASS.as_ptr().cast()) };
    if matching.is_null() {
        return Vec::new();
    }
    let mut iterator: IoObject = 0;
    if unsafe { IOServiceGetMatchingServices(MAIN_PORT_DEFAULT, matching, &mut iterator) } != 0 || iterator == 0 {
        return Vec::new();
    }
    let iterator = Entry(iterator);
    let mut found: Vec<HidBattery> = Vec::new();
    loop {
        let service = unsafe { IOIteratorNext(iterator.0) };
        if service == 0 {
            break;
        }
        let Some(device) = describe(Entry(service).fields()) else { continue };
        if !found.iter().any(|known| known.key == device.key) {
            found.push(device);
        }
    }
    found
}

#[cfg(test)]
mod tests {
    use super::{connected_batteries, describe, HidBattery, HidFields};

    fn fields(battery: Option<i64>, address: Option<&str>, product: Option<&str>) -> HidFields {
        HidFields {
            battery,
            address: address.map(Into::into),
            product: product.map(Into::into),
            usage_page: Some(1),
            usage: Some(2),
        }
    }

    #[test]
    fn devices_are_keyed_by_bluetooth_address_and_named_by_product() {
        assert_eq!(
            describe(fields(Some(64), Some("a4-83-e7-12-34-56"), Some("Magic Mouse"))),
            Some(HidBattery { key: "A483E7123456".into(), name: "Magic Mouse".into(), usage_page: Some(1), usage: Some(2), battery: 64 })
        );
        let no_address = describe(fields(Some(5), None, Some(" MX Master 3 ")));
        assert_eq!(no_address.map(|d| (d.key, d.name)), Some(("MX Master 3".into(), "MX Master 3".into())));
        let no_name = describe(fields(Some(5), Some("a4-83-e7-12-34-56"), None));
        assert_eq!(no_name.map(|d| (d.key, d.name)), Some(("A483E7123456".into(), "A483E7123456".into())));
    }

    #[test]
    fn missing_or_impossible_levels_internal_devices_and_nameless_devices_are_skipped() {
        assert_eq!(describe(fields(None, Some("a4-83-e7-12-34-56"), Some("Magic Mouse"))), None);
        assert_eq!(describe(fields(Some(101), Some("a4-83-e7-12-34-56"), Some("Magic Mouse"))), None);
        assert_eq!(describe(fields(Some(-1), Some("a4-83-e7-12-34-56"), Some("Magic Mouse"))), None);
        assert_eq!(describe(fields(Some(80), None, Some("Apple Internal Keyboard / Trackpad"))), None);
        assert_eq!(describe(fields(Some(80), Some("bad"), None)), None);
    }

    #[test]
    fn reading_the_registry_on_this_computer_never_panics() {
        for device in connected_batteries() {
            assert!(device.battery <= 100);
            assert!(!device.key.is_empty());
        }
    }
}
