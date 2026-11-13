use std::collections::HashMap;

use crate::macos::{
    audio_devices::{self, AudioOutput, Transport},
    bluetooth, power,
};

use super::tracker::{AudioKind, Output};

pub(super) fn start_thread() -> Option<()> {
    Some(())
}

fn classify(output: AudioOutput) -> Option<Output> {
    let (kind, bluetooth) = match output.transport {
        Transport::Bluetooth => (AudioKind::Headphones, true),
        Transport::Usb if output.has_input => (AudioKind::Headset, false),
        _ => return None,
    };
    let device = bluetooth.then(|| bluetooth::address_key(&output.uid)).flatten().unwrap_or_else(|| output.uid.clone());
    Some(Output { id: output.uid, name: output.name, kind, device, bluetooth })
}

pub(super) fn read_outputs() -> Vec<Output> {
    audio_devices::outputs().into_iter().filter_map(classify).collect()
}

pub(super) fn read_batteries() -> HashMap<String, u8> {
    bluetooth::connected_batteries()
}

pub(super) fn power_source() -> (Option<bool>, Option<u8>) {
    let source = power::power_source();
    (source.map(|s| s.plugged_in), source.and_then(|s| s.battery))
}

#[cfg(test)]
mod tests {
    use super::{classify, AudioKind, AudioOutput, Transport};

    fn output(uid: &str, transport: Transport, has_input: bool) -> AudioOutput {
        AudioOutput { uid: uid.into(), name: "Device".into(), transport, has_input }
    }

    #[test]
    fn bluetooth_and_usb_headsets_are_announced_but_built_in_speakers_are_not() {
        let buds = classify(output("B4-E7-B3-CA-E4-EB:output", Transport::Bluetooth, false));
        assert!(buds.as_ref().is_some_and(|o| o.kind == AudioKind::Headphones && o.bluetooth && o.device == "B4E7B3CAE4EB"), "{buds:?}");
        let headset = classify(output("AppleUSBAudioEngine:Jabra:1", Transport::Usb, true));
        assert!(headset.as_ref().is_some_and(|o| o.kind == AudioKind::Headset && !o.bluetooth && o.device == o.id), "{headset:?}");
        assert!(classify(output("AppleUSBAudioEngine:DAC:1", Transport::Usb, false)).is_none());
        assert!(classify(output("BuiltInSpeakerDevice", Transport::Other, false)).is_none());
    }

    #[test]
    #[ignore = "reads the real devices of the computer it runs on"]
    fn probe_this_computer() {
        for output in crate::macos::audio_devices::outputs() {
            println!("{output:?}");
        }
        println!("announced: {:?}", super::read_outputs());
        println!("batteries: {:?}", super::read_batteries());
        println!("power: {:?}", super::power_source());
    }
}
