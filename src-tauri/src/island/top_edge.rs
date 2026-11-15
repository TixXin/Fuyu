use tauri::{Emitter, Monitor, PhysicalPosition, WebviewWindow};

use super::edge;
use super::geometry::{apply_stage_geometry, monitor_at, monitor_for_island_position, work_area_top_inset, STAGE_WINDOW_WIDTH};
use super::side::full_rect;
use super::screen;
use super::state::{mutate_window_state, read_window_state, Edge, IslandPosition, IslandWindowState, MonitorFollow};

pub(crate) const TOP_ATTACHMENT_CHANGED_EVENT: &str = "island-top-attachment-changed";
const POSITION_CLEARED_EVENT: &str = "island-position-cleared";
const SNAP_DISTANCE: f64 = 16.0;
const HOME_DISTANCE: f64 = 40.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct TopEdge {
    pub(super) y: i32,
    pub(super) reach: i32,
}

impl TopEdge {
    pub(super) fn new(monitor_top: i32, work_top: i32, flush_with_screen: bool) -> Self {
        let work_top = monitor_top + work_area_top_inset(monitor_top, work_top);
        if flush_with_screen {
            Self { y: monitor_top, reach: work_top }
        } else {
            Self { y: work_top, reach: work_top }
        }
    }

    pub(super) fn near(self, y: f64, snap: f64) -> bool {
        y >= f64::from(self.y) - snap && y <= f64::from(self.reach) + snap
    }
}

pub(super) fn flush_with_screen(under_menu_bar: bool) -> bool {
    cfg!(target_os = "macos") && !under_menu_bar
}

pub(super) fn top_edge(monitor: &Monitor, under_menu_bar: bool) -> TopEdge {
    TopEdge::new(screen::monitor_origin(monitor).y, screen::monitor_work_top(monitor), flush_with_screen(under_menu_bar))
}

pub(crate) fn is_attached() -> bool {
    edge::attached() == Some(Edge::Top)
}

pub(crate) fn sync_from_stage(window: &WebviewWindow, state: IslandWindowState, top: i32) {
    set_attached(
        window,
        is_top_attached(state.custom_position, state.margin_y, top),
    );
}

pub(crate) fn snap_to_top(window: &WebviewWindow, position: IslandPosition) -> IslandPosition {
    let Ok(Some(monitor)) = monitor_for_island_position(window, position) else {
        set_attached(window, false);
        return position;
    };
    let top = top_edge(&monitor, super::notch::under_menu_bar(window, &monitor, read_window_state()));
    let scale = screen::monitor_scale(&monitor);
    let snapped = IslandPosition::at(position.x, snapped_y(position.y, top, SNAP_DISTANCE * scale));

    if snapped.y == top.y && cfg!(target_os = "macos") && is_home_monitor(window, &monitor) {
        let (left, width) = (screen::monitor_origin(&monitor).x, screen::monitor_size(&monitor).width as i32);
        if near_home(snapped.x, STAGE_WINDOW_WIDTH * scale, (left, width), HOME_DISTANCE * scale) {
            go_home(window);
            return snapped;
        }
    }

    if snapped != position {
        if let Err(error) = screen::set_window_position(window, PhysicalPosition::new(snapped.x, snapped.y)) {
            eprintln!("Failed to snap island to the top edge: {error}");
            set_attached(window, position.y == top.y);
            return position;
        }
    }

    set_attached(window, snapped.y == top.y);
    snapped
}

fn is_home_monitor(window: &WebviewWindow, monitor: &Monitor) -> bool {
    let state = read_window_state();
    let followed = match state.monitor_follow {
        MonitorFollow::Primary => None,
        _ => state.followed_monitor.and_then(|point| monitor_at(window, point).ok().flatten()),
    };
    let home = followed.or_else(|| window.primary_monitor().ok().flatten());
    home.is_some_and(|home| full_rect(&home) == full_rect(monitor))
}

fn go_home(window: &WebviewWindow) {
    let state = mutate_window_state(|state| {
        state.custom_position = None;
        state.out_at_top = false;
        state.is_dragging = false;
        *state
    });
    let _ = window.emit(POSITION_CLEARED_EVENT, ());
    if let Err(error) = apply_stage_geometry(window, state, true) {
        eprintln!("Failed to return the island to the top centre: {error}");
    }
}

pub(crate) fn set_attached(window: &WebviewWindow, attached: bool) {
    edge::set_attached(window, attached.then_some(Edge::Top));
}

