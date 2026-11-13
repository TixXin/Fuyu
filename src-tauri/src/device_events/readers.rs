use std::collections::HashMap;

use crate::win32::{audio_outputs, com::ComApartment, devnode, power};

use super::tracker::Output;

pub(super) fn start_thread() -> Option<ComApartment> {
    ComApartment::multithreaded().ok()
}

pub(super) fn read_outputs() -> Vec<Output> {
    let Ok(outputs) = audio_outputs::active_outputs() else {
        return Vec::new();
    };
    outputs
        .into_iter()
        .filter_map(|info| {
            let device = devnode::container_id(&format!(r"SWD\MMDEVAPI\{}", info.id)).map(|guid| format!("{guid:?}"));
            Output::classify(info.id, info.name, info.form_factor, &info.enumerator, device)
        })
        .collect()
}

pub(super) fn read_batteries() -> HashMap<String, u8> {
    devnode::bluetooth_batteries().into_iter().map(|(guid, level)| (format!("{guid:?}"), level)).collect()
}

pub(super) fn power_source() -> (Option<bool>, Option<u8>) {
    let source = power::power_source();
    (source.map(|s| s.plugged_in), source.and_then(|s| s.battery))
}
