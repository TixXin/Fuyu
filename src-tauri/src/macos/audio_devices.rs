use std::{ffi::c_void, ptr::NonNull};

use objc2_core_audio::{
    kAudioDevicePropertyDeviceUID, kAudioDevicePropertyStreams, kAudioDevicePropertyTransportType,
    kAudioDeviceTransportTypeBluetooth, kAudioDeviceTransportTypeBluetoothLE, kAudioDeviceTransportTypeUSB,
    kAudioHardwarePropertyDevices, kAudioObjectPropertyElementMain, kAudioObjectPropertyName, kAudioObjectPropertyScopeGlobal,
    kAudioObjectPropertyScopeInput, kAudioObjectPropertyScopeOutput, kAudioObjectSystemObject, AudioObjectGetPropertyData,
    AudioObjectGetPropertyDataSize, AudioObjectID, AudioObjectPropertyAddress,
};
use objc2_core_foundation::{CFRetained, CFString};

use super::audio::read;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Transport {
    Bluetooth,
    Usb,
    Other,
}

impl Transport {
    pub(crate) fn from_code(code: u32) -> Self {
        if code == kAudioDeviceTransportTypeBluetooth || code == kAudioDeviceTransportTypeBluetoothLE {
            Self::Bluetooth
        } else if code == kAudioDeviceTransportTypeUSB {
            Self::Usb
        } else {
            Self::Other
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AudioOutput {
    pub(crate) uid: String,
    pub(crate) name: String,
    pub(crate) transport: Transport,
    pub(crate) has_input: bool,
}

fn address(selector: u32, scope: u32) -> AudioObjectPropertyAddress {
    AudioObjectPropertyAddress { mSelector: selector, mScope: scope, mElement: kAudioObjectPropertyElementMain }
}

fn data_size(object: AudioObjectID, selector: u32, scope: u32) -> Option<u32> {
    let mut address = address(selector, scope);
    let mut size: u32 = 0;
    let status = unsafe { AudioObjectGetPropertyDataSize(object, NonNull::from(&mut address), 0, std::ptr::null(), NonNull::from(&mut size)) };
    (status == 0).then_some(size)
}

fn devices() -> Vec<AudioObjectID> {
    let Ok(system) = AudioObjectID::try_from(kAudioObjectSystemObject) else {
        return Vec::new();
    };
    let item = std::mem::size_of::<AudioObjectID>();
    let Some(mut size) = data_size(system, kAudioHardwarePropertyDevices, kAudioObjectPropertyScopeGlobal) else {
        return Vec::new();
    };
    let mut ids: Vec<AudioObjectID> = vec![0; size as usize / item];
    let Some(buffer) = NonNull::new(ids.as_mut_ptr().cast::<c_void>()).filter(|_| !ids.is_empty()) else {
        return Vec::new();
    };
    let mut address = address(kAudioHardwarePropertyDevices, kAudioObjectPropertyScopeGlobal);
    let status = unsafe { AudioObjectGetPropertyData(system, NonNull::from(&mut address), 0, std::ptr::null(), NonNull::from(&mut size), buffer) };
    if status != 0 {
        return Vec::new();
    }
    ids.truncate(size as usize / item);
    ids
}

fn has_streams(device: AudioObjectID, scope: u32) -> bool {
    data_size(device, kAudioDevicePropertyStreams, scope).is_some_and(|size| size > 0)
}

fn text(device: AudioObjectID, selector: u32) -> Option<String> {
    let raw = read::<Option<NonNull<CFString>>>(device, selector, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain)??;
    let value = unsafe { CFRetained::from_raw(raw) };
    Some(value.to_string())
}

pub(crate) fn outputs() -> Vec<AudioOutput> {
    devices()
        .into_iter()
        .filter(|&device| has_streams(device, kAudioObjectPropertyScopeOutput))
        .filter_map(|device| {
            let uid = text(device, kAudioDevicePropertyDeviceUID)?;
            let name = text(device, kAudioObjectPropertyName).unwrap_or_else(|| uid.clone());
            let transport = read::<u32>(device, kAudioDevicePropertyTransportType, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain)
                .map_or(Transport::Other, Transport::from_code);
            Some(AudioOutput { uid, name, transport, has_input: has_streams(device, kAudioObjectPropertyScopeInput) })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{outputs, Transport};

    #[test]
    fn output_devices_have_a_uid_and_a_name() {
        for output in outputs() {
            assert!(!output.uid.is_empty() && !output.name.is_empty(), "{output:?}");
        }
        assert_eq!(Transport::from_code(0x626c_7565), Transport::Bluetooth);
        assert_eq!(Transport::from_code(0x7573_6220), Transport::Usb);
        assert_eq!(Transport::from_code(0x626c_746e), Transport::Other);
    }
}
