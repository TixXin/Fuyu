#[derive(Debug, Default)]
pub(crate) struct Timeline {
    start: Option<i64>,
    last: Option<i64>,
    paused_at: Option<i64>,
    skip_before: i64,
    shift: i64,
}

impl Timeline {
    pub(crate) fn pause(&mut self, now: i64) {
        if self.paused_at.is_none() {
            self.paused_at = Some(now);
        }
    }

    pub(crate) fn resume(&mut self, now: i64) {
        if let Some(at) = self.paused_at.take() {
            if self.start.is_some() {
                self.shift += (now - at).max(0);
            }
            self.skip_before = self.skip_before.max(now);
        }
    }

    fn open(&self, stamp: i64) -> bool {
        self.paused_at.is_none_or(|at| stamp < at) && stamp >= self.skip_before
    }

    pub(crate) fn video(&mut self, stamp: i64) -> Option<i64> {
        if !self.open(stamp) || self.last.is_some_and(|last| stamp <= last) {
            return None;
        }
        self.start.get_or_insert(stamp);
        self.last = Some(stamp);
        Some(self.shift)
    }

    pub(crate) fn audio(&self, stamp: i64) -> Option<i64> {
        let start = self.start?;
        (self.open(stamp) && stamp >= start).then_some(self.shift)
    }

    pub(crate) fn start(&self) -> Option<i64> {
        self.start
    }

    pub(crate) fn duration(&self, now: i64) -> i64 {
        let Some(start) = self.start else {
            return 0;
        };
        let end = self.paused_at.unwrap_or(now).max(self.last.unwrap_or(start));
        (end - start - self.shift).max(0)
    }
}

#[cfg(test)]
mod tests {
    use super::Timeline;

    const S: i64 = 1_000_000_000;

    #[test]
    fn the_first_frame_starts_the_video_and_audio_before_it_is_dropped() {
        let mut timeline = Timeline::default();
        assert_eq!(timeline.audio(10 * S), None);
        assert_eq!(timeline.video(10 * S), Some(0));
        assert_eq!(timeline.audio(10 * S - 1), None);
        assert_eq!(timeline.audio(10 * S + 5), Some(0));
        assert_eq!(timeline.video(10 * S), None);
    }

    #[test]
    fn a_pause_drops_what_it_covers_and_closes_the_gap() {
        let mut timeline = Timeline::default();
        timeline.video(10 * S);
        timeline.video(12 * S);
        timeline.pause(13 * S);
        assert_eq!(timeline.video(14 * S), None);
        assert_eq!(timeline.audio(14 * S), None);
        timeline.resume(20 * S);
        assert_eq!(timeline.video(19 * S), None);
        assert_eq!(timeline.video(21 * S), Some(7 * S));
        assert_eq!(timeline.audio(21 * S), Some(7 * S));
        assert_eq!(timeline.duration(23 * S), 6 * S);
        timeline.pause(24 * S);
        assert_eq!(timeline.duration(30 * S), 7 * S);
    }

    #[test]
    fn pausing_before_the_first_frame_adds_no_gap() {
        let mut timeline = Timeline::default();
        timeline.pause(S);
        timeline.resume(3 * S);
        assert_eq!(timeline.video(2 * S), None);
        assert_eq!(timeline.video(4 * S), Some(0));
        assert_eq!(Timeline::default().duration(9 * S), 0);
    }
}
