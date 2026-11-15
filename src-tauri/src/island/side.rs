use tauri::{Monitor, PhysicalPosition, WebviewWindow};

use super::bottom_edge;
use super::edge;
use super::geometry::{
    apply_stage_geometry, island_rect, monitor_for_island_position, SIDE_COLUMN_MAX_HEIGHT, SIDE_COLUMN_MIN_HEIGHT,
    STAGE_WINDOW_WIDTH,
};
use super::screen;
use super::state::{mutate_window_state, read_window_state, Edge, IslandMode, IslandPosition, IslandWindowState};
use super::top_edge;

pub(super) const SNAP_DISTANCE: f64 = 16.0;

pub(super) type Rect = (i32, i32, i32, i32);

pub(super) fn stored_side(position: IslandPosition) -> Option<(Edge, f64)> {
    let edge = position.edge.filter(|edge| matches!(edge, Edge::Left | Edge::Right))?;
    Some((edge, position.along.unwrap_or(0.5).clamp(0.0, 1.0)))
}

pub(super) fn stage_position(
    edge: Edge,
    along: f64,
    (work_left, work_top, work_width, work_height): Rect,
    stage_width: i32,
    island_height: f64,
) -> (i32, i32) {
    let x = match edge {
        Edge::Right => work_left + work_width - stage_width,
        _ => work_left,
    };
    let top = work_top as f64 + along * work_height as f64 - island_height / 2.0;
    let lowest = (work_top + work_height) as f64 - island_height;
    (x, top.min(lowest).max(work_top as f64).round() as i32)
}

pub(super) fn island_height(state: IslandWindowState, scale: f64) -> f64 {
    state.base_size().1 * state.active_scale() * scale
}

pub(super) fn along_for(island_center: f64, (_, work_top, _, work_height): Rect) -> f64 {
    if work_height <= 0 {
        return 0.5;
    }
    ((island_center - work_top as f64) / work_height as f64).clamp(0.0, 1.0)
}

pub(super) fn placed_on(window: &WebviewWindow, monitor: &Monitor, edge: Edge, along: f64, state: IslandWindowState) -> Option<IslandPosition> {
    let monitors: Vec<Rect> = window.available_monitors().ok()?.iter().map(full_rect).collect();
    if !is_outer(edge, full_rect(monitor), &monitors) {
        return None;
    }
    let scale = screen::monitor_scale(monitor);
    let mut placed = state;
    placed.attached_edge = Some(edge);
    let stage_width = (STAGE_WINDOW_WIDTH * scale).round() as i32;
    let (x, y) = stage_position(edge, along, screen::monitor_work_rect(monitor), stage_width, island_height(placed, scale));
    Some(IslandPosition { x, y, edge: Some(edge), along: Some(along) })
}

#[tauri::command]
pub fn set_island_side_column(app: tauri::AppHandle, height: f64) -> Result<(), String> {
    if !height.is_finite() {
        return Ok(());
    }
    let height = height.clamp(SIDE_COLUMN_MIN_HEIGHT, SIDE_COLUMN_MAX_HEIGHT);
    let previous = read_window_state();
    if (previous.side_column_height - height).abs() < 0.5 {
        return Ok(());
    }
    let state = mutate_window_state(|state| {
        state.side_column_height = height;
        *state
    });
    if state.side().is_none() || state.is_dragging {
        return Ok(());
    }
    apply_stage_geometry(&super::main_window(&app)?, state, false)
}

pub(super) fn is_outer(edge: Edge, (left, top, width, height): Rect, monitors: &[Rect]) -> bool {
    !monitors.iter().any(|&(other_left, other_top, other_width, other_height)| {
        let beside = other_top < top + height && other_top + other_height > top;
        let below = other_left < left + width && other_left + other_width > left;
        match edge {
            Edge::Left => beside && other_left + other_width == left,
            Edge::Right => beside && other_left == left + width,
            Edge::Bottom => below && other_top == top + height,
            Edge::Top => false,
        }
    })
}

pub(super) fn near_side(island_left: f64, island_width: f64, (work_left, _, work_width, _): Rect, snap: f64) -> Option<Edge> {
    let to_left = island_left - work_left as f64;
    let to_right = (work_left + work_width) as f64 - (island_left + island_width);
    match (to_left <= snap, to_right <= snap) {
        (true, true) => Some(if to_left <= to_right { Edge::Left } else { Edge::Right }),
        (true, false) => Some(Edge::Left),
        (false, true) => Some(Edge::Right),
        (false, false) => None,
    }
}

pub(super) fn full_rect(monitor: &Monitor) -> Rect {
    let (origin, size) = (screen::monitor_origin(monitor), screen::monitor_size(monitor));
    (origin.x, origin.y, size.width as i32, size.height as i32)
}

pub(super) fn snap_after_drag(window: &WebviewWindow, position: IslandPosition, state: IslandWindowState) -> IslandPosition {
    if matches!(state.mode, IslandMode::Collapsed) {
        if let Some(snapped) = snap_to_side(window, position, state) {
            return snapped;
        }
    }
    if let Some(snapped) = bottom_edge::snap(window, position, state) {
        return snapped;
    }
    let position = if state.attached_edge == Some(Edge::Bottom) {
        bottom_edge::leave(window, position, state)
    } else if state.side().is_some() {
        leave_side(window, position, state)
    } else {
        position
    };
    top_edge::snap_to_top(window, position)
}

