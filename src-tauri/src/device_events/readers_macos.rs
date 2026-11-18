use std::collections::HashMap;

use crate::macos::{
    audio_devices::{self, AudioOutput, Transport},
    bluetooth, power,
};

use super::{
    peripherals::{kind_from_minor_type, Peripheral},
    tracker::{AudioKind, Output},
};

pub(super) struct DeviceThread;

pub(super) fn start_thread() -> Option<DeviceThread> {
    Some(DeviceThread)
}

fn classify(output: AudioOutput) -> Option<Output> {
    let (kind, bluetooth) = match output.transport {
        Transport::Bluetooth => (AudioKind::Headphones, true),
        Transport::Usb if output.has_input => (AudioKind::Headset, false),
        _ => return None,
    };
    let device = bluetooth
        .then(|| bluetooth::address_key(&output.uid))
        .flatten()
        .unwrap_or_else(|| output.uid.clone());
    Some(Output {
        id: output.uid,
        name: output.name,
        kind,
        device,
        bluetooth,
    })
}

pub(super) fn read_outputs(_thread: &mut DeviceThread) -> Vec<Output> {
    audio_devices::outputs().into_iter().filter_map(classify).collect()
}

pub(super) fn read_batteries() -> HashMap<String, u8> {
    bluetooth::connected_batteries()
}

fn peripheral(device: bluetooth::ConnectedDevice) -> Option<Peripheral> {
    let kind = kind_from_minor_type(&device.minor_type)?;
    Some(Peripheral {
        device: device.key,
        name: device.name,
        kind,
        battery: device.battery,
    })
}

pub(super) fn read_peripherals() -> Vec<Peripheral> {
    bluetooth::connected_devices().into_iter().filter_map(peripheral).collect()
}

pub(super) fn power_source() -> (Option<bool>, Option<u8>) {
    let source = power::power_source();
    (source.map(|s| s.plugged_in), source.and_then(|s| s.battery))
}

#[cfg(test)]
mod tests {
    use super::{
        bluetooth::ConnectedDevice, classify, peripheral, AudioKind, AudioOutput, DeviceThread,
        Transport,
    };
    use crate::device_events::peripherals::PeripheralKind;

    fn output(uid: &str, transport: Transport, has_input: bool) -> AudioOutput {
        AudioOutput {
            uid: uid.into(),
            name: "Device".into(),
            transport,
            has_input,
        }
    }

    #[test]
    fn bluetooth_and_usb_headsets_are_announced_but_built_in_speakers_are_not() {
        let buds = classify(output("B4-E7-B3-CA-E4-EB:output", Transport::Bluetooth, false));
        assert!(
            buds.as_ref().is_some_and(|o| o.kind == AudioKind::Headphones
                && o.bluetooth
                && o.device == "B4E7B3CAE4EB"),
            "{buds:?}"
        );
        let headset = classify(output("AppleUSBAudioEngine:Jabra:1", Transport::Usb, true));
        assert!(
            headset
                .as_ref()
                .is_some_and(|o| o.kind == AudioKind::Headset && !o.bluetooth && o.device == o.id),
            "{headset:?}"
        );
        assert!(classify(output("AppleUSBAudioEngine:DAC:1", Transport::Usb, false)).is_none());
        assert!(classify(output("BuiltInSpeakerDevice", Transport::Other, false)).is_none());
    }

    #[test]
    fn mice_keyboards_and_trackpads_are_peripherals_but_headphones_are_not() {
        let device = |minor_type: &str| ConnectedDevice {
            key: "9A02CB733405".into(),
            name: "Magic".into(),
            minor_type: minor_type.into(),
            battery: Some(50),
        };
        assert_eq!(
            peripheral(device("Mouse")).map(|p| p.kind),
            Some(PeripheralKind::Mouse)
        );
        assert_eq!(
            peripheral(device("Keyboard")).map(|p| p.kind),
            Some(PeripheralKind::Keyboard)
        );
        assert_eq!(
            peripheral(device("Trackpad")).map(|p| p.kind),
            Some(PeripheralKind::Trackpad)
        );
        assert!(peripheral(device("Headphones")).is_none());
        assert!(peripheral(device("")).is_none());
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
        println!("peripherals: {:?}", super::read_peripherals());
        println!("power: {:?}", super::power_source());
    }
}
