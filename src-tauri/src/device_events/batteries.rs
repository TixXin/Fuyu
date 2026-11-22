use std::{
    collections::HashMap,
    sync::{Mutex, PoisonError},
};

use serde::Serialize;

use super::{
    peripherals::{Peripheral, PeripheralKind},
    tracker::{AudioKind, Output},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub(crate) enum BatteryDeviceKind {
    Audio(AudioKind),
    Peripheral(PeripheralKind),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeripheralBattery {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) kind: BatteryDeviceKind,
    pub(crate) battery: u8,
}

static LATEST: Mutex<Option<Vec<PeripheralBattery>>> = Mutex::new(None);

pub(crate) fn collect(outputs: &[Output], batteries: &HashMap<String, u8>, peripherals: &[Peripheral]) -> Vec<PeripheralBattery> {
    let mut found: Vec<PeripheralBattery> = Vec::new();
    let mut add = |id: &str, name: &str, kind: BatteryDeviceKind, battery: u8| {
        if found.iter().any(|seen| seen.id == id) {
            return;
        }
        found.push(PeripheralBattery { id: id.to_string(), name: name.to_string(), kind, battery: battery.min(100) });
    };
    for output in outputs {
        if let Some(&battery) = batteries.get(&output.device) {
            add(&output.device, &output.name, BatteryDeviceKind::Audio(output.kind), battery);
        }
    }
    for peripheral in peripherals {
        if let Some(battery) = peripheral.battery {
            add(&peripheral.device, &peripheral.name, BatteryDeviceKind::Peripheral(peripheral.kind), battery);
        }
    }
    found.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()).then_with(|| a.id.cmp(&b.id)));
    found
}

#[cfg(any(windows, test))]
fn hex_address(text: &str) -> Option<String> {
    let valid = text.len() == 12 && text.bytes().all(|byte| byte.is_ascii_hexdigit()) && text.bytes().any(|byte| byte != b'0');
    valid.then(|| text.to_ascii_uppercase())
}

#[cfg(any(windows, test))]
pub(crate) fn bluetooth_address(text: &str) -> Option<String> {
    hex_address(&text.trim().replace([':', '-'], ""))
}

#[cfg(any(windows, test))]
pub(crate) fn address_in_instance_id(instance_id: &str) -> Option<String> {
    instance_id.split(['\\', '&', '_']).find_map(hex_address)
}

#[cfg(any(windows, test))]
pub(crate) fn is_device_root(instance_id: &str) -> bool {
    instance_id.split('\\').nth(1).is_some_and(|segment| segment.to_ascii_uppercase().starts_with("DEV_"))
}

#[cfg(any(windows, test))]
pub(crate) fn kind_from_hid(name: &str, keyboard: bool, mouse: bool) -> Option<PeripheralKind> {
    match (keyboard, mouse) {
        (false, false) => None,
        (true, false) => Some(PeripheralKind::Keyboard),
        (false, true) => Some(PeripheralKind::Mouse),
        (true, true) => {
            let name = name.to_lowercase();
            let says_keyboard = ["keyboard", "keys", "键盘"].iter().any(|word| name.contains(word));
            let says_mouse = ["mouse", "trackball", "鼠标"].iter().any(|word| name.contains(word));
            Some(if says_keyboard && !says_mouse { PeripheralKind::Keyboard } else { PeripheralKind::Mouse })
        }
    }
}

#[cfg(any(windows, test))]
pub(crate) fn merge_peripherals(system: Vec<Peripheral>, gatt: Vec<Peripheral>) -> Vec<Peripheral> {
    let mut merged: Vec<Peripheral> = Vec::new();
    for peripheral in system.into_iter().chain(gatt) {
        match merged.iter_mut().find(|known| known.device == peripheral.device) {
            Some(known) if known.battery.is_none() => known.battery = peripheral.battery,
            Some(_) => {}
            None => merged.push(peripheral),
        }
    }
    merged
}

pub(crate) fn publish(list: &[PeripheralBattery]) -> bool {
    let mut latest = LATEST.lock().unwrap_or_else(PoisonError::into_inner);
    if latest.as_deref() == Some(list) {
        return false;
    }
    *latest = Some(list.to_vec());
    true
}

pub(crate) fn latest() -> Option<Vec<PeripheralBattery>> {
    LATEST.lock().unwrap_or_else(PoisonError::into_inner).clone()
}

pub(crate) struct Published;

impl Drop for Published {
    fn drop(&mut self) {
        *LATEST.lock().unwrap_or_else(PoisonError::into_inner) = None;
    }
}
