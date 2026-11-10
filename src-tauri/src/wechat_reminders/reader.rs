//! Reads WeChat's chat list after a taskbar flash and tells which chats got a message, or why
//! the reminder goes out without one.

use std::time::{Duration, Instant};

use serde::Serialize;

use super::chats::{self, Session};

/// WeChat updates its list a moment after the flash; a list that has not changed yet, or did not
/// answer, is read again a few times before the reminder goes out without a message.
const SETTLE: Duration = Duration::from_millis(400);
const RETRY: Duration = Duration::from_millis(700);
const READS: u32 = 3;

/// One look at WeChat's chat list.
pub(super) enum Listing {
    Rows(Vec<Session>),
    /// WeChat is closed to the tray: its window is hidden and lists no rows until reopened.
    Tray,
    /// No rows from a window that is up: the UI is not exposed, or UI Automation gave up on a
    /// busy WeChat (after a second).
    Unreadable,
}

/// Why a reminder has no contact and message.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PlainReason {
    Tray,
    Unreadable,
    /// The first readable list: nothing to compare it with.
    Baseline,
    /// Every read showed the list as it was.
    Unchanged,
    /// Only muted chats changed.
    Muted,
}

/// What a flash turned out to be.
#[derive(Debug, PartialEq)]
pub(super) enum Flash {
    Messages(Vec<Session>),
    /// `None`: the setting is off, so the list was not read.
    Plain(Option<PlainReason>),
}

/// Reads the chat list (`look`) after flashes and compares it with the last read.
pub(super) struct ChatReader<L: FnMut() -> Listing> {
    look: L,
    seen: Option<Vec<Session>>,
    due: Option<Instant>,
    reads: u32,
    /// A muted chat changed in one of this flash's reads.
    muted_changed: bool,
    /// Read the list again once the user has left WeChat: what changed while they were in it is
    /// not news at the next flash.
    rebase: Option<Instant>,
    in_wechat: bool,
    /// The "show the contact and message" setting. Off, the list is never read, even while a
    /// screen reader has WeChat's UI exposed: who wrote and what shows only when the user asked.
    allowed: bool,
}

impl<L: FnMut() -> Listing> ChatReader<L> {
    pub(super) fn new(look: L, allowed: bool) -> Self {
        let mut reader = Self {
            look,
            seen: None,
            due: None,
            reads: 0,
            muted_changed: false,
            rebase: None,
            in_wechat: false,
            allowed,
        };
        reader.rebaseline();
        reader
    }

    /// Takes the list as it is as the baseline (nothing readable: no baseline).
    pub(super) fn rebaseline(&mut self) {
        self.seen = match self.allowed.then(|| (self.look)()) {
            Some(Listing::Rows(rows)) => Some(rows),
            _ => None,
        };
    }

    /// Follows the setting; turned on, the list as it is becomes the baseline.
    pub(super) fn set_allowed(&mut self, allowed: bool) {
        if self.allowed != allowed {
            self.allowed = allowed;
            self.rebaseline();
        }
    }

    pub(super) fn flashed(&mut self, now: Instant) {
        self.rebase = None;
        if self.due.is_none() {
            // Nothing readable last time: find out now rather than hold the reminder back.
            let wait = if self.seen.is_some() {
                SETTLE
            } else {
                Duration::ZERO
            };
            self.due = Some(now + wait);
            self.reads = 0;
            self.muted_changed = false;
        }
    }

    pub(super) fn activated(&mut self, in_wechat: bool, now: Instant) {
        let left = std::mem::replace(&mut self.in_wechat, in_wechat) && !in_wechat;
        if left && self.due.is_none() {
            self.rebase = Some(now + SETTLE);
        }
    }

