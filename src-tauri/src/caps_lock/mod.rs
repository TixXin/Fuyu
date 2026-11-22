use std::{
    sync::Arc,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::island::WINDOW_LABEL;
use crate::platform::input;
use crate::plugin_kernel::{
    builtins,
    worker::{Stop, Worker},
};

pub(crate) const CAPS_LOCK_EVENT: &str = "caps-lock-changed";
const PLUGIN_ID: &str = "caps-lock";
const WATCHER: &str = "watcher";

const POLL: Duration = Duration::from_millis(150);
const ASLEEP_AFTER: Duration = Duration::from_secs(2);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ChangeSource {
    Key,
    Wake,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub(crate) struct CapsLockChange {
    pub(crate) on: bool,
    pub(crate) source: ChangeSource,
}

#[derive(Debug, Default)]
pub(crate) struct CapsLockTracker {
    last: Option<bool>,
}

impl CapsLockTracker {
    pub(crate) fn update(&mut self, on: bool, since_last_read: Duration) -> Option<CapsLockChange> {
        let previous = self.last.replace(on)?;
        if previous == on {
            return None;
        }
        let source = if since_last_read >= ASLEEP_AFTER { ChangeSource::Wake } else { ChangeSource::Key };
        Some(CapsLockChange { on, source })
    }
}

fn watch(app: &AppHandle, stop: &Stop) {
    let mut tracker = CapsLockTracker::default();
    let mut read_at = Instant::now();
    loop {
        let since_last_read = read_at.elapsed();
        read_at = Instant::now();
        if let Some(change) = tracker.update(input::is_caps_lock_on(), since_last_read) {
            let _ = app.emit_to(WINDOW_LABEL, CAPS_LOCK_EVENT, change);
        }
        if stop.wait(POLL) {
            return;
        }
    }
}

#[tauri::command]
pub fn get_caps_lock_state() -> bool {
    input::is_caps_lock_on()
}

#[tauri::command]
pub async fn turn_off_caps_lock() -> bool {
    input::turn_off_caps_lock()
}

pub(crate) fn init(app: &AppHandle) {
    let app = app.clone();
    let watcher = Worker::new("caps-lock", move |stop| watch(&app, &stop));
    if let Err(error) = builtins::register(PLUGIN_ID, WATCHER, Arc::new(watcher)) {
        eprintln!("[plugins-v3] {error}");
    }
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::caps_lock::get_caps_lock_state,
            crate::caps_lock::turn_off_caps_lock,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::{CapsLockChange, CapsLockTracker, ChangeSource};

    const TICK: Duration = Duration::from_millis(150);

    #[test]
    fn the_first_reading_only_remembers_the_state() {
        let mut tracker = CapsLockTracker::default();
        assert_eq!(tracker.update(true, TICK), None);
        assert_eq!(tracker.update(true, TICK), None);
    }

    #[test]
    fn a_change_between_two_close_readings_comes_from_the_key() {
        let mut tracker = CapsLockTracker::default();
        tracker.update(false, TICK);
        assert_eq!(tracker.update(true, TICK), Some(CapsLockChange { on: true, source: ChangeSource::Key }));
        assert_eq!(tracker.update(false, TICK), Some(CapsLockChange { on: false, source: ChangeSource::Key }));
    }

    #[test]
    fn a_change_after_a_long_gap_happened_while_asleep() {
        let mut tracker = CapsLockTracker::default();
        tracker.update(false, TICK);
        assert_eq!(tracker.update(true, Duration::from_secs(30)), Some(CapsLockChange { on: true, source: ChangeSource::Wake }));
    }

    #[test]
    fn the_change_is_sent_as_on_and_source() {
        let change = CapsLockChange { on: true, source: ChangeSource::Wake };
        assert_eq!(serde_json::to_value(change).unwrap(), serde_json::json!({ "on": true, "source": "wake" }));
    }
}
