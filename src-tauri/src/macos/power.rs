use std::ptr::NonNull;

use objc2_core_foundation::{CFArray, CFDictionary, CFNumber, CFRetained, CFString, CFType};

#[link(name = "IOKit", kind = "framework")]
extern "C" {
    fn IOPSCopyPowerSourcesInfo() -> *mut CFType;
    fn IOPSCopyPowerSourcesList(blob: *const CFType) -> *mut CFArray;
    fn IOPSGetPowerSourceDescription(blob: *const CFType, source: *const CFType) -> *const CFDictionary;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct PowerSource {
    pub(crate) plugged_in: bool,
    pub(crate) battery: Option<u8>,
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
    Some(PowerSource { plugged_in, battery })
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

pub(crate) fn power_source() -> Option<PowerSource> {
    let blob = unsafe { CFRetained::from_raw(NonNull::new(IOPSCopyPowerSourcesInfo())?) };
    let list = unsafe { CFRetained::from_raw(NonNull::new(IOPSCopyPowerSourcesList(&*blob))?) };
    let list: CFRetained<CFArray<CFType>> = unsafe { CFRetained::cast_unchecked(list) };
    list.iter().find_map(|source| {
        let info = unsafe { IOPSGetPowerSourceDescription(&*blob, &*source).cast::<CFDictionary<CFString, CFType>>().as_ref() }?;
        describe(&text(info, "Type")?, &text(info, "Power Source State")?, number(info, "Current Capacity"), number(info, "Max Capacity"))
    })
}

#[cfg(test)]
mod tests {
    use super::{describe, power_source, PowerSource};

    #[test]
    fn only_the_internal_battery_counts() {
        assert_eq!(describe("InternalBattery", "AC Power", Some(90), Some(100)), Some(PowerSource { plugged_in: true, battery: Some(90) }));
        assert_eq!(describe("InternalBattery", "Battery Power", Some(1), Some(3)), Some(PowerSource { plugged_in: false, battery: Some(33) }));
        assert_eq!(describe("InternalBattery", "Battery Power", None, Some(100)), Some(PowerSource { plugged_in: false, battery: None }));
        assert_eq!(describe("UPS", "AC Power", Some(90), Some(100)), None);
        assert_eq!(describe("InternalBattery", "Off Line", Some(90), Some(100)), None);
        if let Some(source) = power_source() {
            assert!(source.battery.is_none_or(|level| level <= 100));
        }
    }
}
