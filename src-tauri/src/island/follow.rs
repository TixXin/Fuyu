use std::{thread, time::Duration};
use tauri::{Emitter, WebviewWindow};

use super::{
    geometry::{apply_stage_geometry, monitor_at},
    state::{mutate_window_state, read_window_state, IslandMode, IslandWindowState, MonitorFollow},
};
use crate::win32;

pub(crate) const ISLAND_POSITION_CLEARED_EVENT: &str = "island-position-cleared";

const POLL_INTERVAL: Duration = Duration::from_millis(300);
const SETTLE_POLLS: u32 = 2;

pub(crate) fn start_monitor_follow_loop(window: WebviewWindow) {
    thread::spawn(move || {
        let mut pending: Option<((i32, i32, i32, i32), u32)> = None;
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
            let seen = match pending {
                Some((known, polls)) if known == bounds => polls + 1,
                _ => 1,
            };
            pending = Some((bounds, seen));
            if seen < SETTLE_POLLS || !may_move(state) {
                continue;
            }
            pending = None;
            move_to(&window, (bounds.0 + bounds.2 / 2, bounds.1 + bounds.3 / 2));
        }
    });
}

fn followed_point(window: &WebviewWindow, state: IslandWindowState) -> Option<(i32, i32)> {
    match state.monitor_follow {
        MonitorFollow::Primary => None,
        MonitorFollow::Cursor => win32::window::cursor_position().map(|point| (point.x, point.y)),
        MonitorFollow::Foreground => {
            let foreground = win32::window::foreground_window();
            let own = window.hwnd().is_ok_and(|island| island == foreground)
                || win32::process::window_process_id(foreground) == std::process::id();
            if own || foreground.is_invalid() {
                return None;
            }
            let rect = win32::window::window_rect(foreground)?;
            Some(((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2))
        }
    }
}

pub(super) fn may_move(state: IslandWindowState) -> bool {
    matches!(state.mode, IslandMode::Collapsed) && !state.is_dragging
}

fn monitor_bounds(window: &WebviewWindow, point: (i32, i32)) -> Option<(i32, i32, i32, i32)> {
    let monitor = monitor_at(window, point).ok().flatten()?;
    let (position, size) = (monitor.position(), monitor.size());
    Some((position.x, position.y, size.width as i32, size.height as i32))
}

fn island_bounds(window: &WebviewWindow) -> Option<(i32, i32, i32, i32)> {
    let position = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;
    monitor_bounds(window, (position.x + size.width as i32 / 2, position.y + size.height as i32 / 2))
}

fn move_to(window: &WebviewWindow, point: (i32, i32)) {
    let mut had_dragged_position = false;
    let state = mutate_window_state(|state| {
        had_dragged_position = state.custom_position.is_some();
        state.custom_position = None;
        state.followed_monitor = Some(point);
        *state
    });
    if had_dragged_position {
        let _ = window.emit(ISLAND_POSITION_CLEARED_EVENT, ());
    }
    if let Err(error) = apply_stage_geometry(window, state, false) {
        eprintln!("Failed to move the island to another monitor: {error}");
    }
}
