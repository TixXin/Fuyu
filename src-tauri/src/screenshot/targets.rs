use std::{thread, time::Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::{HWND, RECT};

use super::session;
use crate::win32::capture_targets;

pub(super) const TARGETS_EVENT: &str = "screenshot-targets";
const WINDOWS_WITH_CONTROLS: usize = 8;
const CONTROLS_PER_WINDOW: usize = 4000;
const BUDGET_MS: u128 = 2500;

#[derive(Clone, Copy, Debug)]
pub(crate) struct Target {
    window: u32,
    element: bool,
    rect: RECT,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LocalTarget {
    window: u32,
    element: bool,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

pub(super) fn windows_on_screen() -> (Vec<Target>, Vec<(u32, isize, RECT)>) {
    let shown = capture_targets::shown_windows();
    let targets = shown
        .iter()
        .enumerate()
        .map(|(index, window)| Target { window: index as u32, element: false, rect: window.rect })
        .collect();
    let handles = shown
        .iter()
        .enumerate()
        .map(|(index, window)| (index as u32, window.handle.0 as isize, window.rect))
        .collect();
    (targets, handles)
}

fn intersect(a: RECT, b: RECT) -> Option<RECT> {
    let rect = RECT { left: a.left.max(b.left), top: a.top.max(b.top), right: a.right.min(b.right), bottom: a.bottom.min(b.bottom) };
    (rect.right > rect.left && rect.bottom > rect.top).then_some(rect)
}

pub(crate) fn localize(targets: &[Target], origin: (i32, i32), size: (u32, u32), scale: f64) -> Vec<LocalTarget> {
    let span = |pixels: u32| if scale == 1.0 { pixels as i32 } else { (f64::from(pixels) / scale).round() as i32 };
    let pixels = |units: i32| if scale == 1.0 { units } else { (f64::from(units) * scale).round() as i32 };
    let monitor = RECT { left: origin.0, top: origin.1, right: origin.0 + span(size.0), bottom: origin.1 + span(size.1) };
    targets
        .iter()
        .filter_map(|target| {
            let rect = intersect(target.rect, monitor)?;
            Some(LocalTarget {
                window: target.window,
                element: target.element,
                x: pixels(rect.left - origin.0),
                y: pixels(rect.top - origin.1),
                width: pixels(rect.right - rect.left) as u32,
                height: pixels(rect.bottom - rect.top) as u32,
            })
        })
        .collect()
}

pub(super) fn read_controls(app: &AppHandle, id: u64, windows: Vec<(u32, isize, RECT)>) {
    let app = app.clone();
    thread::spawn(move || {
        let started = Instant::now();
        for (index, handle, window_rect) in windows.into_iter().take(WINDOWS_WITH_CONTROLS) {
            if started.elapsed().as_millis() > BUDGET_MS {
                break;
            }
            let controls: Vec<Target> = capture_targets::control_rects(HWND(handle as *mut core::ffi::c_void), CONTROLS_PER_WINDOW)
                .into_iter()
                .filter_map(|rect| intersect(rect, window_rect))
                .map(|rect| Target { window: index, element: true, rect })
                .collect();
            if controls.is_empty() {
                continue;
            }
            match session::add_targets(id, controls) {
                Some(labels) => {
                    for label in labels {
                        let _ = app.emit_to(label.as_str(), TARGETS_EVENT, id);
                    }
                }
                None => return,
            }
        }
    });
}

#[cfg(test)]
pub(super) fn target(window: u32, element: bool, rect: (i32, i32, i32, i32)) -> Target {
    Target { window, element, rect: RECT { left: rect.0, top: rect.1, right: rect.2, bottom: rect.3 } }
}
