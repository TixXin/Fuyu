use tauri::{Monitor, PhysicalPosition, WebviewWindow};

use super::edge;
use super::geometry::{island_rect, monitor_for_island_position, SIDE_HANDLE_HEIGHT, STAGE_WINDOW_WIDTH};
use super::screen;
use super::state::{Edge, IslandMode, IslandPosition, IslandWindowState};
use super::top_edge;

const SNAP_DISTANCE: f64 = 16.0;

pub(super) type Rect = (i32, i32, i32, i32);

pub(super) fn stored_side(position: IslandPosition) -> Option<(Edge, f64)> {
    let edge = position.edge.filter(|edge| *edge != Edge::Top)?;
    Some((edge, position.along.unwrap_or(0.5).clamp(0.0, 1.0)))
}

pub(super) fn stage_position(
    edge: Edge,
    along: f64,
    (work_left, work_top, work_width, work_height): Rect,
    stage_width: i32,
    handle_height: f64,
    island_height: f64,
) -> (i32, i32) {
    let x = match edge {
        Edge::Right => work_left + work_width - stage_width,
        _ => work_left,
    };
    let anchor = work_top as f64 + along * (work_height as f64 - handle_height).max(0.0);
    let lowest = (work_top + work_height) as f64 - island_height;
    (x, anchor.min(lowest).max(work_top as f64).round() as i32)
}

pub(super) fn heights(state: IslandWindowState, scale: f64) -> (f64, f64) {
    let handle = SIDE_HANDLE_HEIGHT * state.collapsed_scale * scale;
    let island = match state.mode {
        IslandMode::Collapsed => handle,
        IslandMode::Expanded => state.expanded_height * state.expanded_scale * scale,
    };
    (handle, island)
}

pub(super) fn along_for(island_top: f64, (_, work_top, _, work_height): Rect, handle_height: f64) -> f64 {
    let range = work_height as f64 - handle_height;
    if range <= 0.0 {
        return 0.0;
    }
    ((island_top - work_top as f64) / range).clamp(0.0, 1.0)
}

pub(super) fn is_outer(edge: Edge, (left, top, width, height): Rect, monitors: &[Rect]) -> bool {
    !monitors.iter().any(|&(other_left, other_top, other_width, other_height)| {
        let overlaps = other_top < top + height && other_top + other_height > top;
        overlaps
            && match edge {
                Edge::Left => other_left + other_width == left,
                Edge::Right => other_left == left + width,
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

fn full_rect(monitor: &Monitor) -> Rect {
    let (origin, size) = (screen::monitor_origin(monitor), screen::monitor_size(monitor));
    (origin.x, origin.y, size.width as i32, size.height as i32)
}

pub(super) fn snap_after_drag(window: &WebviewWindow, position: IslandPosition, state: IslandWindowState) -> IslandPosition {
    if matches!(state.mode, IslandMode::Collapsed) {
        if let Some(snapped) = snap_to_side(window, position, state) {
            return snapped;
        }
    }
    let position = if state.side().is_some() { leave_side(window, position, state) } else { position };
    top_edge::snap_to_top(window, position)
}

fn snap_to_side(window: &WebviewWindow, position: IslandPosition, state: IslandWindowState) -> Option<IslandPosition> {
    if cfg!(target_os = "macos") {
        return None;
    }
    let monitor = monitor_for_island_position(window, position).ok().flatten()?;
    let scale = screen::monitor_scale(&monitor);
    let stage_width = STAGE_WINDOW_WIDTH * scale;
    let rect = island_rect(position.x as f64, position.y as f64, stage_width, state);
    let work = screen::monitor_work_rect(&monitor);
    let edge = near_side(rect.left, rect.width, work, SNAP_DISTANCE * scale)?;
    let monitors: Vec<Rect> = window.available_monitors().ok()?.iter().map(full_rect).collect();
    if !is_outer(edge, full_rect(&monitor), &monitors) {
        return None;
    }

    let mut placed = state;
    placed.attached_edge = Some(edge);
    let (handle, island) = heights(placed, scale);
    let along = along_for(rect.top, work, handle);
    let (x, y) = stage_position(edge, along, work, stage_width.round() as i32, handle, island);
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
    let rect = island_rect(position.x as f64, position.y as f64, stage_width, state);
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
    }

    #[test]
    fn the_handle_keeps_its_place_along_the_side_and_the_panel_stays_on_screen() {
        assert_eq!(stage_position(Edge::Left, 0.0, WORK, 820, 72.0, 72.0), (0, 0));
        assert_eq!(stage_position(Edge::Right, 1.0, WORK, 820, 72.0, 72.0), (1100, 968));
        assert_eq!(stage_position(Edge::Right, 1.0, WORK, 820, 72.0, 490.0), (1100, 550));
        assert_eq!(stage_position(Edge::Left, 0.5, (0, 48, 1920, 1032), 820, 72.0, 72.0), (0, 528));
        assert_eq!(along_for(484.0, WORK, 72.0), 0.5);
        assert_eq!(along_for(-20.0, WORK, 72.0), 0.0);
        assert_eq!(along_for(2000.0, WORK, 72.0), 1.0);
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
