#[cfg_attr(target_os = "macos", path = "readers_macos.rs")]
mod readers;

use std::{
    sync::{Arc, Mutex, PoisonError},
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::island::WINDOW_LABEL;
use crate::plugin_kernel::{
    builtins,
    worker::{Stop, Worker},
};
use readers::{brightness_percent, open_brightness, open_volume, start_thread, volume_reading, OutputVolume};

pub(crate) const LEVEL_CHANGED_EVENT: &str = "system-level-changed";
const PLUGIN_ID: &str = "system-levels";
const WATCHER: &str = "watcher";

const VOLUME_POLL: Duration = Duration::from_millis(100);
const BRIGHTNESS_POLL: Duration = Duration::from_millis(400);
const DEVICE_REFRESH: Duration = Duration::from_secs(5);
const BRIGHTNESS_RETRY: Duration = Duration::from_secs(60);

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

fn watch(app: &AppHandle, stop: &Stop) {
    let Some(_thread) = start_thread() else {
        return;
    };
    let emit = |change: LevelChange| {
        let _ = app.emit_to(WINDOW_LABEL, LEVEL_CHANGED_EVENT, change);
    };
    let volume_tracker = Arc::new(Mutex::new(LevelTracker::default()));
    let mut brightness_tracker = LevelTracker::default();
    let mut volume: Option<OutputVolume> = None;
    let mut volume_opened = Instant::now() - DEVICE_REFRESH;
    let brightness = open_brightness();
    let mut brightness_read = Instant::now() - BRIGHTNESS_POLL;
    let mut has_brightness = true;
    loop {
        if volume_opened.elapsed() >= DEVICE_REFRESH {
            let tracker = Arc::clone(&volume_tracker);
            let handle = app.clone();
            let next_volume = open_volume(move |percent, muted| {
                let changed = tracker
                    .lock()
                    .unwrap_or_else(PoisonError::into_inner)
                    .changed((percent, muted));
                if changed {
                    let _ = handle.emit_to(
                        WINDOW_LABEL,
                        LEVEL_CHANGED_EVENT,
                        LevelChange::Volume { level: percent as f32 / 100.0, muted },
                    );
                }
            });
            let initial = next_volume.as_ref().and_then(volume_reading);
            {
                let mut guard = volume_tracker.lock().unwrap_or_else(PoisonError::into_inner);
                guard.reset();
                if let Some(reading) = initial {
                    let _ = guard.changed(reading);
                }
            }
            volume = next_volume;
            volume_opened = Instant::now();
        }
        let subscribed = volume.as_ref().is_some_and(OutputVolume::is_subscribed);
        if !subscribed {
            if let Some((percent, muted)) = volume.as_ref().and_then(volume_reading) {
                let changed = volume_tracker
                    .lock()
                    .unwrap_or_else(PoisonError::into_inner)
                    .changed((percent, muted));
                if changed {
                    emit(LevelChange::Volume { level: percent as f32 / 100.0, muted });
                }
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
        let sleep_for = if subscribed {
            wait.min(DEVICE_REFRESH)
        } else {
            VOLUME_POLL
        };
        if stop.wait(sleep_for) {
            return;
        }
    }
}

pub(crate) fn init(app: &AppHandle) {
    let app = app.clone();
    let watcher = Worker::new("system-levels", move |stop| watch(&app, &stop));
    if let Err(error) = builtins::register(PLUGIN_ID, WATCHER, Arc::new(watcher)) {
        eprintln!("[plugins-v3] {error}");
    }
}

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

    #[test]
    fn the_watcher_is_the_background_listed_for_system_levels() {
        let catalog = crate::plugin_kernel::builtins::catalog();
        let plugin = catalog.iter().find(|plugin| plugin.id == PLUGIN_ID).expect("system-levels is a built-in plugin");
        assert_eq!(plugin.background.as_deref(), Some(&[WATCHER.to_owned()][..]));
    }
}
