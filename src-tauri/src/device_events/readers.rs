use std::{collections::HashMap, sync::Arc};

use windows::core::GUID;

use crate::win32::{
    audio::{AudioDevices, EndpointEpochs, EndpointNotificationSubscription},
    audio_outputs,
    ble_battery::{self, BleDevice},
    com::ComApartment,
    devnode::{self, BluetoothNode},
    power,
};

use super::{
    batteries::{address_in_instance_id, bluetooth_address, is_device_root, kind_from_hid, merge_peripherals},
    peripherals::{kind_from_appearance, Peripheral, PeripheralKind},
    tracker::Output,
};

pub(super) struct DeviceThread {
    cached_outputs: Vec<Output>,
    seen_topology_epoch: u64,
    epochs: Option<Arc<EndpointEpochs>>,
    subscription: Option<EndpointNotificationSubscription>,
    devices: Option<AudioDevices>,
    _apartment: ComApartment,
}

pub(super) fn start_thread() -> Option<DeviceThread> {
    let apartment = ComApartment::multithreaded().ok()?;
    let devices = AudioDevices::open().ok();
    let (subscription, epochs) = match devices.as_ref().and_then(|dev| dev.subscribe_endpoints().ok()) {
        Some((sub, ep)) => (Some(sub), Some(ep)),
        None => (None, None),
    };
    Some(DeviceThread {
        cached_outputs: Vec::new(),
        seen_topology_epoch: 0,
        epochs,
        subscription,
        devices,
        _apartment: apartment,
    })
}

pub(super) fn read_outputs(thread: &mut DeviceThread) -> Vec<Output> {
    if thread.subscription.is_some() {
        if let (Some(devices), Some(epochs)) = (&thread.devices, &thread.epochs) {
            let current = epochs.topology_epoch();
            if current == thread.seen_topology_epoch {
                return thread.cached_outputs.clone();
            }
            thread.seen_topology_epoch = current;
            thread.cached_outputs = query_outputs(Some(devices));
            return thread.cached_outputs.clone();
        }
    }
    query_outputs(thread.devices.as_ref())
}

fn query_outputs(devices: Option<&AudioDevices>) -> Vec<Output> {
    let result = match devices {
        Some(existing) => audio_outputs::active_outputs_from(existing),
        None => audio_outputs::active_outputs(),
    };
    let Ok(outputs) = result else {
        return Vec::new();
    };
    outputs
        .into_iter()
        .filter_map(|info| {
            let device = devnode::container_id(&format!(r"SWD\MMDEVAPI\{}", info.id))
                .map(|guid| format!("{guid:?}"));
            Output::classify(info.id, info.name, info.form_factor, &info.enumerator, device)
        })
        .collect()
}

pub(super) fn read_batteries() -> HashMap<String, u8> {
    let mut found = HashMap::new();
    for node in devnode::bluetooth_nodes() {
        if let Some(level) = node.battery {
            found.entry(format!("{:?}", node.container)).or_insert(level);
        }
    }
    found
}

const KEYBOARD_CLASS: GUID = GUID::from_u128(0x4d36e96b_e325_11ce_bfc1_08002be10318);
const MOUSE_CLASS: GUID = GUID::from_u128(0x4d36e96f_e325_11ce_bfc1_08002be10318);
const NO_CONTAINER: GUID = GUID::from_u128(0x00000000_0000_0000_ffff_ffffffffffff);

struct Survey {
    nodes: Vec<BluetoothNode>,
    hid: Vec<(GUID, GUID)>,
}

impl Survey {
    fn take() -> Self {
        Self { nodes: devnode::bluetooth_nodes(), hid: devnode::hid_classes() }
    }

    fn hid_kind(&self, container: GUID, name: &str) -> Option<PeripheralKind> {
        if container == NO_CONTAINER || container == GUID::zeroed() {
            return None;
        }
        let has = |class: GUID| self.hid.iter().any(|&(owner, found)| owner == container && found == class);
        kind_from_hid(name, has(KEYBOARD_CLASS), has(MOUSE_CLASS))
    }

