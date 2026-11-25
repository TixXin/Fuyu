use std::{ffi::CString, ptr::NonNull};

use objc2_core_foundation::{CFArray, CFBoolean, CFDictionary, CFNumber, CFRetained, CFString, CFType};

#[link(name = "IOKit", kind = "framework")]
extern "C" {
    fn IOPSCopyPowerSourcesInfo() -> *mut CFType;
    fn IOPSCopyPowerSourcesList(blob: *const CFType) -> *mut CFArray;
    fn IOPSGetPowerSourceDescription(blob: *const CFType, source: *const CFType) -> *const CFDictionary;
    fn IOServiceMatching(name: *const std::ffi::c_char) -> *mut CFDictionary;
    fn IOServiceGetMatchingService(main_port: u32, matching: *mut CFDictionary) -> u32;
    fn IORegistryEntryCreateCFProperties(
        entry: u32,
        properties: *mut *mut CFDictionary,
        allocator: *const std::ffi::c_void,
        options: u32,
    ) -> i32;
    fn IOObjectRelease(object: u32) -> i32;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct PowerSource {
    pub(crate) plugged_in: bool,
    pub(crate) charging: bool,
    pub(crate) battery: Option<u8>,
    pub(crate) remaining_minutes: Option<u32>,
    pub(crate) time_to_full_minutes: Option<u32>,
    pub(crate) current_mwh: Option<u32>,
    pub(crate) full_charge_mwh: Option<u32>,
    pub(crate) design_mwh: Option<u32>,
    pub(crate) rate_mw: Option<i32>,
}

#[derive(Debug, Clone, Copy, Default)]
struct SmartDetails {
    current_mwh: Option<u32>,
    full_charge_mwh: Option<u32>,
    design_mwh: Option<u32>,
    rate_mw: Option<i32>,
}

pub(crate) fn describe(kind: &str, state: &str, current: Option<i64>, max: Option<i64>) -> Option<PowerSource> {
    if kind != "InternalBattery" {
        return None;
    }
    let plugged_in = match state {
        "AC Power" => true,
        "Battery Power" => false,
        _ => return None,
    };
    let battery = match (current, max) {
        (Some(current), Some(max)) if max > 0 && current >= 0 => u8::try_from((current * 100 + max / 2) / max).ok().filter(|&level| level <= 100),
        _ => None,
    };
    Some(PowerSource {
        plugged_in,
        charging: false,
        battery,
        remaining_minutes: None,
        time_to_full_minutes: None,
        current_mwh: None,
        full_charge_mwh: None,
        design_mwh: None,
        rate_mw: None,
    })
}

fn field(info: &CFDictionary<CFString, CFType>, key: &str) -> Option<CFRetained<CFType>> {
    info.get(&CFString::from_str(key))
}

fn text(info: &CFDictionary<CFString, CFType>, key: &str) -> Option<String> {
    Some(field(info, key)?.downcast_ref::<CFString>()?.to_string())
}

fn number(info: &CFDictionary<CFString, CFType>, key: &str) -> Option<i64> {
    field(info, key)?.downcast_ref::<CFNumber>()?.as_i64()
}

fn flag(info: &CFDictionary<CFString, CFType>, key: &str) -> Option<bool> {
    Some(field(info, key)?.downcast_ref::<CFBoolean>()?.value())
}

fn positive_minutes(value: Option<i64>) -> Option<u32> {
    value.filter(|&v| v > 0).and_then(|v| u32::try_from(v).ok())
}

fn mah_to_mwh(mah: Option<i64>, voltage_mv: i64) -> Option<u32> {
    let mah = mah.filter(|&v| v > 0)?;
    if voltage_mv <= 0 {
        return None;
    }
    u32::try_from((mah as i128 * voltage_mv as i128 + 500) / 1000).ok()
}

fn smart_battery_details() -> SmartDetails {
    let Ok(name) = CString::new("AppleSmartBattery") else {
        return SmartDetails::default();
    };
    let matching = unsafe { IOServiceMatching(name.as_ptr()) };
    if matching.is_null() {
        return SmartDetails::default();
    }
    let service = unsafe { IOServiceGetMatchingService(0, matching) };
    if service == 0 {
        return SmartDetails::default();
    }
    let mut raw_props: *mut CFDictionary = std::ptr::null_mut();
    let kr = unsafe { IORegistryEntryCreateCFProperties(service, &mut raw_props, std::ptr::null(), 0) };
    unsafe { IOObjectRelease(service) };
    if kr != 0 || raw_props.is_null() {
        return SmartDetails::default();
    }
    let props = unsafe { CFRetained::from_raw(NonNull::new_unchecked(raw_props)) };
    let info: CFRetained<CFDictionary<CFString, CFType>> = unsafe { CFRetained::cast_unchecked(props) };
    let voltage_mv = number(&info, "Voltage").unwrap_or(0);
    let current_mah = number(&info, "AppleRawCurrentCapacity").or_else(|| number(&info, "CurrentCapacity"));
    let full_mah = number(&info, "AppleRawMaxCapacity").or_else(|| number(&info, "NominalChargeCapacity")).or_else(|| number(&info, "MaxCapacity"));
    let design_mah = number(&info, "DesignCapacity");
    let amperage_ma = number(&info, "InstantAmperage").or_else(|| number(&info, "Amperage"));
    let rate_mw = amperage_ma.and_then(|ma| {
        if voltage_mv <= 0 {
            return None;
        }
        let ma = ma as i32 as i64;
        i32::try_from((ma as i128 * voltage_mv as i128) / 1000).ok()
    });
    SmartDetails {
        current_mwh: mah_to_mwh(current_mah, voltage_mv),
        full_charge_mwh: mah_to_mwh(full_mah, voltage_mv),
        design_mwh: mah_to_mwh(design_mah, voltage_mv),
        rate_mw,
    }
}

pub(crate) fn power_source() -> Option<PowerSource> {
    let blob = unsafe { CFRetained::from_raw(NonNull::new(IOPSCopyPowerSourcesInfo())?) };
    let list = unsafe { CFRetained::from_raw(NonNull::new(IOPSCopyPowerSourcesList(&*blob))?) };
    let list: CFRetained<CFArray<CFType>> = unsafe { CFRetained::cast_unchecked(list) };
    let mut source = list.iter().find_map(|source| {
        let info = unsafe { IOPSGetPowerSourceDescription(&*blob, &*source).cast::<CFDictionary<CFString, CFType>>().as_ref() }?;
        let mut parsed = describe(&text(info, "Type")?, &text(info, "Power Source State")?, number(info, "Current Capacity"), number(info, "Max Capacity"))?;
        parsed.charging = flag(info, "Is Charging").unwrap_or(false);
        parsed.remaining_minutes = positive_minutes(number(info, "Time to Empty"));
        parsed.time_to_full_minutes = positive_minutes(number(info, "Time to Full Charge"));
        Some(parsed)
    })?;
    let details = smart_battery_details();
    source.current_mwh = details.current_mwh;
    source.full_charge_mwh = details.full_charge_mwh;
    source.design_mwh = details.design_mwh;
    source.rate_mw = details.rate_mw;
    Some(source)
}

#[cfg(test)]
mod tests {
    use super::{describe, mah_to_mwh, power_source};

    #[test]
    fn only_the_internal_battery_counts() {
        let ac = describe("InternalBattery", "AC Power", Some(90), Some(100)).expect("ac");
        assert!(ac.plugged_in && ac.battery == Some(90));
        let bat = describe("InternalBattery", "Battery Power", Some(1), Some(3)).expect("bat");
        assert!(!bat.plugged_in && bat.battery == Some(33));
        let none_level = describe("InternalBattery", "Battery Power", None, Some(100)).expect("none");
        assert!(!none_level.plugged_in && none_level.battery.is_none());
        assert_eq!(describe("UPS", "AC Power", Some(90), Some(100)), None);
        assert_eq!(describe("InternalBattery", "Off Line", Some(90), Some(100)), None);
        assert_eq!(mah_to_mwh(Some(4000), 12_000), Some(48_000));
        assert_eq!(mah_to_mwh(Some(0), 12_000), None);
        if let Some(source) = power_source() {
            assert!(source.battery.is_none_or(|level| level <= 100));
        }
    }
}
