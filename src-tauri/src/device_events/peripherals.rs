use std::collections::HashMap;

use serde::Serialize;

use super::tracker::{note_low, warn_low, DeviceAlert};

const BATTERY_WAIT_POLLS: u32 = 2;
pub(crate) const QUIET_RECONNECT_POLLS: u64 = 40;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PeripheralKind {
    Mouse,
    Keyboard,
    Trackpad,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Peripheral {
    pub(crate) device: String,
    pub(crate) name: String,
    pub(crate) kind: PeripheralKind,
    pub(crate) battery: Option<u8>,
}

#[cfg(any(target_os = "macos", test))]
pub(crate) fn kind_from_minor_type(minor_type: &str) -> Option<PeripheralKind> {
    let minor_type = minor_type.to_ascii_lowercase();
    if minor_type.contains("trackpad") || minor_type.contains("touchpad") {
        Some(PeripheralKind::Trackpad)
    } else if minor_type.contains("keyboard") {
        Some(PeripheralKind::Keyboard)
    } else if minor_type.contains("mouse") || minor_type.contains("pointing") {
        Some(PeripheralKind::Mouse)
    } else {
        None
    }
}

#[cfg(any(windows, test))]
pub(crate) fn kind_from_appearance(appearance: u16) -> Option<PeripheralKind> {
    const HUMAN_INTERFACE_DEVICE: u16 = 0x0F;
    if appearance >> 6 != HUMAN_INTERFACE_DEVICE {
        return None;
    }
    match appearance & 0x3F {
        1 => Some(PeripheralKind::Keyboard),
        2 => Some(PeripheralKind::Mouse),
        _ => None,
    }
}

#[derive(Debug)]
struct Present {
    waited: u32,
    settled: bool,
    quiet: bool,
}

#[derive(Debug, Default)]
pub(crate) struct PeripheralTracker {
    poll: u64,
    started: bool,
    present: HashMap<String, Present>,
    left: HashMap<String, u64>,
    warned: HashMap<String, u8>,
}

impl PeripheralTracker {
    pub(crate) fn reset(&mut self) {
        *self = Self::default();
    }

    pub(crate) fn update(&mut self, peripherals: Vec<Peripheral>) -> Vec<DeviceAlert> {
        self.poll += 1;
        let first = !std::mem::replace(&mut self.started, true);
        let poll = self.poll;
        self.left.retain(|_, &mut left| poll - left < QUIET_RECONNECT_POLLS);

        let gone: Vec<String> =
            self.present.keys().filter(|device| !peripherals.iter().any(|p| &p.device == *device)).cloned().collect();
        for device in gone {
            self.present.remove(&device);
            self.warned.remove(&device);
            self.left.insert(device, poll);
        }

        let mut alerts = Vec::new();
        let mut checked: Vec<&str> = Vec::new();
        for peripheral in &peripherals {
            if checked.contains(&peripheral.device.as_str()) {
                continue;
            }
            checked.push(&peripheral.device);
            let quiet = first || self.left.remove(&peripheral.device).is_some();
            let state = self.present.entry(peripheral.device.clone()).or_insert(Present { waited: 0, settled: false, quiet });
            if !state.settled {
                match peripheral.battery {
                    Some(battery) => {
                        state.settled = true;
                        note_low(&mut self.warned, &peripheral.device, battery);
                        if !state.quiet {
                            alerts.push(DeviceAlert::PeripheralConnected {
                                name: peripheral.name.clone(),
                                device: peripheral.kind,
                                battery,
                            });
                        }
                    }
                    None if state.waited < BATTERY_WAIT_POLLS => state.waited += 1,
                    None => state.settled = true,
                }
                continue;
            }
            let Some(battery) = peripheral.battery else { continue };
            if warn_low(&mut self.warned, &peripheral.device, battery) {
                alerts.push(DeviceAlert::BatteryLow { name: peripheral.name.clone(), battery });
            }
        }
        alerts
    }
}