fn is_top_attached(custom_position: Option<IslandPosition>, margin_y: f64, top: i32) -> bool {
    match custom_position {
        Some(position) => position.y == top,
        None => margin_y <= 0.0,
    }
}

pub(super) fn snapped_y(y: i32, top: TopEdge, snap: f64) -> i32 {
    if top.near(f64::from(y), snap) {
        top.y
    } else {
        y
    }
}

pub(super) fn near_home(stage_x: i32, stage_width: f64, (monitor_left, monitor_width): (i32, i32), distance: f64) -> bool {
    let island_centre = f64::from(stage_x) + stage_width / 2.0;
    let screen_centre = f64::from(monitor_left) + f64::from(monitor_width) / 2.0;
    (island_centre - screen_centre).abs() <= distance
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_position_is_attached_only_without_a_margin() {
        assert!(is_top_attached(None, 0.0, 0));
        assert!(is_top_attached(None, 0.0, 48));
        assert!(!is_top_attached(None, 12.0, 0));
    }

    #[test]
    fn custom_position_is_attached_only_when_flush_with_the_top() {
        let at = |y| Some(IslandPosition::at(420, y));
        assert!(is_top_attached(at(0), 0.0, 0));
        assert!(is_top_attached(at(0), 40.0, 0));
        assert!(is_top_attached(at(-1080), 0.0, -1080));
        assert!(is_top_attached(at(48), 0.0, 48));
        assert!(!is_top_attached(at(1), 0.0, 0));
        assert!(!is_top_attached(at(180), 0.0, 0));
        assert!(!is_top_attached(at(0), 0.0, 48));
    }

    #[test]
    fn drops_near_the_top_snap_flush_and_others_stay() {
        let at = |top| TopEdge::new(top, top, false);
        assert_eq!(snapped_y(0, at(0), 16.0), 0);
        assert_eq!(snapped_y(16, at(0), 16.0), 0);
        assert_eq!(snapped_y(-16, at(0), 16.0), 0);
        assert_eq!(snapped_y(17, at(0), 16.0), 17);
        assert_eq!(snapped_y(-17, at(0), 16.0), -17);
        assert_eq!(snapped_y(-1070, at(-1080), 24.0), -1080);
        assert_eq!(snapped_y(60, at(48), 24.0), 48);
        assert_eq!(snapped_y(300, at(48), 24.0), 300);
    }

    #[test]
    fn the_top_edge_is_the_screen_top_over_the_menu_bar_and_the_work_area_under_it() {
        assert_eq!(TopEdge::new(0, 37, true), TopEdge { y: 0, reach: 37 });
        assert_eq!(TopEdge::new(0, 37, false), TopEdge { y: 37, reach: 37 });
        assert_eq!(TopEdge::new(-1080, -1055, true), TopEdge { y: -1080, reach: -1055 });
        assert_eq!(TopEdge::new(0, 0, true), TopEdge { y: 0, reach: 0 });
        assert_eq!(TopEdge::new(100, 40, false), TopEdge { y: 100, reach: 100 });
    }

    #[test]
    fn over_the_menu_bar_a_drop_at_its_lower_edge_still_snaps_to_the_screen_top() {
        let over = TopEdge::new(0, 37, true);
        assert_eq!(snapped_y(37, over, 16.0), 0);
        assert_eq!(snapped_y(53, over, 16.0), 0);
        assert_eq!(snapped_y(54, over, 16.0), 54);
        assert_eq!(snapped_y(12, over, 16.0), 0);
        let under = TopEdge::new(0, 37, false);
        assert_eq!(snapped_y(37, under, 16.0), 37);
        assert_eq!(snapped_y(22, under, 16.0), 37);
        assert_eq!(snapped_y(0, under, 16.0), 0);
    }

    #[test]
    fn a_drop_within_forty_points_of_the_centre_goes_home() {
        let screen = (0, 1710);
        assert!(near_home(445, 820.0, screen, 40.0));
        assert!(near_home(485, 820.0, screen, 40.0));
        assert!(near_home(405, 820.0, screen, 40.0));
        assert!(!near_home(486, 820.0, screen, 40.0));
        assert!(!near_home(404, 820.0, screen, 40.0));
        assert!(!near_home(0, 820.0, screen, 40.0));
        assert!(near_home(-1920 + 550, 820.0, (-1920, 1920), 40.0));
        assert!(!near_home(445, 820.0, (-1920, 1920), 40.0));
        assert!(near_home(1890, 1640.0, (1000, 3420), 80.0));
    }
}
