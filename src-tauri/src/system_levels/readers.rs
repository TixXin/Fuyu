use crate::win32::{
    audio::{AudioDevices, OutputRole, VolumeSubscription},
    brightness::DisplayBrightness,
    com::ComApartment,
};

pub(super) struct OutputVolume {
    inner: crate::win32::audio::OutputVolume,
    subscription: Option<VolumeSubscription>,
}

impl OutputVolume {
    pub(super) fn is_subscribed(&self) -> bool {
        self.subscription.is_some()
    }
}

pub(super) fn start_thread() -> Option<ComApartment> {
    ComApartment::multithreaded().ok()
}

pub(super) fn volume_reading(volume: &OutputVolume) -> Option<(u32, bool)> {
    let level = volume.inner.level().ok()?.clamp(0.0, 1.0);
    Some(((level * 100.0).round() as u32, volume.inner.muted().ok()?))
}

pub(super) fn open_volume<F>(on_change: F) -> Option<OutputVolume>
where
    F: Fn(u32, bool) + Send + Sync + 'static,
{
    let inner = AudioDevices::open().ok()?.default_output(OutputRole::Multimedia).ok()?.volume().ok()?;
    let subscription = inner.subscribe(on_change).ok();
    Some(OutputVolume { inner, subscription })
}

pub(super) fn open_brightness() -> Option<DisplayBrightness> {
    DisplayBrightness::open().ok()
}

pub(super) fn brightness_percent(brightness: &DisplayBrightness) -> Option<u32> {
    brightness.percent()
}
