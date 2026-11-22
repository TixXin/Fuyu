use std::time::{Duration, Instant};

use objc2::{
    msg_send,
    rc::{autoreleasepool, Retained},
    runtime::{AnyClass, AnyObject, Sel},
    sel,
};
use objc2_foundation::{NSArray, NSNumber, NSString};

use super::{ble_battery, bluetooth::address_key};

const NOT_DETERMINED: isize = 0;
const ALLOWED_ALWAYS: isize = 3;
const ANSWER_POLL: Duration = Duration::from_millis(250);
const ANSWER_WAIT: Duration = Duration::from_secs(120);
const MAJOR_AUDIO: u32 = 0x04;
const MAJOR_PERIPHERAL: u32 = 0x05;

#[link(name = "CoreBluetooth", kind = "framework")]
extern "C" {}

#[link(name = "IOBluetooth", kind = "framework")]
extern "C" {}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Access {
    NotDetermined,
    Denied,
    Allowed,
}

pub(crate) fn access_from_raw(raw: isize) -> Access {
    match raw {
        NOT_DETERMINED => Access::NotDetermined,
        ALLOWED_ALWAYS => Access::Allowed,
        _ => Access::Denied,
    }
}

pub(crate) fn access() -> Access {
    let Some(class) = AnyClass::get(c"CBManager") else { return Access::Denied };
    let known: bool = unsafe { msg_send![class, respondsToSelector: sel!(authorization)] };
    if !known {
        return Access::Denied;
    }
    let raw: isize = unsafe { msg_send![class, authorization] };
    access_from_raw(raw)
}

pub(crate) fn allowed() -> bool {
    access() == Access::Allowed
}

pub(crate) fn request() -> Access {
    let current = access();
    if current != Access::NotDetermined {
        return current;
    }
    ble_battery::start();
    let started = Instant::now();
    while started.elapsed() < ANSWER_WAIT {
        std::thread::sleep(ANSWER_POLL);
        let now = access();
        if now != Access::NotDetermined {
            if now == Access::Allowed {
                ble_battery::refresh_now();
            }
            return now;
        }
    }
    Access::NotDetermined
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ClassicKind {
    Audio,
    Keyboard,
    Mouse,
    Other,
}

pub(crate) fn classic_kind(class_of_device: u32) -> ClassicKind {
    let major = (class_of_device >> 8) & 0x1F;
    let minor = (class_of_device >> 2) & 0x3F;
    match (major, (minor >> 4) & 0x3) {
        (MAJOR_AUDIO, _) => ClassicKind::Audio,
        (MAJOR_PERIPHERAL, 1 | 3) => ClassicKind::Keyboard,
        (MAJOR_PERIPHERAL, 2) => ClassicKind::Mouse,
        _ => ClassicKind::Other,
    }
}

pub(crate) fn battery_level(raw: isize) -> Option<u8> {
    u8::try_from(raw).ok().filter(|level| (1..=100).contains(level))
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ClassicBattery {
    pub(crate) key: String,
    pub(crate) name: String,
    pub(crate) kind: ClassicKind,
    pub(crate) battery: u8,
}

fn responds(object: &AnyObject, selector: Sel) -> bool {
    unsafe { msg_send![object, respondsToSelector: selector] }
}

fn value(object: &AnyObject, selector: Sel) -> Option<Retained<AnyObject>> {
    if !responds(object, selector) {
        return None;
    }
    let key = NSString::from_str(selector.name().to_str().ok()?);
    unsafe { msg_send![object, valueForKey: &*key] }
}

fn number(object: &AnyObject, selector: Sel) -> Option<Retained<NSNumber>> {
    value(object, selector)?.downcast::<NSNumber>().ok()
}

fn text(object: &AnyObject, selector: Sel) -> Option<String> {
    let text = value(object, selector)?.downcast::<NSString>().ok()?.to_string();
    (!text.trim().is_empty()).then_some(text)
}

fn classic_device(device: &AnyObject) -> Option<ClassicBattery> {
    if !number(device, sel!(isConnected))?.boolValue() {
        return None;
    }
    if number(device, sel!(isAppleDevice)).is_some_and(|apple| apple.boolValue()) {
        return None;
    }
    let battery = battery_level(number(device, sel!(batteryPercentSingle))?.integerValue())?;
    let key = address_key(&text(device, sel!(addressString))?)?;
    let class_of_device = number(device, sel!(classOfDevice)).map_or(0, |class| class.unsignedIntValue());
    let name = text(device, sel!(name)).unwrap_or_else(|| key.clone());
    Some(ClassicBattery { key, name, kind: classic_kind(class_of_device), battery })
}

pub(crate) fn classic_batteries() -> Vec<ClassicBattery> {
    if !allowed() {
        return Vec::new();
    }
    autoreleasepool(|_| {
        let Some(class) = AnyClass::get(c"IOBluetoothDevice") else { return Vec::new() };
        let devices: Option<Retained<NSArray<AnyObject>>> = unsafe { msg_send![class, pairedDevices] };
        devices.map(|devices| devices.iter().filter_map(|device| classic_device(&device)).collect()).unwrap_or_default()
    })
}

#[cfg(test)]
mod tests {
    use super::{access_from_raw, battery_level, classic_kind, Access, ClassicKind};

    #[test]
    fn authorization_values_map_to_access() {
        assert_eq!(access_from_raw(0), Access::NotDetermined);
        assert_eq!(access_from_raw(1), Access::Denied);
        assert_eq!(access_from_raw(2), Access::Denied);
        assert_eq!(access_from_raw(3), Access::Allowed);
    }

    #[test]
    fn class_of_device_tells_headphones_keyboards_and_mice_apart() {
        assert_eq!(classic_kind(0x24_0418), ClassicKind::Audio);
        assert_eq!(classic_kind(0x00_0540), ClassicKind::Keyboard);
        assert_eq!(classic_kind(0x00_0580), ClassicKind::Mouse);
        assert_eq!(classic_kind(0x00_05C0), ClassicKind::Keyboard);
        assert_eq!(classic_kind(0x5A_020C), ClassicKind::Other);
        assert_eq!(classic_kind(0), ClassicKind::Other);
    }

    #[test]
    fn only_real_percentages_count() {
        assert_eq!(battery_level(80), Some(80));
        assert_eq!(battery_level(100), Some(100));
        assert_eq!(battery_level(0), None);
        assert_eq!(battery_level(-1), None);
        assert_eq!(battery_level(255), None);
    }
}
