use std::{path::PathBuf, time::Duration};

use tauri::{AppHandle, Monitor, WebviewWindow};

use super::blank;
use crate::win32;

const WGC_WAIT: Duration = Duration::from_millis(800);

pub(super) struct Grab {
    pub(super) origin: (i32, i32),
    pub(super) width: u32,
    pub(super) height: u32,
    pub(super) scale: f64,
    pub(super) rgba: Vec<u8>,
}

pub(super) fn ensure_access() -> Result<(), String> {
    Ok(())
}

pub(super) fn planned(monitor: &Monitor) -> Grab {
    let (position, size) = (monitor.position(), monitor.size());
    Grab { origin: (position.x, position.y), width: size.width, height: size.height, scale: 1.0, rgba: Vec::new() }
}

pub(super) fn monitor(monitor: &Monitor) -> Option<Grab> {
    let (position, size) = (monitor.position(), monitor.size());
    let (x, y, width, height) = (position.x, position.y, size.width, size.height);
    let rgba = blank::pick(
        win32::notification_state::exclusive_fullscreen_in_front(),
        || win32::screen_capture::capture(x, y, width, height),
        || win32::graphics_capture::grab_screen(x, y, width, height, WGC_WAIT),
    )?;
    Some(Grab { origin: (position.x, position.y), width: size.width, height: size.height, scale: 1.0, rgba })
}

pub(super) fn area((x, y, width, height): (i32, i32, u32, u32), _scale: f64) -> Option<(u32, u32, Vec<u8>)> {
    win32::screen_capture::capture(x, y, width, height).map(|rgba| (width, height, rgba))
}

pub(super) fn units_per_css(scale: f64) -> f64 {
    scale
}

pub(super) fn prepare_overlay(_app: &AppHandle, window: &WebviewWindow) {
    let Ok(hwnd) = window.hwnd() else { return };
    if let Err(error) = win32::dwm::disable_transitions(hwnd) {
        eprintln!("screenshot overlay keeps its show/hide animation: {error}");
    }
    if !win32::window::exclude_from_capture(hwnd, true) {
        eprintln!("the screenshot overlay could not be left out of screen captures");
    }
}

pub(super) fn close_overlay(_app: &AppHandle, window: WebviewWindow) {
    if let Err(error) = window.destroy() {
        eprintln!("could not close a screenshot window: {error}");
    }
}

pub(super) fn prepare_pin(window: &WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        let _ = win32::dwm::disable_transitions(hwnd);
    }
}

pub(super) fn drag_file(window: &WebviewWindow, path: PathBuf) -> Result<(), String> {
    window.hwnd().map_err(|error| error.to_string()).and_then(|hwnd| win32::ole::drag_files(hwnd, &[path])).map(|_| ())
}
