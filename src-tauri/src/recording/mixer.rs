use std::collections::VecDeque;

use super::pacing::TICKS_PER_SECOND;

pub(crate) const RATE: i64 = 48_000;
pub(crate) const CHANNELS: usize = 2;
const JITTER: i64 = RATE / 500;
const LAG: i64 = RATE / 5;
const CHUNK: i64 = RATE / 100;

pub(crate) fn frames_at(ticks: i64) -> i64 {
    (i128::from(ticks) * i128::from(RATE) / i128::from(TICKS_PER_SECOND)) as i64
}

pub(crate) fn ticks_at(frames: i64) -> i64 {
    (i128::from(frames) * i128::from(TICKS_PER_SECOND) / i128::from(RATE)) as i64
}

#[derive(Default)]
struct Track {
    start: i64,
    samples: VecDeque<f32>,
    end: Option<i64>,
}

pub(crate) struct Mixer {
    tracks: Vec<Track>,
    written: i64,
}

impl Mixer {
    pub(crate) fn new(tracks: usize) -> Self {
        Self { tracks: (0..tracks).map(|_| Track::default()).collect(), written: 0 }
    }

    pub(crate) fn written(&self) -> i64 {
        self.written
    }

    pub(crate) fn push(&mut self, track: usize, at: i64, data: &[f32]) {
        let written = self.written;
        let Some(track) = self.tracks.get_mut(track) else {
            return;
        };
        let mut at = at;
        if let Some(end) = track.end {
            if (at - end).abs() <= JITTER {
                at = end;
            }
        }
        let frames = (data.len() / CHANNELS) as i64;
        let floor = track.end.unwrap_or(written).max(written);
        let skip = (floor - at).clamp(0, frames);
        if skip == frames {
            return;
        }
        let kept = &data[skip as usize * CHANNELS..frames as usize * CHANNELS];
        at += skip;
        if track.samples.is_empty() {
            track.start = at;
        } else {
            let end = track.start + (track.samples.len() / CHANNELS) as i64;
            let gap = (at - end).max(0) as usize;
            let padded = track.samples.len() + gap * CHANNELS;
            track.samples.resize(padded, 0.0);
        }
        track.samples.extend(kept.iter().copied());
        track.end = Some(at + frames - skip);
    }

    pub(crate) fn ready(&self, clock: i64) -> Option<i64> {
        let floor = clock - LAG;
        let until = self.tracks.iter().filter_map(|track| track.end).filter(|&end| end > floor).min().unwrap_or(floor).min(clock);
        (until - self.written >= CHUNK).then_some(until)
    }

    pub(crate) fn take(&mut self, until: i64) -> Vec<f32> {
        let count = (until - self.written).max(0) as usize;
        let mut out = vec![0.0f32; count * CHANNELS];
        for track in &mut self.tracks {
            let offset = track.start - self.written;
            let begin = offset.max(0) as usize;
            if begin >= count {
                continue;
            }
            let available = track.samples.len() / CHANNELS;
            let behind = (-offset).max(0) as usize;
            let used = available.saturating_sub(behind).min(count - begin);
            for (index, sample) in track.samples.iter().skip(behind * CHANNELS).take(used * CHANNELS).enumerate() {
                out[begin * CHANNELS + index] += sample;
            }
            let consumed = (behind + used).min(available);
            track.samples.drain(..consumed * CHANNELS);
            track.start += consumed as i64;
        }
        for sample in &mut out {
            *sample = sample.clamp(-1.0, 1.0);
        }
        self.written = self.written.max(until);
        out
    }
}
