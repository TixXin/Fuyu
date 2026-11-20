use std::{
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use super::session;
use crate::macos::{capture_targets, control_frames, fullscreen::Area};

pub(super) const TARGETS_EVENT: &str = "screenshot-targets";
const WINDOWS_WITH_CONTROLS: usize = 8;
const CONTROLS_PER_WINDOW: usize = 4000;
const BUDGET: Duration = Duration::from_millis(2500);

type Rect = (i32, i32, i32, i32);

#[derive(Clone, Copy, Debug)]
pub(crate) struct Target {
    window: u32,
    element: bool,
    rect: Rect,
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

pub(super) fn windows_on_screen(app: &AppHandle) -> (Vec<Target>, Vec<(u32, i32, Area)>) {
    let mut targets: Vec<Target> = app
        .webview_windows()
        .into_iter()
        .filter(|(label, window)| super::is_capturable_own_window(label) && window.is_visible().unwrap_or(false))
        .filter_map(|(_, window)| {
            let pos = crate::island::screen::window_position(&window).ok()?;
            let size = crate::island::screen::window_size(&window).ok()?;
            (size.width >= 8 && size.height >= 8).then_some(Target {
                window: 0,
                element: false,
                rect: (pos.x, pos.y, pos.x + size.width as i32, pos.y + size.height as i32),
            })
        })
        .collect();
    let own = targets.len();
    let shown = capture_targets::shown_windows();
    targets.extend(shown.iter().map(|window| Target { window: 0, element: false, rect: rounded(window.area) }));
    for (index, target) in targets.iter_mut().enumerate() {
        target.window = index as u32;
    }
    let windows = if control_frames::can_read() {
        shown.into_iter().enumerate().map(|(index, window)| ((own + index) as u32, window.pid, window.area)).collect()
    } else {
        Vec::new()
    };
    (targets, windows)
}

fn rounded(area: Area) -> Rect {
    let (left, top) = (area.x.round() as i32, area.y.round() as i32);
    let (right, bottom) = ((area.x + area.width).round() as i32, (area.y + area.height).round() as i32);
    (left, top, right, bottom)
}

fn intersect(a: Rect, b: Rect) -> Option<Rect> {
    let rect = (a.0.max(b.0), a.1.max(b.1), a.2.min(b.2), a.3.min(b.3));
    (rect.2 > rect.0 && rect.3 > rect.1).then_some(rect)
}

pub(crate) fn localize(targets: &[Target], origin: (i32, i32), size: (u32, u32), scale: f64) -> Vec<LocalTarget> {
    let span = |pixels: u32| (f64::from(pixels) / scale).round() as i32;
    let pixels = |units: i32| (f64::from(units) * scale).round() as i32;
    let monitor = (origin.0, origin.1, origin.0 + span(size.0), origin.1 + span(size.1));
    targets
        .iter()
        .filter_map(|target| {
            let rect = intersect(target.rect, monitor)?;
            Some(LocalTarget {
                window: target.window,
                element: target.element,
                x: pixels(rect.0 - origin.0),
                y: pixels(rect.1 - origin.1),
                width: pixels(rect.2 - rect.0) as u32,
                height: pixels(rect.3 - rect.1) as u32,
            })
        })
        .collect()
}

pub(super) fn read_controls(app: &AppHandle, id: u64, windows: Vec<(u32, i32, Area)>) {
    if windows.is_empty() {
        return;
    }
    let app = app.clone();
    thread::spawn(move || {
        let deadline = Instant::now() + BUDGET;
        for (index, pid, window) in windows.into_iter().take(WINDOWS_WITH_CONTROLS) {
            if Instant::now() >= deadline {
                break;
            }
            let window_rect = rounded(window);
            let controls: Vec<Target> = control_frames::control_frames(pid, window, CONTROLS_PER_WINDOW, deadline)
                .into_iter()
                .filter_map(|frame| intersect(rounded(frame), window_rect))
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
pub(super) fn target(window: u32, element: bool, rect: Rect) -> Target {
    Target { window, element, rect }
}

#[cfg(test)]
mod tests {
    use super::{localize, target};

    #[test]
    fn retina_frames_get_their_targets_in_pixels() {
        let local = localize(&[target(0, false, (100, 50, 400, 250))], (0, 0), (3420, 2214), 2.0);
        let json = serde_json::to_value(local[0]).expect("serializes");
        assert_eq!(json, serde_json::json!({ "window": 0, "element": false, "x": 200, "y": 100, "width": 600, "height": 400 }));
        assert!(localize(&[target(0, false, (1800, 0, 1900, 50))], (0, 0), (3420, 2214), 2.0).is_empty());
    }
}
