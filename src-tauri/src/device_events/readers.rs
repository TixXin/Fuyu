use std::{collections::HashMap, sync::Arc};

use crate::win32::{
    audio::{AudioDevices, EndpointEpochs, EndpointNotificationSubscription},
    audio_outputs, ble_battery,
    com::ComApartment,
    devnode, power,
};

use super::{
    peripherals::{kind_from_appearance, Peripheral},
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
    devnode::bluetooth_batteries()
        .into_iter()
        .map(|(guid, level)| (format!("{guid:?}"), level))
        .collect()
}

pub(super) fn read_peripherals() -> Vec<Peripheral> {
    ble_battery::connected_devices(|appearance| kind_from_appearance(appearance).is_some())
        .into_iter()
        .filter_map(|device| {
            let kind = kind_from_appearance(device.appearance)?;
            Some(Peripheral {
                device: device.address,
                name: device.name,
                kind,
                battery: device.battery,
            })
        })
        .collect()
}

pub(super) fn power_source() -> (Option<bool>, Option<u8>) {
    let source = power::power_source();
    (source.map(|s| s.plugged_in), source.and_then(|s| s.battery))
}
