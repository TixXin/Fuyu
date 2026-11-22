use super::{
    bluetooth::ConnectedDevice, classify, hid_reading, merge_peripherals, AudioKind, AudioOutput, DeviceThread,
    HidBattery, Reading, Transport,
};
use crate::device_events::peripherals::{Peripheral, PeripheralKind};

fn output(uid: &str, transport: Transport, has_input: bool) -> AudioOutput {
    AudioOutput {
        uid: uid.into(),
        name: "Device".into(),
        transport,
        has_input,
    }
}

fn profiled(key: &str, name: &str, minor_type: &str, battery: Option<u8>) -> ConnectedDevice {
    ConnectedDevice { key: key.into(), name: name.into(), minor_type: minor_type.into(), battery }
}

fn hid(key: &str, name: &str, usage: Option<(i64, i64)>, battery: u8) -> HidBattery {
    HidBattery {
        key: key.into(),
        name: name.into(),
        usage_page: usage.map(|(page, _)| page),
        usage: usage.map(|(_, usage)| usage),
        battery,
    }
}

fn peripheral(device: &str, name: &str, kind: PeripheralKind, battery: Option<u8>) -> Peripheral {
    Peripheral { device: device.into(), name: name.into(), kind, battery }
}

#[test]
fn bluetooth_and_usb_headsets_are_announced_but_built_in_speakers_are_not() {
    let buds = classify(output("B4-E7-B3-CA-E4-EB:output", Transport::Bluetooth, false));
    assert!(
        buds.as_ref().is_some_and(|o| o.kind == AudioKind::Headphones && o.bluetooth && o.device == "B4E7B3CAE4EB"),
        "{buds:?}"
    );
    let headset = classify(output("AppleUSBAudioEngine:Jabra:1", Transport::Usb, true));
    assert!(
        headset.as_ref().is_some_and(|o| o.kind == AudioKind::Headset && !o.bluetooth && o.device == o.id),
        "{headset:?}"
    );
    assert!(classify(output("AppleUSBAudioEngine:DAC:1", Transport::Usb, false)).is_none());
    assert!(classify(output("BuiltInSpeakerDevice", Transport::Other, false)).is_none());
}

#[test]
fn mice_keyboards_and_trackpads_are_peripherals_but_headphones_are_not() {
    let kind = |minor_type: &str| {
        merge_peripherals(vec![profiled("9A02CB733405", "Magic", minor_type, Some(50))], Vec::new())
            .first()
            .map(|p| p.kind)
    };
    assert_eq!(kind("Mouse"), Some(PeripheralKind::Mouse));
    assert_eq!(kind("Keyboard"), Some(PeripheralKind::Keyboard));
    assert_eq!(kind("Trackpad"), Some(PeripheralKind::Trackpad));
    assert_eq!(kind("Headphones"), None);
    assert_eq!(kind(""), None);
}

#[test]
fn hid_devices_get_their_type_from_the_name_first_then_the_usage() {
    let kind = |name: &str, usage| hid_reading(hid("A483E7123456", name, usage, 50)).kind;
    assert_eq!(kind("Magic Trackpad", Some((1, 2))), Some(PeripheralKind::Trackpad));
    assert_eq!(kind("BT5.0 Mouse", Some((0xFF00, 11))), Some(PeripheralKind::Mouse));
    assert_eq!(kind("MX Master 3", Some((1, 2))), Some(PeripheralKind::Mouse));
    assert_eq!(kind("MX Keys", Some((1, 6))), Some(PeripheralKind::Keyboard));
    assert_eq!(kind("Gamepad", Some((1, 5))), None);
    assert_eq!(kind("Pen", None), None);
}

#[test]
fn system_profiler_wins_and_hid_fills_in_missing_levels_by_address() {
    let merged = merge_peripherals(
        vec![
            profiled("9A02CB733405", "Magic Mouse", "Mouse", Some(77)),
            profiled("D12233445566", "MX Keys", "Keyboard", None),
        ],
        vec![
            hid_reading(hid("9A02CB733405", "Magic Mouse", Some((1, 2)), 10)),
            hid_reading(hid("D12233445566", "MX Keys Mac", Some((1, 6)), 42)),
        ],
    );
    assert_eq!(
        merged,
        vec![
            peripheral("9A02CB733405", "Magic Mouse", PeripheralKind::Mouse, Some(77)),
            peripheral("D12233445566", "MX Keys", PeripheralKind::Keyboard, Some(42)),
        ]
    );
}

#[test]
fn hid_supplies_the_type_when_system_profiler_has_none_and_adds_devices_it_does_not_list() {
    let merged = merge_peripherals(
        vec![
            profiled("A1A2A3A4A5A6", "BT Mouse", "", None),
            profiled("B1B2B3B4B5B6", "Speaker", "Speaker", Some(30)),
        ],
        vec![
            hid_reading(hid("A1A2A3A4A5A6", "BT Mouse", Some((0xFF00, 11)), 55)),
            hid_reading(hid("C1C2C3C4C5C6", "Magic Trackpad", None, 88)),
            hid_reading(hid("D1D2D3D4D5D6", "Stylus", None, 20)),
        ],
    );
    assert_eq!(
        merged,
        vec![
            peripheral("A1A2A3A4A5A6", "BT Mouse", PeripheralKind::Mouse, Some(55)),
            peripheral("C1C2C3C4C5C6", "Magic Trackpad", PeripheralKind::Trackpad, Some(88)),
        ]
    );
}

#[test]
fn readings_without_an_address_match_by_name_and_earlier_readings_win() {
    let late = Reading { key: "A1A2A3A4A5A6".into(), name: "Keys".into(), kind: Some(PeripheralKind::Keyboard), battery: Some(5) };
    let merged = merge_peripherals(
        vec![profiled("E1E2E3E4E5E6", "Logi Mouse", "Mouse", None)],
        vec![
            hid_reading(hid("Logi Mouse", "Logi Mouse", None, 61)),
            hid_reading(hid("A1A2A3A4A5A6", "Keys", Some((1, 6)), 70)),
            late,
        ],
    );
    assert_eq!(
        merged,
        vec![
            peripheral("E1E2E3E4E5E6", "Logi Mouse", PeripheralKind::Mouse, Some(61)),
            peripheral("A1A2A3A4A5A6", "Keys", PeripheralKind::Keyboard, Some(70)),
        ]
    );
}

#[test]
#[ignore = "reads the real devices of the computer it runs on"]
fn probe_this_computer() {
    for output in crate::macos::audio_devices::outputs() {
        println!("{output:?}");
    }
    let mut thread = DeviceThread;
    println!("announced: {:?}", super::read_outputs(&mut thread));
    println!("batteries: {:?}", super::read_batteries());
    println!("system_profiler: {:?}", crate::macos::bluetooth::connected_devices());
    println!("iokit hid: {:?}", crate::macos::hid_battery::connected_batteries());
    println!("peripherals: {:?}", super::read_peripherals());
    println!("power: {:?}", super::power_source());
}
