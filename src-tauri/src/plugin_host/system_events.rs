use serde_json::json;
use std::{thread, time::Duration};

use super::events::publish_known;
#[cfg(windows)]
use crate::win32::session_notifications::{self, SessionChange};

pub(super) const IDLE_AFTER: Duration = Duration::from_secs(5 * 60);
const IDLE_CHECK_EVERY: Duration = Duration::from_secs(5);
#[cfg(target_os = "macos")]
const SLEPT_AFTER: Duration = Duration::from_secs(30);

#[cfg(windows)]
fn on_change(change: SessionChange) {
    let name = match change {
        SessionChange::Locked => "system.locked",
        SessionChange::Unlocked => "system.unlocked",
        SessionChange::Suspended => "system.suspended",
        SessionChange::Resumed => "system.resumed",
    };
    publish_known(name, json!({}));
}

pub(super) fn idle_transition(idle_for: Duration, was_idle: bool) -> Option<bool> {
    let idle = idle_for >= IDLE_AFTER;
    (idle != was_idle).then_some(idle)
}

#[cfg(target_os = "macos")]
pub(super) fn slept(gap: Duration) -> bool {
    gap >= IDLE_CHECK_EVERY + SLEPT_AFTER
}

#[cfg(target_os = "macos")]
pub(super) fn start() {
    use crate::macos::session;
    use std::time::SystemTime;
    let poller = thread::Builder::new().name("system-events".into()).spawn(|| {
        let (mut was_idle, mut was_locked, mut last) = (false, session::is_locked(), SystemTime::now());
        loop {
            thread::sleep(IDLE_CHECK_EVERY);
            let now = SystemTime::now();
            if now.duration_since(last).is_ok_and(slept) {
                publish_known("system.suspended", json!({}));
                publish_known("system.resumed", json!({}));
            }
            last = now;
            let locked = session::is_locked();
            if locked != was_locked {
                publish_known(if locked { "system.locked" } else { "system.unlocked" }, json!({}));
                was_locked = locked;
            }
            let Some(idle_seconds) = session::idle_seconds() else { continue };
            let idle_for = Duration::from_secs(u64::from(idle_seconds));
            match idle_transition(idle_for, was_idle) {
                Some(true) => publish_known("system.idle", json!({ "idleSeconds": idle_for.as_secs() })),
                Some(false) => publish_known("system.active", json!({})),
                None => continue,
            }
            was_idle = !was_idle;
        }
    });
    if let Err(error) = poller {
        eprintln!("could not watch the session for plugins: {error}");
    }
}

#[cfg(windows)]
pub(super) fn start() {
    let watcher = thread::Builder::new().name("system-events".into()).spawn(|| {
        if let Err(error) = session_notifications::watch(on_change) {
            eprintln!("could not watch the session for plugins: {error}");
        }
    });
    if let Err(error) = watcher {
        eprintln!("could not watch the session for plugins: {error}");
    }
    let poller = thread::Builder::new().name("system-idle".into()).spawn(|| {
        let mut was_idle = false;
        loop {
            thread::sleep(IDLE_CHECK_EVERY);
            let Some(idle_ms) = session_notifications::idle_millis() else { continue };
            let idle_for = Duration::from_millis(u64::from(idle_ms));
            match idle_transition(idle_for, was_idle) {
                Some(true) => publish_known("system.idle", json!({ "idleSeconds": idle_for.as_secs() })),
                Some(false) => publish_known("system.active", json!({})),
                None => continue,
            }
            was_idle = !was_idle;
        }
    });
    if let Err(error) = poller {
        eprintln!("could not watch idle time for plugins: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::{idle_transition, IDLE_AFTER};
    use std::time::Duration;

    #[test]
    fn idle_starts_once_and_ends_with_the_next_input() {
        assert_eq!(idle_transition(Duration::from_secs(10), false), None);
        assert_eq!(idle_transition(IDLE_AFTER, false), Some(true));
        assert_eq!(idle_transition(IDLE_AFTER * 2, true), None, "still idle: told once");
        assert_eq!(idle_transition(Duration::from_secs(1), true), Some(false));
    }
}
