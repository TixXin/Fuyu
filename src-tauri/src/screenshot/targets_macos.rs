use serde::Serialize;
use tauri::AppHandle;

use crate::macos::capture_targets;

pub(super) const TARGETS_EVENT: &str = "screenshot-targets";

#[derive(Clone, Copy, Debug)]
pub(crate) struct Target {
    window: u32,
    element: bool,
    rect: (i32, i32, i32, i32),
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

pub(super) fn windows_on_screen() -> (Vec<Target>, Vec<()>) {
    let targets = capture_targets::shown_windows()
        .into_iter()
        .enumerate()
        .map(|(index, area)| {
            let (left, top) = (area.x.round() as i32, area.y.round() as i32);
            let (right, bottom) = ((area.x + area.width).round() as i32, (area.y + area.height).round() as i32);
            Target { window: index as u32, element: false, rect: (left, top, right, bottom) }
        })
        .collect();
    (targets, Vec::new())
}

fn intersect(a: (i32, i32, i32, i32), b: (i32, i32, i32, i32)) -> Option<(i32, i32, i32, i32)> {
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

pub(super) fn read_controls(_app: &AppHandle, _id: u64, _windows: Vec<()>) {}

#[cfg(test)]
pub(super) fn target(window: u32, element: bool, rect: (i32, i32, i32, i32)) -> Target {
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
