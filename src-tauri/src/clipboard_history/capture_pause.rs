//! Pausing the history (C38): for a while, until resumed, or for the next copy only. Kept in
//! memory, so starting the app again records as before.

use serde::{Deserialize, Serialize};
use std::sync::{Mutex, PoisonError};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureStatus {
    paused: bool,
    /// When a timed pause ends (ms since the epoch); none while paused until resumed.
    paused_until: Option<i64>,
    /// The next copy is not recorded.
    ignore_next: bool,
}

impl CaptureStatus {
    /// As of `now`: a timed pause that has run out is over.
    fn at(mut self, now: i64) -> Self {
        if self.paused && self.paused_until.is_some_and(|until| now >= until) {
            self.paused = false;
            self.paused_until = None;
        }
        self
    }
}

static STATUS: Mutex<CaptureStatus> = Mutex::new(CaptureStatus { paused: false, paused_until: None, ignore_next: false });

fn with_status<T>(change: impl FnOnce(&mut CaptureStatus) -> T) -> T {
    let mut status = STATUS.lock().unwrap_or_else(PoisonError::into_inner);
    change(&mut status)
}

pub(super) fn status(now: i64) -> CaptureStatus {
    with_status(|status| {
        *status = status.at(now);
        *status
    })
}

/// Whether recording is paused now, for the tray menu.
pub(crate) fn paused() -> bool {
    status(super::current_unix_millis()).paused
}

/// Pauses for `minutes`, or until resumed when none.
pub(super) fn pause(minutes: Option<u32>, now: i64) {
    with_status(|status| {
        status.paused = true;
        status.paused_until = minutes.map(|minutes| now + i64::from(minutes) * 60_000);
    });
}

pub(super) fn resume() {
    with_status(|status| *status = CaptureStatus::default());
}

pub(super) fn ignore_next() {
    with_status(|status| status.ignore_next = true);
}

/// Whether the copy happening now is left out; uses up "ignore the next copy".
pub(super) fn skips_capture(now: i64) -> bool {
    with_status(|status| {
        *status = status.at(now);
        if status.paused {
            return true;
        }
        std::mem::take(&mut status.ignore_next)
    })
}

#[cfg(test)]
mod tests {
    use super::CaptureStatus;

    #[test]
    fn a_timed_pause_ends_by_itself() {
        let paused = CaptureStatus { paused: true, paused_until: Some(1_000), ignore_next: false };
        assert!(paused.at(999).paused);
        assert_eq!(paused.at(1_000), CaptureStatus::default());
        let open_ended = CaptureStatus { paused: true, paused_until: None, ignore_next: false };
        assert!(open_ended.at(i64::MAX).paused);
    }
}
