use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Mutex, PoisonError,
    },
    time::Duration,
};

use tauri::{AppHandle, Monitor, WebviewWindow};

use crate::island::screen;
use crate::macos::{
    island_panel,
    screen_capture::{self, Leave},
};

const PRIVACY_PAGE: &str = "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";
const PANEL_WAIT: Duration = Duration::from_secs(2);

static ASKED: AtomicBool = AtomicBool::new(false);
static OVERLAYS: Mutex<Vec<u32>> = Mutex::new(Vec::new());

pub(super) struct Grab {
    pub(super) origin: (i32, i32),
    pub(super) width: u32,
    pub(super) height: u32,
    pub(super) scale: f64,
    pub(super) rgba: Vec<u8>,
}

pub(super) fn ensure_access() -> Result<(), String> {
    if screen_capture::has_access() {
        return Ok(());
    }
    if ASKED.swap(true, Ordering::SeqCst) {
        let _ = tauri_plugin_opener::open_url(PRIVACY_PAGE, None::<&str>);
    } else {
        screen_capture::ask_for_access();
    }
    Err("Screenshots need the Screen Recording permission in System Settings → Privacy & Security.".to_string())
}

pub(super) fn planned(monitor: &Monitor) -> Grab {
    let origin = screen::monitor_origin(monitor);
    let size = screen::monitor_size(monitor);
    let pixels = |points: u32| (f64::from(points) * monitor.scale_factor()).round().max(1.0) as u32;
    let width = pixels(size.width);
    let scale = f64::from(width) / f64::from(size.width.max(1));
    Grab { origin: (origin.x, origin.y), width, height: pixels(size.height), scale, rgba: Vec::new() }
}

pub(super) fn monitor(monitor: &Monitor) -> Option<Grab> {
    let origin = screen::monitor_origin(monitor);
    let size = screen::monitor_size(monitor);
    let rect = (f64::from(origin.x), f64::from(origin.y), f64::from(size.width), f64::from(size.height));
    let overlays = OVERLAYS.lock().unwrap_or_else(PoisonError::into_inner).clone();
    let shot = screen_capture::capture(rect, monitor.scale_factor(), Leave::Windows(overlays))?;
    let scale = f64::from(shot.width) / f64::from(size.width.max(1));
    Some(Grab { origin: (origin.x, origin.y), width: shot.width, height: shot.height, scale, rgba: shot.rgba })
}

pub(super) fn area((x, y, width, height): (i32, i32, u32, u32), scale: f64) -> Option<(u32, u32, Vec<u8>)> {
    let rect = (f64::from(x), f64::from(y), f64::from(width), f64::from(height));
    screen_capture::capture(rect, scale, Leave::OwnWindows).map(|shot| (shot.width, shot.height, shot.rgba))
}

pub(super) fn units_per_css(_scale: f64) -> f64 {
    1.0
}

pub(super) fn prepare_overlay(app: &AppHandle, window: &WebviewWindow) {
    let (sender, receiver) = mpsc::channel();
    let target = window.clone();
    let queued = app.run_on_main_thread(move || {
        let _ = sender.send(island_panel::make_overlay_panel(&target));
    });
    let result = queued.map_err(|error| error.to_string()).and_then(|()| receiver.recv_timeout(PANEL_WAIT).map_err(|error| error.to_string()).and_then(|made| made));
    match result {
        Ok(number) => OVERLAYS.lock().unwrap_or_else(PoisonError::into_inner).push(number),
        Err(error) => eprintln!("the screenshot overlay stays a normal window: {error}"),
    }
}

pub(super) fn prepare_pin(_window: &WebviewWindow) {}

pub(super) fn drag_file(window: &WebviewWindow, path: PathBuf) -> Result<(), String> {
    let image = std::fs::read(&path).map_err(|error| format!("Failed to read {}: {error}", path.display()))?;
    drag::start_drag(window, drag::DragItem::Files(vec![path]), drag::Image::Raw(image), |_, _| {}, drag::Options::default())
        .map_err(|error| format!("Failed to start the drag: {error}"))
}
