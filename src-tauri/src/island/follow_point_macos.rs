use tauri::WebviewWindow;

use super::state::{IslandWindowState, MonitorFollow};
use crate::macos::{fullscreen::{front_window_of_others, Area}, input::cursor_point};

pub(super) fn followed_point(_window: &WebviewWindow, state: IslandWindowState) -> Option<(i32, i32)> {
    match state.monitor_follow {
        MonitorFollow::Primary => None,
        MonitorFollow::Cursor => Some(rounded(cursor_point())),
        MonitorFollow::Foreground => front_window_of_others().and_then(center_of),
    }
}

fn rounded((x, y): (f64, f64)) -> (i32, i32) {
    (x.floor() as i32, y.floor() as i32)
}

fn center_of(area: Area) -> Option<(i32, i32)> {
    if area.width <= 0.0 || area.height <= 0.0 {
        return None;
    }
    Some(rounded((area.x + area.width / 2.0, area.y + area.height / 2.0)))
}

#[cfg(test)]
mod tests {
    use super::{center_of, rounded, Area};

    #[test]
    fn cursor_points_round_down_so_the_last_point_stays_on_its_display() {
        assert_eq!(rounded((1709.6, 0.4)), (1709, 0));
        assert_eq!(rounded((-0.5, 1106.9)), (-1, 1106));
    }

    #[test]
    fn a_front_window_counts_by_its_center_in_global_points() {
        assert_eq!(center_of(Area { x: 1710.0, y: 25.0, width: 800.0, height: 600.0 }), Some((2110, 325)));
        assert_eq!(center_of(Area { x: -1920.0, y: -1080.0, width: 1920.0, height: 1080.0 }), Some((-960, -540)));
        assert_eq!(center_of(Area { x: 10.0, y: 10.0, width: 0.0, height: 30.0 }), None);
    }
}
