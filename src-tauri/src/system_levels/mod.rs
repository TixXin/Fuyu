mod readers;

use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::island::WINDOW_LABEL;
use readers::{brightness_percent, open_brightness, open_volume, start_thread, volume_reading, OutputVolume};

pub(crate) const LEVEL_CHANGED_EVENT: &str = "system-level-changed";

const VOLUME_POLL: Duration = Duration::from_millis(100);
const BRIGHTNESS_POLL: Duration = Duration::from_millis(400);
const DEVICE_REFRESH: Duration = Duration::from_secs(2);
const BRIGHTNESS_RETRY: Duration = Duration::from_secs(60);
const IDLE_POLL: Duration = Duration::from_millis(500);

static ENABLED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub(crate) enum LevelChange {
    Volume { level: f32, muted: bool },
    Brightness { level: f32 },
}

#[derive(Debug, Default)]
pub(crate) struct LevelTracker<T> {
    last: Option<T>,
}

impl<T: PartialEq + Copy> LevelTracker<T> {
    pub(crate) fn changed(&mut self, reading: T) -> bool {
        let changed = self.last.is_some_and(|last| last != reading);
        self.last = Some(reading);
        changed
    }

    pub(crate) fn reset(&mut self) {
        self.last = None;
    }
}

fn watch(app: &AppHandle) {
    let Some(_thread) = start_thread() else {
        return;
    };
    let emit = |change: LevelChange| {
        let _ = app.emit_to(WINDOW_LABEL, LEVEL_CHANGED_EVENT, change);
    };
    let mut volume_tracker = LevelTracker::default();
    let mut brightness_tracker = LevelTracker::default();
    loop {
        if !ENABLED.load(Ordering::Relaxed) {
            volume_tracker.reset();
            brightness_tracker.reset();
            thread::sleep(IDLE_POLL);
            continue;
        }
        let mut volume: Option<OutputVolume> = None;
        let mut volume_opened = Instant::now() - DEVICE_REFRESH;
        let brightness = open_brightness();
        let mut brightness_read = Instant::now() - BRIGHTNESS_POLL;
        let mut has_brightness = true;
        while ENABLED.load(Ordering::Relaxed) {
            if volume_opened.elapsed() >= DEVICE_REFRESH {
                volume = open_volume();
                volume_opened = Instant::now();
                volume_tracker.reset();
            }
            if let Some((percent, muted)) = volume.as_ref().and_then(volume_reading) {
                if volume_tracker.changed((percent, muted)) {
                    emit(LevelChange::Volume { level: percent as f32 / 100.0, muted });
                }
            }
            let wait = if has_brightness { BRIGHTNESS_POLL } else { BRIGHTNESS_RETRY };
            if brightness_read.elapsed() >= wait {
                brightness_read = Instant::now();
                let percent = brightness.as_ref().and_then(brightness_percent);
                has_brightness = percent.is_some();
                if let Some(percent) = percent.filter(|&percent| brightness_tracker.changed(percent)) {
                    emit(LevelChange::Brightness { level: percent as f32 / 100.0 });
                }
            }
            thread::sleep(VOLUME_POLL);
        }
    }
}

pub(crate) fn init(app: &AppHandle) {
    let app = app.clone();
    let started = thread::Builder::new().name("system-levels".into()).spawn(move || watch(&app));
    if let Err(error) = started {
        eprintln!("failed to start the volume and brightness watcher: {error}");
    }
}

#[tauri::command]
pub fn set_level_popup_enabled(enabled: bool) {
    ENABLED.store(enabled, Ordering::Relaxed);
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::system_levels::set_level_popup_enabled,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_first_reading_is_a_starting_point_and_later_ones_are_changes() {
        let mut tracker = LevelTracker::default();
        assert!(!tracker.changed((40, false)));
        assert!(!tracker.changed((40, false)));
        assert!(tracker.changed((42, false)));
        assert!(tracker.changed((42, true)));
        tracker.reset();
        assert!(!tracker.changed((10, false)));
    }

    #[test]
    fn changes_reach_the_island_as_tagged_json() {
        let volume = serde_json::to_value(LevelChange::Volume { level: 0.5, muted: true }).unwrap();
        assert_eq!(volume, serde_json::json!({ "kind": "volume", "level": 0.5, "muted": true }));
        let brightness = serde_json::to_value(LevelChange::Brightness { level: 0.25 }).unwrap();
        assert_eq!(brightness, serde_json::json!({ "kind": "brightness", "level": 0.25 }));
    }
}
