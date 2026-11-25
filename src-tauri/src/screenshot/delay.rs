use std::{
    sync::{
        atomic::{AtomicU64, AtomicU8, Ordering},
        Condvar, Mutex, PoisonError,
    },
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::session::{self, Mode};

pub(crate) const STATE_EVENT: &str = "screenshot-delay-state";
pub(crate) const ALLOWED_SECONDS: [u8; 3] = [3, 5, 10];
pub(crate) const DEFAULT_SECONDS: u8 = 3;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DelayState {
    pub active: bool,
    pub remaining: u8,
    pub total: u8,
}

static DEFAULT_DELAY: AtomicU8 = AtomicU8::new(DEFAULT_SECONDS);
static GENERATION: AtomicU64 = AtomicU64::new(0);
static STATE: Mutex<DelayState> = Mutex::new(DelayState { active: false, remaining: 0, total: 0 });
static CANCEL: Condvar = Condvar::new();

pub(crate) fn normalize_seconds(seconds: u8) -> u8 {
    if ALLOWED_SECONDS.contains(&seconds) {
        seconds
    } else {
        DEFAULT_SECONDS
    }
}

pub(crate) fn set_default_seconds(seconds: u8) {
    DEFAULT_DELAY.store(normalize_seconds(seconds), Ordering::SeqCst);
}

pub(crate) fn default_seconds() -> u8 {
    normalize_seconds(DEFAULT_DELAY.load(Ordering::SeqCst))
}

pub(crate) fn status() -> DelayState {
    *STATE.lock().unwrap_or_else(PoisonError::into_inner)
}

fn emit(app: &AppHandle, state: DelayState) {
    let _ = app.emit_to(crate::island::WINDOW_LABEL, STATE_EVENT, state);
}

pub(crate) fn start(app: &AppHandle, seconds: Option<u8>) {
    if session::id().is_some() {
        return;
    }
    let total = normalize_seconds(seconds.unwrap_or_else(default_seconds));
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let initial = DelayState { active: true, remaining: total, total };
    {
        let mut guard = STATE.lock().unwrap_or_else(PoisonError::into_inner);
        *guard = initial;
        CANCEL.notify_all();
    }
    emit(app, initial);
    let app = app.clone();
    thread::spawn(move || run(app, generation, total));
}

pub(crate) fn cancel(app: &AppHandle) -> bool {
    GENERATION.fetch_add(1, Ordering::SeqCst);
    let was_active = {
        let mut guard = STATE.lock().unwrap_or_else(PoisonError::into_inner);
        let active = guard.active;
        *guard = DelayState::default();
        CANCEL.notify_all();
        active
    };
    if was_active {
        emit(app, DelayState::default());
    }
    was_active
}

fn wait_one_second(generation: u64) -> bool {
    let deadline = Instant::now() + Duration::from_secs(1);
    let mut guard = STATE.lock().unwrap_or_else(PoisonError::into_inner);
    loop {
        if GENERATION.load(Ordering::SeqCst) != generation || !guard.active {
            return false;
        }
        let Some(left) = deadline.checked_duration_since(Instant::now()) else {
            return true;
        };
        let (next, _) = CANCEL.wait_timeout(guard, left).unwrap_or_else(PoisonError::into_inner);
        guard = next;
    }
}

fn run(app: AppHandle, generation: u64, total: u8) {
    for step in (1..=total).rev() {
        if !wait_one_second(generation) {
            return;
        }
        if step > 1 {
            let next = DelayState { active: true, remaining: step - 1, total };
            {
                let mut guard = STATE.lock().unwrap_or_else(PoisonError::into_inner);
                if GENERATION.load(Ordering::SeqCst) != generation || !guard.active {
                    return;
                }
                *guard = next;
            }
            emit(&app, next);
        }
    }
    {
        let mut guard = STATE.lock().unwrap_or_else(PoisonError::into_inner);
        if GENERATION.load(Ordering::SeqCst) != generation || !guard.active {
            return;
        }
        *guard = DelayState::default();
    }
    emit(&app, DelayState::default());
    session::start(&app, Mode::Region);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_accepts_only_3_5_10() {
        assert_eq!(normalize_seconds(3), 3);
        assert_eq!(normalize_seconds(5), 5);
        assert_eq!(normalize_seconds(10), 10);
        assert_eq!(normalize_seconds(0), 3);
        assert_eq!(normalize_seconds(7), 3);
        assert_eq!(normalize_seconds(99), 3);
    }

    #[test]
    fn default_delay_round_trips_and_sanitizes() {
        set_default_seconds(5);
        assert_eq!(default_seconds(), 5);
        set_default_seconds(42);
        assert_eq!(default_seconds(), 3);
        set_default_seconds(10);
        assert_eq!(default_seconds(), 10);
        set_default_seconds(3);
    }
}
