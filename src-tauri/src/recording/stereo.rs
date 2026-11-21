use super::mixer::{CHANNELS, RATE};

pub(crate) fn to_stereo(samples: &[f32], channels: usize, rate: f64) -> Vec<f32> {
    if channels == 0 || !rate.is_finite() || rate <= 0.0 {
        return Vec::new();
    }
    let frames = samples.len() / channels;
    let frame = |index: usize| -> (f32, f32) {
        let at = index * channels;
        let left = samples[at];
        (left, if channels > 1 { samples[at + 1] } else { left })
    };
    if (rate - RATE as f64).abs() < 0.5 {
        return (0..frames).flat_map(|index| <[f32; CHANNELS]>::from(frame(index))).collect();
    }
    if frames == 0 {
        return Vec::new();
    }
    let out_frames = ((frames as f64) * RATE as f64 / rate).round() as usize;
    let step = rate / RATE as f64;
    (0..out_frames)
        .flat_map(|index| {
            let position = index as f64 * step;
            let before = (position.floor() as usize).min(frames - 1);
            let after = (before + 1).min(frames - 1);
            let weight = (position - before as f64) as f32;
            let (a, b) = (frame(before), frame(after));
            [a.0 + (b.0 - a.0) * weight, a.1 + (b.1 - a.1) * weight]
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::to_stereo;

    #[test]
    fn stereo_at_the_output_rate_passes_through() {
        assert_eq!(to_stereo(&[0.1, 0.2, 0.3, 0.4], 2, 48_000.0), vec![0.1, 0.2, 0.3, 0.4]);
    }

    #[test]
    fn mono_is_copied_to_both_sides_and_extra_channels_are_dropped() {
        assert_eq!(to_stereo(&[0.5, -0.5], 1, 48_000.0), vec![0.5, 0.5, -0.5, -0.5]);
        assert_eq!(to_stereo(&[0.1, 0.2, 0.9, 0.3, 0.4, 0.9], 3, 48_000.0), vec![0.1, 0.2, 0.3, 0.4]);
    }

    #[test]
    fn another_rate_is_resampled_to_the_output_rate() {
        let mono: Vec<f32> = (0..441).map(|index| index as f32 / 441.0).collect();
        let out = to_stereo(&mono, 1, 44_100.0);
        assert_eq!(out.len(), 480 * 2);
        assert!((out[2 * 240] - 0.5).abs() < 0.01);
        assert!(to_stereo(&[0.1], 0, 48_000.0).is_empty());
    }
}
