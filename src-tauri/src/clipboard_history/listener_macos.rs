use std::{
    sync::{Mutex, PoisonError},
    time::Duration,
};

use super::workers::{notify_clipboard_changed, Ticker};
use crate::macos::pasteboard;

const POLL_INTERVAL: Duration = Duration::from_millis(400);

static POLL: Mutex<Option<Ticker>> = Mutex::new(None);

pub(super) fn start() -> Result<(), String> {
    let mut slot = POLL.lock().unwrap_or_else(PoisonError::into_inner);
    if slot.as_ref().is_some_and(Ticker::alive) {
        return Ok(());
    }
    let mut seen = pasteboard::change_count();
    *slot = Some(Ticker::spawn("clipboard-poll", POLL_INTERVAL, move || {
        let count = pasteboard::change_count();
        if count != seen {
            seen = count;
            notify_clipboard_changed();
        }
    })?);
    drop(slot);
    super::hotkey::request_hotkey_refresh();
    Ok(())
}

pub(super) fn stop() {
    let poll = POLL.lock().unwrap_or_else(PoisonError::into_inner).take();
    if let Some(poll) = poll {
        poll.stop();
    }
    super::hotkey::request_hotkey_refresh();
}

pub(super) fn running() -> bool {
    POLL.lock().unwrap_or_else(PoisonError::into_inner).as_ref().is_some_and(Ticker::alive)
}
