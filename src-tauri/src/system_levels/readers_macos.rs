use crate::macos::{
    audio,
    brightness::{self, BuiltinBrightness},
};

pub(super) struct AudioThread;

pub(super) struct OutputVolume(u32);

impl OutputVolume {
    pub(super) fn is_subscribed(&self) -> bool {
        false
    }
}

pub(super) fn start_thread() -> Option<AudioThread> {
    Some(AudioThread)
}

pub(super) fn should_reopen_volume(
    _thread: &mut AudioThread,
    has_volume: bool,
    fallback_due: bool,
) -> bool {
    !has_volume || fallback_due
}

pub(super) fn volume_reading(device: &OutputVolume) -> Option<(u32, bool)> {
    let level = audio::volume(device.0)?.clamp(0.0, 1.0);
    Some(((level * 100.0).round() as u32, audio::muted(device.0)))
}

pub(super) fn open_volume<F>(_thread: &AudioThread, _on_change: F) -> Option<OutputVolume>
where
    F: Fn(u32, bool) + Send + Sync + 'static,
{
    audio::default_output().map(OutputVolume)
}

pub(super) fn open_brightness() -> Option<BuiltinBrightness> {
    brightness::open()
}

pub(super) fn brightness_percent(brightness: &BuiltinBrightness) -> Option<u32> {
    brightness.level().map(|level| (level * 100.0).round() as u32)
}

#[cfg(test)]
mod tests {
    use super::{open_volume, volume_reading, AudioThread};

    #[test]
    fn the_default_output_has_a_volume_when_there_is_one() {
        if let Some(device) = open_volume(&AudioThread, |_, _| {}) {
            let (percent, _) = volume_reading(&device).unwrap_or((0, false));
            assert!(percent <= 100);
        }
    }
}
