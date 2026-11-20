use std::{collections::VecDeque, time::Instant};

use objc2_core_foundation::CGRect;

use super::accessibility::{self, Element};
use super::fullscreen::Area;

const MESSAGING_TIMEOUT_SECONDS: f32 = 0.15;
const MATCH_TOLERANCE: f64 = 2.0;
const MIN_SIDE: f64 = 4.0;

pub(crate) fn can_read() -> bool {
    accessibility::is_trusted()
}

pub(crate) fn control_frames(pid: i32, window: Area, limit: usize, deadline: Instant) -> Vec<Area> {
    if !can_read() {
        return Vec::new();
    }
    let Some(app) = Element::application_with_timeout(pid, MESSAGING_TIMEOUT_SECONDS) else {
        return Vec::new();
    };
    let Some(root) = app.windows().into_iter().find(|candidate| candidate.frame().map(area).is_some_and(|frame| same(frame, window)))
    else {
        return Vec::new();
    };
    let mut frames = Vec::new();
    let mut queue: VecDeque<Element> = root.children().into();
    while let Some(element) = queue.pop_front() {
        if frames.len() >= limit || Instant::now() >= deadline {
            break;
        }
        match element.frame().map(area) {
            Some(frame) if !overlaps(frame, window) => continue,
            Some(frame) if frame.width >= MIN_SIDE && frame.height >= MIN_SIDE && !same(frame, window) => frames.push(frame),
            _ => {}
        }
        queue.extend(element.children());
    }
    frames
}

fn area(rect: CGRect) -> Area {
    Area { x: rect.origin.x, y: rect.origin.y, width: rect.size.width, height: rect.size.height }
}

fn same(a: Area, b: Area) -> bool {
    let close = |x: f64, y: f64| (x - y).abs() <= MATCH_TOLERANCE;
    close(a.x, b.x) && close(a.y, b.y) && close(a.width, b.width) && close(a.height, b.height)
}

fn overlaps(a: Area, b: Area) -> bool {
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

#[cfg(test)]
mod tests {
    use super::{overlaps, same, Area};

    fn rect(x: f64, y: f64, width: f64, height: f64) -> Area {
        Area { x, y, width, height }
    }

    #[test]
    fn windows_match_within_a_couple_of_points() {
        assert!(same(rect(100.0, 50.0, 800.0, 600.0), rect(101.0, 49.0, 801.5, 600.0)));
        assert!(!same(rect(100.0, 50.0, 800.0, 600.0), rect(100.0, 50.0, 790.0, 600.0)));
    }

    #[test]
    fn scrolled_out_controls_do_not_overlap_the_window() {
        let window = rect(0.0, 0.0, 500.0, 400.0);
        assert!(overlaps(rect(10.0, 10.0, 50.0, 20.0), window));
        assert!(!overlaps(rect(10.0, 400.0, 50.0, 20.0), window));
        assert!(!overlaps(rect(-60.0, 10.0, 50.0, 20.0), window));
    }
}

#[cfg(test)]
mod probe {
    use std::time::{Duration, Instant};

    #[test]
    #[ignore = "reads the real desktop and needs the Accessibility permission"]
    fn reads_controls_of_the_windows_on_screen() {
        println!("trusted: {}", super::can_read());
        for window in crate::macos::capture_targets::shown_windows().into_iter().take(8) {
            let started = Instant::now();
            let frames = super::control_frames(window.pid, window.area, 4000, Instant::now() + Duration::from_millis(2500));
            println!("pid {} {:?}: {} controls in {:?}", window.pid, window.area, frames.len(), started.elapsed());
        }
    }
}
