use std::sync::Arc;

use crate::win32::{
    audio::{
        AudioDevices, EndpointEpochs, EndpointNotificationSubscription, VolumeSubscription,
    },
    brightness::DisplayBrightness,
    com::ComApartment,
};

pub(super) struct AudioThread {
    seen_epoch: u64,
    epochs: Option<Arc<EndpointEpochs>>,
    subscription: Option<EndpointNotificationSubscription>,
    devices: Option<AudioDevices>,
    _apartment: ComApartment,
}

pub(super) struct OutputVolume {
    inner: crate::win32::audio::OutputVolume,
    subscription: Option<VolumeSubscription>,
}

impl OutputVolume {
    pub(super) fn is_subscribed(&self) -> bool {
        self.subscription.is_some()
    }
}

pub(super) fn start_thread() -> Option<AudioThread> {
    let apartment = ComApartment::multithreaded().ok()?;
    let devices = AudioDevices::open().ok();
    let (subscription, epochs) = match devices.as_ref().and_then(|dev| dev.subscribe_endpoints().ok()) {
        Some((sub, ep)) => (Some(sub), Some(ep)),
        None => (None, None),
    };
    Some(AudioThread {
        seen_epoch: 0,
        epochs,
        subscription,
        devices,
        _apartment: apartment,
    })
}

pub(super) fn should_reopen_volume(
    thread: &mut AudioThread,
    has_volume: bool,
    fallback_due: bool,
) -> bool {
    if thread.subscription.is_some() {
        if let Some(epochs) = thread.epochs.as_ref() {
            let current = epochs.default_render_epoch();
            if current != thread.seen_epoch {
                thread.seen_epoch = current;
                return true;
            }
            return !has_volume && fallback_due;
        }
    }
    !has_volume || fallback_due
}

pub(super) fn volume_reading(volume: &OutputVolume) -> Option<(u32, bool)> {
    let level = volume.inner.level().ok()?.clamp(0.0, 1.0);
    Some(((level * 100.0).round() as u32, volume.inner.muted().ok()?))
}

pub(super) fn open_volume<F>(thread: &AudioThread, on_change: F) -> Option<OutputVolume>
where
    F: Fn(u32, bool) + Send + Sync + 'static,
{
    let inner = match thread.devices.as_ref() {
        Some(devices) => devices.default_render_output().ok()?.volume().ok()?,
        None => AudioDevices::open()
            .ok()?
            .default_render_output()
            .ok()?
            .volume()
            .ok()?,
    };
    let subscription = inner.subscribe(on_change).ok();
    Some(OutputVolume { inner, subscription })
}

pub(super) fn open_brightness() -> Option<DisplayBrightness> {
    DisplayBrightness::open().ok()
}

pub(super) fn brightness_percent(brightness: &DisplayBrightness) -> Option<u32> {
    brightness.percent()
}
