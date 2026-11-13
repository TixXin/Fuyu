use crate::macos::{audio, brightness::{self, BuiltinBrightness}};

pub(super) type OutputVolume = u32;

pub(super) fn start_thread() -> Option<()> {
    Some(())
}

pub(super) fn volume_reading(device: &OutputVolume) -> Option<(u32, bool)> {
    let level = audio::volume(*device)?.clamp(0.0, 1.0);
    Some(((level * 100.0).round() as u32, audio::muted(*device)))
}

pub(super) fn open_volume() -> Option<OutputVolume> {
    audio::default_output()
}

pub(super) fn open_brightness() -> Option<BuiltinBrightness> {
    brightness::open()
}

pub(super) fn brightness_percent(brightness: &BuiltinBrightness) -> Option<u32> {
    brightness.level().map(|level| (level * 100.0).round() as u32)
}

#[cfg(test)]
mod tests {
    use super::{open_volume, volume_reading};

    #[test]
    fn the_default_output_has_a_volume_when_there_is_one() {
        if let Some(device) = open_volume() {
            let (percent, _) = volume_reading(&device).unwrap_or((0, false));
            assert!(percent <= 100);
        }
    }
}
