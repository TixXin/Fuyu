use std::{thread, time::Duration};
use tauri::{Monitor, WebviewWindow};

use super::state::read_window_state;
use crate::macos::notch::{read_notches, ScreenNotch};

const POLL_INTERVAL: Duration = Duration::from_secs(2);

#[derive(Debug, Clone, Copy, PartialEq)]
pub(super) struct Display {
    frame: (i32, i32, u32, u32),
    visible: (i32, i32, u32, u32),
    scale: f64,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub(super) struct Screens {
    displays: Vec<Display>,
    notches: Vec<ScreenNotch>,
}

impl Screens {
    pub(super) fn new(mut displays: Vec<Display>, mut notches: Vec<ScreenNotch>) -> Self {
        displays.sort_by_key(|display| (display.frame.0, display.frame.1));
        notches.sort_by(|a, b| a.screen_left.total_cmp(&b.screen_left).then(a.screen_top.total_cmp(&b.screen_top)));
        Self { displays, notches }
    }
}

fn display_of(monitor: &Monitor) -> Display {
    let (position, size, work) = (monitor.position(), monitor.size(), monitor.work_area());
    Display {
        frame: (position.x, position.y, size.width, size.height),
        visible: (work.position.x, work.position.y, work.size.width, work.size.height),
        scale: monitor.scale_factor(),
    }
}

fn read_screens(window: &WebviewWindow) -> Option<Screens> {
    let monitors = window.available_monitors().ok()?;
    if monitors.is_empty() {
        return None;
    }
    Some(Screens::new(monitors.iter().map(display_of).collect(), read_notches(window)))
}

pub(super) fn start(window: WebviewWindow) {
    thread::spawn(move || {
        let mut last = read_screens(&window);
        loop {
            thread::sleep(POLL_INTERVAL);
            let Some(screens) = read_screens(&window) else {
                continue;
            };
            if last.as_ref() == Some(&screens) {
                continue;
            }
            last = Some(screens);
            if let Err(error) = super::apply_stage_geometry(&window, read_window_state(), false) {
                eprintln!("Failed to place the island after the screens changed: {error}");
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{Display, Screens, ScreenNotch};

    const BUILT_IN: Display = Display { frame: (0, 0, 3420, 2214), visible: (0, 74, 3420, 2140), scale: 2.0 };
    const EXTERNAL: Display = Display { frame: (3420, 0, 2560, 1440), visible: (3420, 50, 2560, 1390), scale: 1.0 };
    const NOTCH: ScreenNotch =
        ScreenNotch { screen_left: 0.0, screen_top: 0.0, screen_width: 1710.0, left: 755.0, width: 200.0, height: 37.0 };

    #[test]
    fn listing_order_alone_is_not_a_change() {
        assert_eq!(Screens::new(vec![BUILT_IN, EXTERNAL], vec![NOTCH]), Screens::new(vec![EXTERNAL, BUILT_IN], vec![NOTCH]));
    }

    #[test]
    fn plugging_a_display_in_or_out_is_a_change() {
        assert_ne!(Screens::new(vec![BUILT_IN], vec![NOTCH]), Screens::new(vec![BUILT_IN, EXTERNAL], vec![NOTCH]));
    }

    #[test]
    fn moving_the_dock_or_changing_resolution_is_a_change() {
        let dock_left = Display { visible: (160, 74, 3260, 2214 - 74), ..BUILT_IN };
        assert_ne!(Screens::new(vec![BUILT_IN], vec![]), Screens::new(vec![dock_left], vec![]));
        let scaled = Display { frame: (0, 0, 2940, 1912), visible: (0, 74, 2940, 1838), ..BUILT_IN };
        assert_ne!(Screens::new(vec![BUILT_IN], vec![]), Screens::new(vec![scaled], vec![]));
        let rearranged = Display { frame: (-2560, 0, 2560, 1440), visible: (-2560, 50, 2560, 1390), ..EXTERNAL };
        assert_ne!(Screens::new(vec![BUILT_IN, EXTERNAL], vec![]), Screens::new(vec![BUILT_IN, rearranged], vec![]));
    }

    #[test]
    fn a_notch_appearing_alone_is_a_change() {
        assert_ne!(Screens::new(vec![BUILT_IN], vec![]), Screens::new(vec![BUILT_IN], vec![NOTCH]));
    }
}
