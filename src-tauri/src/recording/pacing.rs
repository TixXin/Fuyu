pub(crate) const TICKS_PER_SECOND: i64 = 10_000_000;
const STALL_INTERVALS: i64 = 3;

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Step<T> {
    Write(T, i64),
    Repeat(T, i64),
    Wait(Option<i64>),
}

struct Shown<T> {
    frame: T,
    stamp: i64,
    repeats: i64,
}

pub(crate) struct Pacer<T> {
    interval: i64,
    origin: Option<i64>,
    shown: Option<Shown<T>>,
    pending: Option<(T, i64)>,
    paused_at: Option<i64>,
    paused_total: i64,
}

impl<T: Clone> Pacer<T> {
    pub(crate) fn new(fps: u32) -> Self {
        Self {
            interval: TICKS_PER_SECOND / i64::from(fps.max(1)),
            origin: None,
            shown: None,
            pending: None,
            paused_at: None,
            paused_total: 0,
        }
    }

    pub(crate) fn interval(&self) -> i64 {
        self.interval
    }

    fn clock(&self, now: i64) -> i64 {
        self.origin.map_or(0, |origin| now - origin - self.paused_total)
    }

    fn last_out(&self) -> Option<i64> {
        self.shown.as_ref().map(|shown| shown.stamp + shown.repeats * self.interval)
    }

    pub(crate) fn push(&mut self, frame: T, captured: i64) {
        if self.paused_at.is_some() {
            return;
        }
        let origin = *self.origin.get_or_insert(captured);
        self.pending = Some((frame, captured - origin - self.paused_total));
    }

    pub(crate) fn pause(&mut self, now: i64) {
        if self.paused_at.is_none() {
            self.paused_at = Some(now);
            self.pending = None;
        }
    }

    pub(crate) fn resume(&mut self, now: i64) {
        if let Some(at) = self.paused_at.take() {
            self.paused_total += (now - at).max(0);
        }
    }

    fn show(&mut self, frame: T, stamp: i64) -> Step<T> {
        self.shown = Some(Shown { frame: frame.clone(), stamp, repeats: 0 });
        Step::Write(frame, stamp)
    }

    pub(crate) fn next(&mut self, now: i64) -> Step<T> {
        if self.paused_at.is_some() {
            return Step::Wait(None);
        }
        let clock = self.clock(now);
        if let Some((frame, stamp)) = self.pending.take() {
            let Some(last) = self.last_out() else {
                return self.show(frame, stamp.max(0));
            };
            let earliest = last + self.interval;
            if stamp >= earliest {
                return self.show(frame, stamp);
            }
            if clock >= earliest {
                return self.show(frame, earliest);
            }
            self.pending = Some((frame, stamp));
            return Step::Wait(Some(earliest - clock));
        }
        let interval = self.interval;
        let Some(shown) = self.shown.as_mut() else {
            return Step::Wait(None);
        };
        let due = shown.stamp + interval * (STALL_INTERVALS + shown.repeats);
        if clock < due {
            return Step::Wait(Some(due - clock));
        }
        shown.repeats += 1;
        Step::Repeat(shown.frame.clone(), shown.stamp + shown.repeats * interval)
    }

    pub(crate) fn finish(&mut self) -> Option<(T, i64)> {
        let (frame, stamp) = self.pending.take()?;
        let stamp = self.last_out().map_or(stamp, |last| stamp.max(last + 1));
        self.shown = Some(Shown { frame: frame.clone(), stamp, repeats: 0 });
        Some((frame, stamp))
    }

    pub(crate) fn duration(&self) -> i64 {
        self.last_out().map_or(0, |last| last + self.interval)
    }
}
