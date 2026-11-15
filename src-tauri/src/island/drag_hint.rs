use serde::Serialize;
use tauri::{Emitter, WebviewWindow};

use super::bottom_edge;
use super::geometry::{island_rect, monitor_at, IslandOnScreen, STAGE_WINDOW_WIDTH};
use super::screen;
use super::side::{full_rect, is_outer, near_side, Rect, SNAP_DISTANCE};
use super::state::{read_window_state, Edge, IslandMode, IslandWindowState};

pub(crate) const DRAG_EDGE_HINT_EVENT: &str = "island-drag-edge-hint";

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub(crate) struct DragEdgeHint {
    edge: Edge,
    offset: f64,
}

pub(super) fn hint_for(rect: IslandOnScreen, work: Rect, snap: f64, collapsed: bool, outer: impl Fn(Edge) -> bool) -> Option<Edge> {
    let (_, work_top, _, _) = work;
    let side = collapsed.then(|| near_side(rect.left, rect.width, work, snap)).flatten().filter(|edge| outer(*edge));
    side.or_else(|| (bottom_edge::near_bottom(rect.top + rect.height, work, snap) && outer(Edge::Bottom)).then_some(Edge::Bottom))
        .or_else(|| ((rect.top - work_top as f64).abs() <= snap).then_some(Edge::Top))
}

pub(super) fn offset_in_stage(edge: Edge, (work_left, work_top, work_width, work_height): Rect, window: (f64, f64), per_px: f64) -> f64 {
    let screen_line = match edge {
        Edge::Left => work_left,
        Edge::Right => work_left + work_width,
        Edge::Top => work_top,
        Edge::Bottom => work_top + work_height,
    } as f64;
    let origin = if matches!(edge, Edge::Left | Edge::Right) { window.0 } else { window.1 };
    ((screen_line - origin) / per_px * 10.0).round() / 10.0
}

fn current(window: &WebviewWindow, state: IslandWindowState) -> Option<DragEdgeHint> {
    let position = screen::window_position(window).ok()?;
    let size = screen::window_size(window).ok()?;
    let (width, height) = (f64::from(size.width), f64::from(size.height));
    let rect = island_rect(f64::from(position.x), f64::from(position.y), width, height, state);
    let center = ((rect.left + rect.width / 2.0).round() as i32, (rect.top + rect.height / 2.0).round() as i32);
    let monitor = monitor_at(window, center).ok().flatten()?;
    let work = screen::monitor_work_rect(&monitor);
    let monitors: Vec<Rect> = window.available_monitors().ok()?.iter().map(full_rect).collect();
    let own = full_rect(&monitor);
    let snap = SNAP_DISTANCE * screen::monitor_scale(&monitor);
    let collapsed = matches!(state.mode, IslandMode::Collapsed);
    let edge = hint_for(rect, work, snap, collapsed, |edge| is_outer(edge, own, &monitors))?;
    let per_px = width / STAGE_WINDOW_WIDTH;
    Some(DragEdgeHint { edge, offset: offset_in_stage(edge, work, (f64::from(position.x), f64::from(position.y)), per_px) })
}

pub(super) struct DragHints {
    last: Option<DragEdgeHint>,
    polls: u32,
}

impl DragHints {
    pub(super) fn new() -> Self {
        Self { last: None, polls: 0 }
    }

    pub(super) fn poll(&mut self, window: &WebviewWindow) {
        self.polls += 1;
        if !self.polls.is_multiple_of(5) {
            return;
        }
        self.send(window, current(window, read_window_state()));
    }

    pub(super) fn finish(&mut self, window: &WebviewWindow) {
        self.send(window, None);
    }

    fn send(&mut self, window: &WebviewWindow, hint: Option<DragEdgeHint>) {
        if hint == self.last {
            return;
        }
        self.last = hint;
        let _ = window.emit(DRAG_EDGE_HINT_EVENT, hint);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const WORK: Rect = (0, 0, 1920, 1040);

    fn rect(left: f64, top: f64, width: f64, height: f64) -> IslandOnScreen {
        IslandOnScreen { left, top, width, height, expanded: false }
    }

    #[test]
    fn hints_only_the_edge_the_island_would_snap_to() {
        let all = |_: Edge| true;
        assert_eq!(hint_for(rect(8.0, 400.0, 300.0, 34.0), WORK, 16.0, true, all), Some(Edge::Left));
        assert_eq!(hint_for(rect(8.0, 400.0, 300.0, 34.0), WORK, 16.0, false, all), None);
        assert_eq!(hint_for(rect(1612.0, 400.0, 300.0, 34.0), WORK, 16.0, true, all), Some(Edge::Right));
        assert_eq!(hint_for(rect(800.0, 1000.0, 300.0, 34.0), WORK, 16.0, true, all), Some(Edge::Bottom));
        assert_eq!(hint_for(rect(800.0, 12.0, 300.0, 34.0), WORK, 16.0, true, all), Some(Edge::Top));
        assert_eq!(hint_for(rect(800.0, 400.0, 300.0, 34.0), WORK, 16.0, true, all), None);
        assert_eq!(hint_for(rect(8.0, 400.0, 300.0, 34.0), WORK, 16.0, true, |edge| edge != Edge::Left), None);
    }

    #[test]
    fn the_hint_line_sits_on_the_screen_edge_inside_the_stage() {
        assert_eq!(offset_in_stage(Edge::Left, WORK, (-250.0, 300.0), 1.0), 250.0);
        assert_eq!(offset_in_stage(Edge::Right, WORK, (1500.0, 300.0), 1.0), 420.0);
        assert_eq!(offset_in_stage(Edge::Bottom, WORK, (500.0, 1000.0), 2.0), 20.0);
        assert_eq!(offset_in_stage(Edge::Top, WORK, (500.0, 10.0), 1.0), -10.0);
    }
}
