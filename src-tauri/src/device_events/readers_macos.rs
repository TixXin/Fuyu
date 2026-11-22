use std::collections::HashMap;

use crate::macos::{
    audio_devices::{self, AudioOutput, Transport},
    bluetooth::{self, ConnectedDevice},
    hid_battery::{self, HidBattery},
    power,
};

use super::{
    peripherals::{kind_from_minor_type, Peripheral, PeripheralKind},
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Reading {
    pub(super) key: String,
    pub(super) name: String,
    pub(super) kind: Option<PeripheralKind>,
    pub(super) battery: Option<u8>,
}

const GENERIC_DESKTOP_PAGE: i64 = 0x01;
const MOUSE_USAGE: i64 = 0x02;
const KEYBOARD_USAGE: i64 = 0x06;

fn hid_kind(device: &HidBattery) -> Option<PeripheralKind> {
    if device.name.to_ascii_lowercase().contains("trackpad") {
        return Some(PeripheralKind::Trackpad);
    }
    match (device.usage_page, device.usage) {
        (Some(GENERIC_DESKTOP_PAGE), Some(MOUSE_USAGE)) => Some(PeripheralKind::Mouse),
        (Some(GENERIC_DESKTOP_PAGE), Some(KEYBOARD_USAGE)) => Some(PeripheralKind::Keyboard),
        _ => kind_from_minor_type(&device.name),
    }
}

fn hid_reading(device: HidBattery) -> Reading {
    Reading { kind: hid_kind(&device), battery: Some(device.battery), key: device.key, name: device.name }
}

pub(super) fn merge_peripherals(profiled: Vec<ConnectedDevice>, readings: Vec<Reading>) -> Vec<Peripheral> {
    let mut used = vec![false; readings.len()];
    let mut found: Vec<Peripheral> = Vec::new();
    for device in profiled {
        let mut kind = kind_from_minor_type(&device.minor_type);
        let mut battery = device.battery;
        for (index, reading) in readings.iter().enumerate() {
            if reading.key == device.key || reading.key == device.name {
                used[index] = true;
                kind = kind.or(reading.kind);
                battery = battery.or(reading.battery);
            }
        }
        if let Some(kind) = kind {
            found.push(Peripheral { device: device.key, name: device.name, kind, battery });
        }
    }
    for (reading, used) in readings.into_iter().zip(used) {
        if used {
            continue;
        }
        if let Some(known) = found.iter_mut().find(|known| known.device == reading.key) {
            known.battery = known.battery.or(reading.battery);
        } else if let Some(kind) = reading.kind {
            found.push(Peripheral { device: reading.key, name: reading.name, kind, battery: reading.battery });
        }
    }
    found
}

fn read_hid() -> Vec<Reading> {
    hid_battery::connected_batteries().into_iter().map(hid_reading).collect()
}

pub(super) fn read_peripherals() -> Vec<Peripheral> {
    merge_peripherals(bluetooth::connected_devices(), read_hid())
}

pub(super) fn power_source() -> (Option<bool>, Option<u8>) {
    let source = power::power_source();
    (source.map(|s| s.plugged_in), source.and_then(|s| s.battery))
}

#[cfg(test)]
#[path = "readers_macos_tests.rs"]
mod tests;
