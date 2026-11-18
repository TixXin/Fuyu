use std::{
    sync::OnceLock,
    thread::{self, Thread},
    time::{Duration, Instant},
};
use tauri::{Manager, WebviewWindow};

use super::{
    follow::{MonitorFollower, FOLLOW_INTERVAL},
    state::{read_window_state, MonitorFollow},
};

#[cfg(any(target_os = "macos", test))]
const SCREEN_CHECK_INTERVAL: Duration = Duration::from_secs(2);
const STARTUP_WAIT_LIMIT: Duration = Duration::from_secs(60);

static WATCH_THREAD: OnceLock<Thread> = OnceLock::new();
static INTERACTION_READY_AT: OnceLock<Instant> = OnceLock::new();

pub(super) fn wake() {
    if let Some(thread) = WATCH_THREAD.get() {
        thread.unpark();
    }
}

pub(super) fn note_interaction_ready() {
    if INTERACTION_READY_AT.set(Instant::now()).is_ok() {
        wake();
    }
}

fn startup_fallback_delay(debug: bool) -> Duration {
    if debug {
        Duration::from_secs(6)
    } else {
        Duration::from_secs(3)
    }
}

fn startup_fallback_deadline(started_at: Instant, ready_at: Option<Instant>, debug: bool) -> Instant {
    match ready_at {
        Some(ready_at) => ready_at + startup_fallback_delay(debug),
        None => started_at + STARTUP_WAIT_LIMIT,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StartupFallbackAction {
    KeepWaiting,
    Clear,
    RevealNow,
}

fn should_run_startup_fallback(visible: bool, user_hidden: bool) -> bool {
    !visible && !user_hidden
}

fn advance_startup_fallback(
    started_at: Instant,
    ready_at: Option<Instant>,
    now: Instant,
    debug: bool,
    visible: bool,
    user_hidden: bool,
) -> StartupFallbackAction {
    if !should_run_startup_fallback(visible, user_hidden) {
        return StartupFallbackAction::Clear;
    }
    match ready_at {
        Some(ready_at) if now >= ready_at + startup_fallback_delay(debug) => StartupFallbackAction::RevealNow,
        Some(_) => StartupFallbackAction::KeepWaiting,
        None if now >= started_at + STARTUP_WAIT_LIMIT => StartupFallbackAction::Clear,
        None => StartupFallbackAction::KeepWaiting,
    }
}

pub(super) fn next_sleep(
    following: bool,
    follow_interval: Duration,
    remaining_screen: Option<Duration>,
    remaining_beside: Option<Duration>,
    remaining_startup: Option<Duration>,
) -> Option<Duration> {
    let mut wait: Option<Duration> = if following { Some(follow_interval) } else { None };
    for candidate in [remaining_screen, remaining_beside, remaining_startup].into_iter().flatten() {
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
        let debug = cfg!(debug_assertions);
        let mut startup_fallback = Some(start);

        loop {
            let following = !matches!(read_window_state().monitor_follow, MonitorFollow::Primary);
            let now = Instant::now();
            #[cfg(target_os = "macos")]
            let screen_wait = Some(remaining_until(next_screen, now));
            #[cfg(not(target_os = "macos"))]
            let screen_wait: Option<Duration> = None;
            let beside_wait = next_beside.map(|deadline| remaining_until(deadline, now));
            let startup_wait = startup_fallback.map(|started_at| {
                remaining_until(
                    startup_fallback_deadline(started_at, INTERACTION_READY_AT.get().copied(), debug),
                    now,
                )
            });

            match next_sleep(following, FOLLOW_INTERVAL, screen_wait, beside_wait, startup_wait) {
                Some(wait) if !wait.is_zero() => thread::park_timeout(wait),
                Some(_) => {}
                None => thread::park(),
            }

            let now = Instant::now();
            if let Some(started_at) = startup_fallback {
                match advance_startup_fallback(
                    started_at,
                    INTERACTION_READY_AT.get().copied(),
                    now,
                    debug,
                    window.is_visible().unwrap_or(true),
                    super::user_hidden(),
                ) {
                    StartupFallbackAction::KeepWaiting => {}
                    StartupFallbackAction::Clear => startup_fallback = None,
                    StartupFallbackAction::RevealNow => {
                        startup_fallback = None;
                        let _ = super::show_island_without_focus(window.app_handle());
                    }
                }
            }

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
        assert_eq!(next_sleep(false, FOLLOW_INTERVAL, None, None, None), None);
    }

    #[test]
    fn primary_mode_sleeps_until_nearest_periodic_deadline() {
        assert_eq!(
            next_sleep(false, FOLLOW_INTERVAL, Some(SCREEN_CHECK_INTERVAL), Some(Duration::from_secs(3)), None),
            Some(SCREEN_CHECK_INTERVAL),
        );
        assert_eq!(
            next_sleep(false, FOLLOW_INTERVAL, Some(SCREEN_CHECK_INTERVAL), Some(Duration::from_millis(850)), None),
            Some(Duration::from_millis(850)),
        );
        assert_eq!(
            next_sleep(false, FOLLOW_INTERVAL, None, None, Some(Duration::from_secs(3))),
            Some(Duration::from_secs(3)),
        );
        assert_eq!(
            next_sleep(
                false,
                FOLLOW_INTERVAL,
                Some(SCREEN_CHECK_INTERVAL),
                None,
                Some(Duration::from_millis(400)),
            ),
            Some(Duration::from_millis(400)),
        );
    }

    #[test]
    fn following_mode_caps_sleep_at_follow_interval_unless_deadline_is_sooner() {
        assert_eq!(
            next_sleep(true, FOLLOW_INTERVAL, Some(SCREEN_CHECK_INTERVAL), None, None),
            Some(FOLLOW_INTERVAL),
        );
        assert_eq!(
            next_sleep(true, FOLLOW_INTERVAL, Some(Duration::from_millis(120)), None, None),
            Some(Duration::from_millis(120)),
        );
        assert_eq!(
            next_sleep(true, FOLLOW_INTERVAL, None, None, Some(Duration::from_millis(90))),
            Some(Duration::from_millis(90)),
        );
    }

    #[test]
    fn startup_fallback_waits_for_mounted_interaction_and_never_reveals_unmounted_stage() {
        assert_eq!(startup_fallback_delay(true), Duration::from_secs(6));
        assert_eq!(startup_fallback_delay(false), Duration::from_secs(3));

        assert!(should_run_startup_fallback(false, false));
        assert!(!should_run_startup_fallback(true, false));
        assert!(!should_run_startup_fallback(false, true));
        assert!(!should_run_startup_fallback(true, true));

        let start = Instant::now();
        let unmounted_at_10s = start + Duration::from_secs(10);
        let unmounted_at_limit = start + STARTUP_WAIT_LIMIT;
        assert_eq!(startup_fallback_deadline(start, None, true), unmounted_at_limit);
        assert_eq!(
            advance_startup_fallback(start, None, unmounted_at_10s, false, false, false),
            StartupFallbackAction::KeepWaiting,
        );
        assert_eq!(
            advance_startup_fallback(start, None, unmounted_at_limit, false, false, false),
            StartupFallbackAction::Clear,
        );

        let ready = start + Duration::from_secs(8);
        let before_delay = ready + Duration::from_secs(2);
        let at_release_delay = ready + Duration::from_secs(3);
        let at_debug_delay = ready + Duration::from_secs(6);

        assert_eq!(startup_fallback_deadline(start, Some(ready), false), at_release_delay);
        assert_eq!(startup_fallback_deadline(start, Some(ready), true), at_debug_delay);
        assert_eq!(
            advance_startup_fallback(start, Some(ready), before_delay, false, false, false),
            StartupFallbackAction::KeepWaiting,
        );
        assert_eq!(
            advance_startup_fallback(start, Some(ready), at_release_delay, false, false, false),
            StartupFallbackAction::RevealNow,
        );
        assert_eq!(
            advance_startup_fallback(start, Some(ready), at_release_delay, true, false, false),
            StartupFallbackAction::KeepWaiting,
        );
        assert_eq!(
            advance_startup_fallback(start, Some(ready), at_debug_delay, true, false, false),
            StartupFallbackAction::RevealNow,
        );
        assert_eq!(
            advance_startup_fallback(start, Some(ready), at_release_delay, false, true, false),
            StartupFallbackAction::Clear,
        );
        assert_eq!(
            advance_startup_fallback(start, Some(ready), at_release_delay, false, false, true),
            StartupFallbackAction::Clear,
        );
    }
}
