use std::{ffi::c_void, ptr::NonNull};

use objc2_core_audio::{
    kAudioDevicePropertyMute, kAudioDevicePropertyVolumeScalar, kAudioHardwarePropertyDefaultOutputDevice,
    kAudioObjectPropertyElementMain, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyScopeOutput,
    kAudioObjectSystemObject, AudioObjectGetPropertyData, AudioObjectID, AudioObjectPropertyAddress,
};

const LEFT: u32 = 1;
const RIGHT: u32 = 2;

fn read<T: Copy + Default>(object: AudioObjectID, selector: u32, scope: u32, element: u32) -> Option<T> {
    let mut address = AudioObjectPropertyAddress { mSelector: selector, mScope: scope, mElement: element };
    let mut value = T::default();
    let mut size = u32::try_from(std::mem::size_of::<T>()).ok()?;
    let status = unsafe {
        AudioObjectGetPropertyData(
            object,
            NonNull::from(&mut address),
            0,
            std::ptr::null(),
            NonNull::from(&mut size),
            NonNull::from(&mut value).cast::<c_void>(),
        )
    };
    (status == 0).then_some(value)
}

pub(crate) fn default_output() -> Option<AudioObjectID> {
    let system = AudioObjectID::try_from(kAudioObjectSystemObject).ok()?;
    read::<AudioObjectID>(system, kAudioHardwarePropertyDefaultOutputDevice, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain)
        .filter(|&device| device != 0)
}

pub(crate) fn volume(device: AudioObjectID) -> Option<f32> {
    let channel = |element| read::<f32>(device, kAudioDevicePropertyVolumeScalar, kAudioObjectPropertyScopeOutput, element);
    channel(kAudioObjectPropertyElementMain).or_else(|| match (channel(LEFT), channel(RIGHT)) {
        (Some(left), Some(right)) => Some((left + right) / 2.0),
        (one, other) => one.or(other),
    })
}

pub(crate) fn muted(device: AudioObjectID) -> bool {
    read::<u32>(device, kAudioDevicePropertyMute, kAudioObjectPropertyScopeOutput, kAudioObjectPropertyElementMain)
        .is_some_and(|mute| mute != 0)
}