    /// What the flash was once its reads are done; `None` while there is nothing to report yet.
    pub(super) fn tick(&mut self, now: Instant) -> Option<Flash> {
        if self.rebase.is_some_and(|at| now >= at) {
            self.rebase = None;
            if let Some(Listing::Rows(rows)) = self.allowed.then(|| (self.look)()) {
                self.seen = Some(rows);
            }
        }
        if !self.due.is_some_and(|at| now >= at) {
            return None;
        }
        if !self.allowed {
            self.due = None;
            return Some(Flash::Plain(None));
        }
        let reason = match ((self.look)(), self.seen.take()) {
            (Listing::Rows(rows), Some(before)) => {
                let fresh: Vec<Session> = chats::new_messages(&before, &rows)
                    .into_iter()
                    .cloned()
                    .collect();
                self.muted_changed |= chats::muted_changed(&before, &rows);
                self.seen = Some(rows);
                if !fresh.is_empty() {
                    self.due = None;
                    return Some(Flash::Messages(fresh));
                }
                if self.muted_changed {
                    PlainReason::Muted
                } else {
                    PlainReason::Unchanged
                }
            }
            (Listing::Rows(rows), None) => {
                self.seen = Some(rows);
                self.due = None;
                return Some(Flash::Plain(Some(PlainReason::Baseline)));
            }
            (Listing::Tray, before) => {
                self.seen = before;
                self.due = None;
                return Some(Flash::Plain(Some(PlainReason::Tray)));
            }
            // A list that was readable before may only be busy now, so it is read again like an
            // unchanged one; one that never was readable is not worth holding the reminder for.
            (Listing::Unreadable, before) => {
                let was_readable = before.is_some();
                self.seen = before;
                if !was_readable {
                    self.due = None;
                    return Some(Flash::Plain(Some(PlainReason::Unreadable)));
                }
                if self.muted_changed {
                    PlainReason::Muted
                } else {
                    PlainReason::Unreadable
                }
            }
        };
        self.reads += 1;
        if self.reads < READS {
            self.due = Some(now + RETRY);
            return None;
        }
        self.due = None;
        Some(Flash::Plain(Some(reason)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{cell::RefCell, collections::VecDeque, rc::Rc};

    fn row(key: &str, preview: &str, muted: bool) -> Session {
        Session {
            key: key.into(),
            contact: key.into(),
            preview: preview.into(),
            unread: None,
            muted,
            mentioned: false,
            pinned: false,
        }
    }

    /// A reader whose looks come from the returned queue, one per read.
    fn reader(
        first: Listing,
    ) -> (
        ChatReader<impl FnMut() -> Listing>,
        Rc<RefCell<VecDeque<Listing>>>,
    ) {
        let looks = Rc::new(RefCell::new(VecDeque::from([first])));
        let queue = looks.clone();
        let look = move || {
            queue
                .borrow_mut()
                .pop_front()
                .unwrap_or(Listing::Unreadable)
        };
        (ChatReader::new(look, true), looks)
    }

    /// Flashes at `start` and ticks through the reads; the outcome and how many reads it took.
    fn flash(reader: &mut ChatReader<impl FnMut() -> Listing>, start: Instant) -> (Flash, u32) {
        reader.flashed(start);
        assert_eq!(reader.tick(start), None, "the list gets a moment to settle");
        let mut now = start + SETTLE;
        for reads in 1..=READS {
            if let Some(outcome) = reader.tick(now) {
                return (outcome, reads);
            }
            now += RETRY;
        }
        panic!("no outcome after {READS} reads");
    }

    #[test]
    fn a_busy_wechat_is_read_again_before_the_reminder_goes_out_plain() {
        let before = vec![row("a", "hi", false)];
        let (mut reader, looks) = reader(Listing::Rows(before.clone()));
        // WeChat does not answer the first read, then shows the new message.
        looks.borrow_mut().extend([
            Listing::Unreadable,
            Listing::Rows(vec![row("a", "new", false)]),
        ]);
        let start = Instant::now();
        assert_eq!(
            flash(&mut reader, start),
            (Flash::Messages(vec![row("a", "new", false)]), 2)
        );
        // It never answers: plain after all the reads, and the old baseline is kept.
        looks.borrow_mut().extend([
            Listing::Unreadable,
            Listing::Unreadable,
            Listing::Unreadable,
        ]);
        assert_eq!(
            flash(&mut reader, start),
            (Flash::Plain(Some(PlainReason::Unreadable)), READS)
        );
        looks
            .borrow_mut()
            .push_back(Listing::Rows(vec![row("a", "newer", false)]));
        assert_eq!(
            flash(&mut reader, start).0,
            Flash::Messages(vec![row("a", "newer", false)])
        );
    }

    #[test]
    fn plain_reminders_say_why() {
        let (mut reader, looks) = reader(Listing::Rows(vec![
            row("a", "hi", false),
            row("m", "old", true),
        ]));
        let start = Instant::now();
        // The tray answers at once: no reads held back for it.
        looks.borrow_mut().push_back(Listing::Tray);
        assert_eq!(
            flash(&mut reader, start),
            (Flash::Plain(Some(PlainReason::Tray)), 1)
        );
        let same = || Listing::Rows(vec![row("a", "hi", false), row("m", "old", true)]);
        looks.borrow_mut().extend([same(), same(), same()]);
        assert_eq!(
            flash(&mut reader, start),
            (Flash::Plain(Some(PlainReason::Unchanged)), READS)
        );
        // A muted chat changed on the first read only: still the reason after the last one.
        let muted = || Listing::Rows(vec![row("a", "hi", false), row("m", "new", true)]);
        looks.borrow_mut().extend([muted(), muted(), muted()]);
        assert_eq!(
            flash(&mut reader, start),
            (Flash::Plain(Some(PlainReason::Muted)), READS)
        );
        // Nor does WeChat falling silent after that read change the reason.
        let newer = Listing::Rows(vec![row("a", "hi", false), row("m", "newer", true)]);
        looks.borrow_mut().push_back(newer);
        assert_eq!(
            flash(&mut reader, start),
            (Flash::Plain(Some(PlainReason::Muted)), READS)
        );
    }

    #[test]
    fn nothing_readable_is_not_waited_for_and_the_setting_off_reads_nothing() {
        let (mut reader, looks) = reader(Listing::Unreadable);
        let start = Instant::now();
        reader.flashed(start);
        assert_eq!(
            reader.tick(start),
            Some(Flash::Plain(Some(PlainReason::Unreadable)))
        );
        // The first readable list is only the baseline.
        looks
            .borrow_mut()
            .push_back(Listing::Rows(vec![row("a", "hi", false)]));
        reader.flashed(start);
        assert_eq!(
            reader.tick(start),
            Some(Flash::Plain(Some(PlainReason::Baseline)))
        );
        reader.set_allowed(false);
        looks
            .borrow_mut()
            .push_back(Listing::Rows(vec![row("a", "new", false)]));
        reader.flashed(start);
        assert_eq!(reader.tick(start), Some(Flash::Plain(None)));
        assert_eq!(looks.borrow().len(), 1, "off, the list is not read");
    }
}