fn snap_to_side(window: &WebviewWindow, position: IslandPosition, state: IslandWindowState) -> Option<IslandPosition> {
    let monitor = monitor_for_island_position(window, position).ok().flatten()?;
    let scale = screen::monitor_scale(&monitor);
    let stage_width = STAGE_WINDOW_WIDTH * scale;
    let rect = island_rect(position.x as f64, position.y as f64, stage_width, bottom_edge::window_height(window), state);
    let work = screen::monitor_work_rect(&monitor);
    let edge = near_side(rect.left, rect.width, work, SNAP_DISTANCE * scale)?;
    let monitors: Vec<Rect> = window.available_monitors().ok()?.iter().map(full_rect).collect();
    if !is_outer(edge, full_rect(&monitor), &monitors) {
        return None;
    }

    let mut placed = state;
    placed.attached_edge = Some(edge);
    let along = along_for(rect.top + rect.height / 2.0, work);
    let (x, y) = stage_position(edge, along, work, stage_width.round() as i32, island_height(placed, scale));
    if let Err(error) = screen::set_window_position(window, PhysicalPosition::new(x, y)) {
        eprintln!("Failed to snap island to the side: {error}");
        return None;
    }
    edge::set_attached(window, Some(edge));
    Some(IslandPosition { x, y, edge: Some(edge), along: Some(along) })
}

fn leave_side(window: &WebviewWindow, position: IslandPosition, state: IslandWindowState) -> IslandPosition {
    let scale = screen::window_scale(window).unwrap_or(1.0);
    let stage_width = STAGE_WINDOW_WIDTH * scale;
    let rect = island_rect(position.x as f64, position.y as f64, stage_width, bottom_edge::window_height(window), state);
    let x = (rect.left + rect.width / 2.0 - stage_width / 2.0).round() as i32;
    edge::set_attached(window, None);
    if x != position.x {
        if let Err(error) = screen::set_window_position(window, PhysicalPosition::new(x, position.y)) {
            eprintln!("Failed to move island off the side: {error}");
            return position;
        }
    }
    IslandPosition::at(x, position.y)
}

#[cfg(test)]
mod tests {
    use super::*;

    const WORK: Rect = (0, 0, 1920, 1040);

    #[test]
    fn only_drops_near_a_side_snap() {
        assert_eq!(near_side(10.0, 300.0, WORK, 16.0), Some(Edge::Left));
        assert_eq!(near_side(-40.0, 300.0, WORK, 16.0), Some(Edge::Left));
        assert_eq!(near_side(1610.0, 300.0, WORK, 16.0), Some(Edge::Right));
        assert_eq!(near_side(1700.0, 300.0, WORK, 16.0), Some(Edge::Right));
        assert_eq!(near_side(17.0, 300.0, WORK, 16.0), None);
        assert_eq!(near_side(800.0, 300.0, WORK, 16.0), None);
    }

    #[test]
    fn a_side_shared_with_another_monitor_is_not_outer() {
        let main = (0, 0, 1920, 1080);
        let left = (-1920, 0, 1920, 1080);
        let above = (0, -1080, 1920, 1080);
        assert!(!is_outer(Edge::Left, main, &[main, left]));
        assert!(is_outer(Edge::Right, main, &[main, left]));
        assert!(is_outer(Edge::Left, main, &[main, above]));
        assert!(!is_outer(Edge::Right, left, &[main, left]));
        let below = (480, 1080, 1920, 1080);
        assert!(!is_outer(Edge::Bottom, main, &[main, below]));
        assert!(is_outer(Edge::Bottom, below, &[main, below]));
        assert!(is_outer(Edge::Bottom, main, &[main, left, above]));
    }

    #[test]
    fn the_column_panel_and_handle_share_a_center_line_and_stay_on_screen() {
        assert_eq!(stage_position(Edge::Left, 0.0, WORK, 820, 120.0), (0, 0));
        assert_eq!(stage_position(Edge::Right, 1.0, WORK, 820, 120.0), (1100, 920));
        assert_eq!(stage_position(Edge::Left, 0.5, WORK, 820, 120.0), (0, 460));
        assert_eq!(stage_position(Edge::Left, 0.5, WORK, 820, 400.0), (0, 320));
        assert_eq!(stage_position(Edge::Left, 0.5, WORK, 820, 72.0), (0, 484));
        assert_eq!(stage_position(Edge::Right, 0.9, WORK, 820, 400.0), (1100, 640));
        assert_eq!(stage_position(Edge::Left, 0.5, (0, 48, 1920, 1032), 820, 72.0), (0, 528));
        assert_eq!(along_for(520.0, WORK), 0.5);
        assert_eq!(along_for(-20.0, WORK), 0.0);
        assert_eq!(along_for(2000.0, WORK), 1.0);
        assert_eq!(along_for(10.0, (0, 0, 0, 0)), 0.5);
    }

    #[test]
    fn a_collapsed_side_island_is_a_column_and_tucks_into_the_handle() {
        let mut state = IslandWindowState { attached_edge: Some(Edge::Left), side_column_height: 152.0, ..Default::default() };
        assert_eq!(state.base_size(), (44.0, 152.0));
        assert_eq!(state.bottom_corner_radius(), 22.0);
        state.is_tucked = true;
        assert_eq!(state.base_size(), (12.0, 72.0));
        state.is_tucked = false;
        state.mode = IslandMode::Expanded;
        assert_eq!(state.base_size(), (state.expanded_width, state.expanded_height));
    }

    #[test]
    fn only_left_and_right_are_stored_sides() {
        let mut position = IslandPosition::at(0, 300);
        assert_eq!(stored_side(position), None);
        position.edge = Some(Edge::Top);
        assert_eq!(stored_side(position), None);
        position.edge = Some(Edge::Left);
        assert_eq!(stored_side(position), Some((Edge::Left, 0.5)));
        position.along = Some(1.4);
        assert_eq!(stored_side(position), Some((Edge::Left, 1.0)));
    }
}
