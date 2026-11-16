#[cfg_attr(target_os = "macos", path = "readers_macos.rs")]
mod readers;
mod peripherals;
mod tracker;

use std::{collections::HashMap, sync::Arc, time::{Duration, Instant}};

use tauri::{AppHandle, Emitter};

use crate::island::WINDOW_LABEL;
use crate::plugin_kernel::{
    builtins,
    worker::{Stop, Worker},
};
use peripherals::PeripheralTracker;
use readers::{power_source, read_batteries, read_outputs, read_peripherals, start_thread};
use tracker::{DeviceAlert, OutputTracker, PowerTracker};

pub(crate) const DEVICE_ALERT_EVENT: &str = "device-alert";
const PLUGIN_ID: &str = "device-events";
const WATCHER: &str = "watcher";

const OUTPUT_POLL: Duration = Duration::from_secs(1);
const BATTERY_POLL: Duration = Duration::from_secs(60);
const POWER_POLL: Duration = Duration::from_secs(2);
const PERIPHERAL_POLL: Duration = Duration::from_secs(15);

fn watch(app: &AppHandle, stop: &Stop) {
    let Some(_thread) = start_thread() else {
        return;
    };
    let emit = |alert: DeviceAlert| {
        let _ = app.emit_to(WINDOW_LABEL, DEVICE_ALERT_EVENT, alert);
    };
    let mut outputs = OutputTracker::default();
    let mut power_tracker = PowerTracker::default();
    let mut peripheral_tracker = PeripheralTracker::default();
    let mut batteries = HashMap::new();
    let mut batteries_read: Option<Instant> = None;
    let mut power_read: Option<Instant> = None;
    let mut peripherals_read: Option<Instant> = None;
    loop {
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
        if peripherals_read.is_none_or(|at| at.elapsed() >= PERIPHERAL_POLL) {
            peripherals_read = Some(Instant::now());
            for alert in peripheral_tracker.update(read_peripherals()) {
                emit(alert);
            }
        }
        if stop.wait(OUTPUT_POLL) {
            return;
        }
    }
}

pub(crate) fn init(app: &AppHandle) {
    let app = app.clone();
    let watcher = Worker::new("device-events", move |stop| watch(&app, &stop));
    if let Err(error) = builtins::register(PLUGIN_ID, WATCHER, Arc::new(watcher)) {
        eprintln!("[plugins-v3] {error}");
    }
}

#[cfg(test)]
mod tests;
