use tauri::{Emitter, PhysicalPosition, WebviewWindow};

use super::geometry::{monitor_for_island_position, work_area_top_inset};
use super::screen;
use super::state::{mutate_window_state, read_window_state, IslandPosition, IslandWindowState};

pub(crate) const TOP_ATTACHMENT_CHANGED_EVENT: &str = "island-top-attachment-changed";
const SNAP_DISTANCE: f64 = 16.0;

pub(crate) fn is_attached() -> bool {
    read_window_state().top_attached
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
    let monitor_top = screen::monitor_origin(&monitor).y;
    let top = monitor_top + work_area_top_inset(monitor_top, screen::monitor_work_top(&monitor));
    let snap_distance = (SNAP_DISTANCE * screen::monitor_scale(&monitor)).round() as i32;
    let snapped = IslandPosition {
        x: position.x,
        y: snapped_y(position.y, top, snap_distance),
    };

    if snapped != position {
        if let Err(error) = screen::set_window_position(window, PhysicalPosition::new(snapped.x, snapped.y)) {
            eprintln!("Failed to snap island to the top edge: {error}");
            set_attached(window, position.y == top);
            return position;
        }
    }

    set_attached(window, snapped.y == top);
    snapped
}

pub(crate) fn set_attached(window: &WebviewWindow, attached: bool) {
    let mut changed = false;
    mutate_window_state(|state| {
        changed = state.top_attached != attached;
        state.top_attached = attached;
        *state
    });

    if changed {
        let _ = window.emit(TOP_ATTACHMENT_CHANGED_EVENT, attached);
    }
}

fn is_top_attached(custom_position: Option<IslandPosition>, margin_y: f64, top: i32) -> bool {
    match custom_position {
        Some(position) => position.y == top,
        None => margin_y <= 0.0,
    }
}

fn snapped_y(y: i32, top: i32, snap_distance: i32) -> i32 {
    if (y - top).abs() <= snap_distance {
        top
    } else {
        y
    }
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
        let at = |y| Some(IslandPosition { x: 420, y });
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
        assert_eq!(snapped_y(0, 0, 16), 0);
        assert_eq!(snapped_y(16, 0, 16), 0);
        assert_eq!(snapped_y(-16, 0, 16), 0);
        assert_eq!(snapped_y(17, 0, 16), 17);
        assert_eq!(snapped_y(-17, 0, 16), -17);
        assert_eq!(snapped_y(-1070, -1080, 24), -1080);
        assert_eq!(snapped_y(60, 48, 24), 48);
        assert_eq!(snapped_y(300, 48, 24), 300);
    }
}
