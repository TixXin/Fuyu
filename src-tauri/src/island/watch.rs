use std::{
    sync::OnceLock,
    thread::{self, Thread},
    time::{Duration, Instant},
};
use tauri::WebviewWindow;

use super::{
    follow::{MonitorFollower, FOLLOW_INTERVAL},
    state::{read_window_state, MonitorFollow},
};

#[cfg(any(target_os = "macos", test))]
const SCREEN_CHECK_INTERVAL: Duration = Duration::from_secs(2);

static WATCH_THREAD: OnceLock<Thread> = OnceLock::new();

pub(super) fn wake() {
    if let Some(thread) = WATCH_THREAD.get() {
        thread.unpark();
    }
}

pub(super) fn next_sleep(
    following: bool,
    follow_interval: Duration,
    remaining_screen: Option<Duration>,
    remaining_beside: Option<Duration>,
) -> Option<Duration> {
    let mut wait: Option<Duration> = if following { Some(follow_interval) } else { None };
    for candidate in [remaining_screen, remaining_beside].into_iter().flatten() {
        wait = Some(wait.map_or(candidate, |current| current.min(candidate)));
    }
    wait
}

fn remaining_until(deadline: Instant, now: Instant) -> Duration {
    deadline.saturating_duration_since(now)
}

pub(crate) fn start_window_watch(window: WebviewWindow) {
    let _ = thread::Builder::new().name("island-watch".into()).spawn(move || {
        let _ = WATCH_THREAD.set(thread::current());
        let mut follower = MonitorFollower::default();
        #[cfg(target_os = "macos")]
        let mut screens = super::screen_watch::ScreenWatcher::new(&window);
        let start = Instant::now();
        #[cfg(target_os = "macos")]
        let mut next_screen = start + SCREEN_CHECK_INTERVAL;
        let mut next_beside = crate::dev_lane::watches_installed_island()
            .then_some(start + crate::dev_lane::BESIDE_LOOK_EVERY);

        loop {
            let following = !matches!(read_window_state().monitor_follow, MonitorFollow::Primary);
            let now = Instant::now();
            #[cfg(target_os = "macos")]
            let screen_wait = Some(remaining_until(next_screen, now));
            #[cfg(not(target_os = "macos"))]
            let screen_wait: Option<Duration> = None;
            let beside_wait = next_beside.map(|deadline| remaining_until(deadline, now));

            match next_sleep(following, FOLLOW_INTERVAL, screen_wait, beside_wait) {
                Some(wait) if !wait.is_zero() => thread::park_timeout(wait),
                Some(_) => {}
                None => thread::park(),
            }

            let now = Instant::now();
            if matches!(read_window_state().monitor_follow, MonitorFollow::Primary) {
                follower.reset();
            } else {
                follower.poll(&window);
            }

            #[cfg(target_os = "macos")]
            if now >= next_screen {
                crate::macos::island_panel::refresh_top_space(&window);
                screens.poll(&window);
                next_screen = Instant::now() + SCREEN_CHECK_INTERVAL;
            }

            if let Some(deadline) = next_beside {
                if now >= deadline {
                    crate::dev_lane::poll_installed_island(&window);
                    next_beside = Some(Instant::now() + crate::dev_lane::BESIDE_LOOK_EVERY);
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn primary_mode_parks_indefinitely_when_no_periodic_checks_are_enabled() {
        assert_eq!(next_sleep(false, FOLLOW_INTERVAL, None, None), None);
    }

    #[test]
    fn primary_mode_sleeps_until_nearest_periodic_deadline() {
        assert_eq!(
            next_sleep(false, FOLLOW_INTERVAL, Some(SCREEN_CHECK_INTERVAL), Some(Duration::from_secs(3))),
            Some(SCREEN_CHECK_INTERVAL),
        );
        assert_eq!(
            next_sleep(false, FOLLOW_INTERVAL, Some(SCREEN_CHECK_INTERVAL), Some(Duration::from_millis(850))),
            Some(Duration::from_millis(850)),
        );
    }

    #[test]
    fn following_mode_caps_sleep_at_follow_interval_unless_deadline_is_sooner() {
        assert_eq!(
            next_sleep(true, FOLLOW_INTERVAL, Some(SCREEN_CHECK_INTERVAL), None),
            Some(FOLLOW_INTERVAL),
        );
        assert_eq!(
            next_sleep(true, FOLLOW_INTERVAL, Some(Duration::from_millis(120)), None),
            Some(Duration::from_millis(120)),
        );
    }
}
