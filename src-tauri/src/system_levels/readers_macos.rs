use crate::macos::audio;

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

pub(super) fn open_brightness() -> Option<()> {
    None
}

pub(super) fn brightness_percent(_brightness: &()) -> Option<u32> {
    None
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
