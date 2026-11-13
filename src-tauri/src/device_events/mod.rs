mod readers;
mod tracker;

use std::{
    collections::HashMap,
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant},
};

use tauri::{AppHandle, Emitter};

use crate::island::WINDOW_LABEL;
use readers::{power_source, read_batteries, read_outputs, start_thread};
use tracker::{DeviceAlert, OutputTracker, PowerTracker};

pub(crate) const DEVICE_ALERT_EVENT: &str = "device-alert";

const OUTPUT_POLL: Duration = Duration::from_secs(1);
const BATTERY_POLL: Duration = Duration::from_secs(60);
const POWER_POLL: Duration = Duration::from_secs(2);
const IDLE_POLL: Duration = Duration::from_millis(500);

static ENABLED: AtomicBool = AtomicBool::new(false);

fn watch(app: &AppHandle) {
    let Some(_thread) = start_thread() else {
        return;
    };
    let emit = |alert: DeviceAlert| {
        let _ = app.emit_to(WINDOW_LABEL, DEVICE_ALERT_EVENT, alert);
    };
    let mut outputs = OutputTracker::default();
    let mut power_tracker = PowerTracker::default();
    loop {
        if !ENABLED.load(Ordering::Relaxed) {
            outputs.reset();
            power_tracker.reset();
            thread::sleep(IDLE_POLL);
            continue;
        }
        let mut batteries = HashMap::new();
        let mut batteries_read: Option<Instant> = None;
        let mut power_read: Option<Instant> = None;
        while ENABLED.load(Ordering::Relaxed) {
            let current = read_outputs();
            let has_bluetooth = current.iter().any(|output| output.bluetooth);
            let battery_due = batteries_read.is_none_or(|at| at.elapsed() >= BATTERY_POLL);
            if outputs.wants_batteries() || (has_bluetooth && battery_due) {
                batteries = read_batteries();
                batteries_read = Some(Instant::now());
            }
            for alert in outputs.update(current, &batteries) {
                emit(alert);
            }
            if power_read.is_none_or(|at| at.elapsed() >= POWER_POLL) {
                power_read = Some(Instant::now());
                let (plugged_in, battery) = power_source();
                if let Some(alert) = power_tracker.update(plugged_in, battery) {
                    emit(alert);
                }
            }
            thread::sleep(OUTPUT_POLL);
        }
    }
}

pub(crate) fn init(app: &AppHandle) {
    let app = app.clone();
    let started = thread::Builder::new().name("device-events".into()).spawn(move || watch(&app));
    if let Err(error) = started {
        eprintln!("failed to start the device watcher: {error}");
    }
}

#[tauri::command]
pub fn set_device_alerts_enabled(enabled: bool) {
    ENABLED.store(enabled, Ordering::Relaxed);
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::device_events::set_device_alerts_enabled,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests;
