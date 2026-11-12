mod tracker;

use std::{
    collections::HashMap,
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant},
};

use tauri::{AppHandle, Emitter};

use crate::island::WINDOW_LABEL;
use crate::win32::{audio_outputs, com::ComApartment, devnode, power};
use tracker::{DeviceAlert, Output, OutputTracker, PowerTracker};

pub(crate) const DEVICE_ALERT_EVENT: &str = "device-alert";

const OUTPUT_POLL: Duration = Duration::from_secs(1);
const BATTERY_POLL: Duration = Duration::from_secs(60);
const POWER_POLL: Duration = Duration::from_secs(2);
const IDLE_POLL: Duration = Duration::from_millis(500);

static ENABLED: AtomicBool = AtomicBool::new(false);

fn read_outputs() -> Vec<Output> {
    let Ok(outputs) = audio_outputs::active_outputs() else {
        return Vec::new();
    };
    outputs
        .into_iter()
        .filter_map(|info| {
            let device = devnode::container_id(&format!(r"SWD\MMDEVAPI\{}", info.id)).map(|guid| format!("{guid:?}"));
            Output::classify(info.id, info.name, info.form_factor, &info.enumerator, device)
        })
        .collect()
}

fn read_batteries() -> HashMap<String, u8> {
    devnode::bluetooth_batteries().into_iter().map(|(guid, level)| (format!("{guid:?}"), level)).collect()
}

fn watch(app: &AppHandle) {
    let Ok(_com) = ComApartment::multithreaded() else {
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
                let source = power::power_source();
                if let Some(alert) = power_tracker.update(source.map(|s| s.plugged_in), source.and_then(|s| s.battery)) {
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
