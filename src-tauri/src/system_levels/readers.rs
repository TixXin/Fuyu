use crate::win32::{
    audio::{AudioDevices, OutputRole},
    brightness::DisplayBrightness,
    com::ComApartment,
};

pub(super) use crate::win32::audio::OutputVolume;

pub(super) fn start_thread() -> Option<ComApartment> {
    ComApartment::multithreaded().ok()
}

pub(super) fn volume_reading(volume: &OutputVolume) -> Option<(u32, bool)> {
    let level = volume.level().ok()?.clamp(0.0, 1.0);
    Some(((level * 100.0).round() as u32, volume.muted().ok()?))
}

pub(super) fn open_volume() -> Option<OutputVolume> {
    AudioDevices::open().ok()?.default_output(OutputRole::Multimedia).ok()?.volume().ok()
}

pub(super) fn open_brightness() -> Option<DisplayBrightness> {
    DisplayBrightness::open().ok()
}

pub(super) fn brightness_percent(brightness: &DisplayBrightness) -> Option<u32> {
    brightness.percent()
}
