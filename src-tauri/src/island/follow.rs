use std::{thread, time::Duration};
use tauri::{Emitter, WebviewWindow};

use super::{
    bottom_edge,
    side,
    follow_point::followed_point,
    geometry::{apply_stage_geometry, monitor_at},
    screen,
    state::{mutate_window_state, read_window_state, Edge, IslandMode, IslandWindowState},
    ISLAND_POSITION_CHANGED_EVENT,
};

pub(crate) const ISLAND_POSITION_CLEARED_EVENT: &str = "island-position-cleared";

const POLL_INTERVAL: Duration = Duration::from_millis(300);
const SETTLE_POLLS: u32 = 2;

pub(crate) fn start_monitor_follow_loop(window: WebviewWindow) {
    thread::spawn(move || {
        let mut pending: Option<(Bounds, u32)> = None;
        loop {
            thread::sleep(POLL_INTERVAL);
            let state = read_window_state();
            let Some(target) = followed_point(&window, state) else {
                pending = None;
                continue;
            };
            let Some(bounds) = monitor_bounds(&window, target) else {
                continue;
            };
            if island_bounds(&window).is_some_and(|island| island == bounds) {
                pending = None;
                continue;
            }
            let seen = polls_on(pending, bounds);
            pending = Some((bounds, seen));
            if seen < SETTLE_POLLS || !may_move(state) {
                continue;
            }
            pending = None;
            move_to(&window, (bounds.0 + bounds.2 / 2, bounds.1 + bounds.3 / 2));
        }
    });
}

type Bounds = (i32, i32, i32, i32);

fn polls_on(pending: Option<(Bounds, u32)>, bounds: Bounds) -> u32 {
    match pending {
        Some((known, polls)) if known == bounds => polls + 1,
        _ => 1,
    }
}

pub(super) fn may_move(state: IslandWindowState) -> bool {
    matches!(state.mode, IslandMode::Collapsed) && !state.is_dragging
}

fn monitor_bounds(window: &WebviewWindow, point: (i32, i32)) -> Option<Bounds> {
    let monitor = monitor_at(window, point).ok().flatten()?;
    let (position, size) = (screen::monitor_origin(&monitor), screen::monitor_size(&monitor));
    Some((position.x, position.y, size.width as i32, size.height as i32))
}

fn island_bounds(window: &WebviewWindow) -> Option<Bounds> {
    let position = screen::window_position(window).ok()?;
    let size = screen::window_size(window).ok()?;
    monitor_bounds(window, (position.x + size.width as i32 / 2, position.y + size.height as i32 / 2))
}

fn move_to(window: &WebviewWindow, point: (i32, i32)) {
    let current = read_window_state();
    let along = current.custom_position.and_then(side::stored_side).map_or(0.5, |(_, along)| along);
    let placed = monitor_at(window, point).ok().flatten().and_then(|monitor| match current.attached_edge {
        Some(Edge::Bottom) => Some(bottom_edge::placed_on(&monitor)),
        Some(edge @ (Edge::Left | Edge::Right)) => side::placed_on(window, &monitor, edge, along, current),
        _ => None,
    });
    let mut had_dragged_position = false;
    let state = mutate_window_state(|state| {
        had_dragged_position = state.custom_position.is_some();
        state.custom_position = placed;
        state.followed_monitor = Some(point);
        *state
    });
    match placed {
        Some(position) => {
            let _ = window.emit(ISLAND_POSITION_CHANGED_EVENT, position);
        }
        None if had_dragged_position => {
            let _ = window.emit(ISLAND_POSITION_CLEARED_EVENT, ());
        }
        None => {}
    }
    if let Err(error) = apply_stage_geometry(window, state, false) {
        eprintln!("Failed to move the island to another monitor: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::polls_on;

    #[test]
    fn a_display_counts_only_while_the_point_stays_on_it() {
        let external = (1710, -200, 2560, 1440);
        assert_eq!(polls_on(None, external), 1);
        assert_eq!(polls_on(Some((external, 1)), external), 2);
        assert_eq!(polls_on(Some(((0, 0, 1710, 1107), 3)), external), 1);
    }
}