    fn address(&self, container: GUID) -> Option<String> {
        let mut nodes = self.nodes.iter().filter(|node| node.container == container);
        nodes.clone().find_map(|node| node.address.as_deref().and_then(bluetooth_address))
            .or_else(|| nodes.find_map(|node| address_in_instance_id(&node.instance_id)))
    }

    fn container(&self, address: &str) -> Option<GUID> {
        self.nodes.iter().find(|node| self.address(node.container).as_deref() == Some(address)).map(|node| node.container)
    }

    fn name(&self, container: GUID) -> Option<String> {
        let mut nodes = self.nodes.iter().filter(|node| node.container == container);
        nodes.clone().find(|node| is_device_root(&node.instance_id)).and_then(|node| node.name.clone())
            .or_else(|| nodes.find_map(|node| node.name.clone()))
    }

    fn system_peripherals(&self) -> Vec<Peripheral> {
        let mut found: Vec<Peripheral> = Vec::new();
        for node in &self.nodes {
            let Some(battery) = node.battery else { continue };
            let Some(device) = self.address(node.container) else { continue };
            if found.iter().any(|known| known.device == device) {
                continue;
            }
            let name = self.name(node.container).unwrap_or_else(|| device.clone());
            let Some(kind) = self.hid_kind(node.container, &name) else { continue };
            found.push(Peripheral { device, name, kind, battery: Some(battery) });
        }
        found
    }

    fn gatt_peripherals(&self, devices: Vec<BleDevice>) -> Vec<Peripheral> {
        devices
            .into_iter()
            .filter_map(|device| {
                let kind = kind_from_appearance(device.appearance).or_else(|| {
                    self.container(&device.address).and_then(|container| self.hid_kind(container, &device.name))
                })?;
                Some(Peripheral { device: device.address, name: device.name, kind, battery: Some(device.battery) })
            })
            .collect()
    }
}

pub(super) fn read_peripherals() -> Vec<Peripheral> {
    let _apartment = ComApartment::multithreaded().ok();
    let gatt = ble_battery::connected_devices();
    let survey = Survey::take();
    merge_peripherals(survey.system_peripherals(), survey.gatt_peripherals(gatt))
}

pub(super) fn power_source() -> (Option<bool>, Option<u8>) {
    let source = power::power_source();
    (source.map(|s| s.plugged_in), source.and_then(|s| s.battery))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "reads the real devices of the computer it runs on"]
    fn probe_this_computer() {
        let mut thread = start_thread().expect("com");
        println!("== audio outputs");
        for info in audio_outputs::active_outputs().expect("outputs") {
            let container = devnode::container_id(&format!(r"SWD\MMDEVAPI\{}", info.id));
            println!("{} | form factor {} | {} | {:?}", info.name, info.form_factor, info.enumerator, container);
        }
        let outputs = read_outputs(&mut thread);
        println!("announced: {outputs:?}");
        let survey = Survey::take();
        println!("== device node batteries");
        for node in survey.nodes.iter().filter(|node| node.battery.is_some()) {
            println!(
                "{:?}% | {} | address {:?} / {:?} | name {:?} | container {:?}",
                node.battery, node.instance_id, node.address, survey.address(node.container), node.name, node.container
            );
        }
        println!("== HID classes by container");
        for (container, class) in &survey.hid {
            println!("{container:?} | {class:?}");
        }
        println!("== BLE devices with a battery");
        let gatt = ble_battery::connected_devices();
        for device in &gatt {
            println!(
                "{} | {} | appearance {:#06X} | {}% | container {:?}",
                device.address, device.name, device.appearance, device.battery, survey.container(&device.address)
            );
        }
        let peripherals = merge_peripherals(survey.system_peripherals(), survey.gatt_peripherals(gatt));
        println!("== peripherals: {peripherals:?}");
        println!("== list: {:?}", super::super::batteries::collect(&outputs, &read_batteries(), &peripherals));
        println!("== power: {:?}", power::power_source());
    }
}
