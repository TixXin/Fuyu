use std::{
    sync::{
        mpsc::{self, SyncSender},
        Mutex, OnceLock,
    },
    thread,
    time::Duration,
};

use super::service;
use crate::macos::pasteboard;

const POLL_INTERVAL: Duration = Duration::from_millis(400);

static CLIPBOARD_NOTIFY_TX: OnceLock<Mutex<Option<SyncSender<()>>>> = OnceLock::new();

pub(super) fn start_workers() {
    let (tx, rx) = mpsc::sync_channel::<()>(1);
    let _ = CLIPBOARD_NOTIFY_TX.set(Mutex::new(Some(tx)));

    thread::spawn(move || {
        while rx.recv().is_ok() {
            if let Ok(service) = service() {
                service.capture_current_clipboard();
            }
        }
    });

    thread::spawn(|| {
        let mut seen = pasteboard::change_count();
        loop {
            thread::sleep(POLL_INTERVAL);
            let count = pasteboard::change_count();
            if count != seen {
                seen = count;
                notify_clipboard_changed();
            }
        }
    });

    super::hotkey::request_hotkey_refresh();
}

pub(super) fn notify_clipboard_changed() {
    if let Some(sender) = CLIPBOARD_NOTIFY_TX
        .get()
        .and_then(|sender| sender.lock().ok())
        .and_then(|sender| sender.as_ref().cloned())
    {
        let _ = sender.try_send(());
    }
}
