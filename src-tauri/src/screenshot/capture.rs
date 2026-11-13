use std::path::PathBuf;

use tauri::{AppHandle, Monitor, WebviewWindow};

use crate::win32;

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

pub(super) fn monitor(monitor: &Monitor) -> Option<Grab> {
    let (position, size) = (monitor.position(), monitor.size());
    let rgba = win32::screen_capture::capture(position.x, position.y, size.width, size.height)?;
    Some(Grab { origin: (position.x, position.y), width: size.width, height: size.height, scale: 1.0, rgba })
}

pub(super) fn area((x, y, width, height): (i32, i32, u32, u32), _scale: f64) -> Option<(u32, u32, Vec<u8>)> {
    win32::screen_capture::capture(x, y, width, height).map(|rgba| (width, height, rgba))
}

pub(super) fn units_per_css(scale: f64) -> f64 {
    scale
}

pub(super) fn prepare_overlay(_app: &AppHandle, window: &WebviewWindow) {
    if let Err(error) = window.hwnd().map_err(|error| error.to_string()).and_then(|hwnd| win32::dwm::disable_transitions(hwnd).map_err(|error| error.to_string())) {
        eprintln!("screenshot overlay keeps its show/hide animation: {error}");
    }
}

pub(super) fn prepare_pin(window: &WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        let _ = win32::dwm::disable_transitions(hwnd);
    }
}

pub(super) fn exclude_from_capture(window: &WebviewWindow, on: bool) {
    if let Ok(hwnd) = window.hwnd() {
        win32::window::exclude_from_capture(hwnd, on);
    }
}

pub(super) fn drag_file(window: &WebviewWindow, path: PathBuf) -> Result<(), String> {
    window.hwnd().map_err(|error| error.to_string()).and_then(|hwnd| win32::ole::drag_files(hwnd, &[path])).map(|_| ())
}
