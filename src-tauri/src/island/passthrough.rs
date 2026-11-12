use serde::Serialize;
use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::Duration,
};
use tauri::{Emitter, WebviewWindow};
use windows::Win32::Foundation::HWND;

use super::{
    banner_hit::{banner_rect, ISLAND_BANNER_HOVER_CHANGED_EVENT},
    modifier::{self, ModifierTarget},
    geometry::STAGE_WINDOW_WIDTH,
    state::{read_window_state, CornerShape, IslandMode},
};
use crate::win32;

pub(crate) const ISLAND_HOVER_CHANGED_EVENT: &str = "island-hover-changed";

pub(crate) const ISLAND_MOVE_ARMED_CHANGED_EVENT: &str = "island-move-armed-changed";

pub(crate) const ISLAND_HOLD_CHANGED_EVENT: &str = "island-hold-changed";

pub(crate) const ISLAND_CURSOR_MOVED_EVENT: &str = "island-cursor-moved";
const CURSOR_EVENT_EVERY_TICKS: u32 = 3;

static CURSOR_TRACKING: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
struct CursorPoint {
    x: f64,
    y: f64,
}

#[tauri::command]
pub fn set_island_cursor_tracking(enabled: bool) {
    CURSOR_TRACKING.store(enabled, Ordering::Relaxed);
}

pub(crate) fn start_cursor_passthrough_loop(window: WebviewWindow) {
    thread::spawn(move || {
        let mut ignoring_cursor = false;
        let mut was_inside = false;
        let mut was_on_banner = false;
        let mut was_move_armed = ModifierTarget::None;
        let mut was_held = false;
        let hwnd = window.hwnd().ok();
        let mut tick: u32 = 0;
        let mut last_cursor: Option<CursorPoint> = None;

        loop {
            let is_inside = hwnd.is_none_or(cursor_is_inside_island);
            let is_on_banner = hwnd.is_some_and(cursor_is_on_banner);
            let should_ignore = !is_inside && !is_on_banner;

            if should_ignore != ignoring_cursor
                && window.set_ignore_cursor_events(should_ignore).is_ok()
            {
                ignoring_cursor = should_ignore;
            }

            if is_inside != was_inside {
                was_inside = is_inside;
                let _ = window.emit(ISLAND_HOVER_CHANGED_EVENT, is_inside);
            }

            if is_on_banner != was_on_banner {
                was_on_banner = is_on_banner;
                let _ = window.emit(ISLAND_BANNER_HOVER_CHANGED_EVENT, is_on_banner);
            }

            let alt = win32::input::is_alt_key_down();
            let is_move_armed = match hwnd {
                _ if modifier::is_resizing() => modifier::resize_target(),
                Some(hwnd) if is_inside && alt => modifier::target(hwnd),
                _ => ModifierTarget::None,
            };
            if is_move_armed != was_move_armed {
                was_move_armed = is_move_armed;
                let _ = window.emit(ISLAND_MOVE_ARMED_CHANGED_EVENT, is_move_armed);
            }
            let held = modifier::is_resizing() || (alt && matches!(read_window_state().mode, IslandMode::Expanded));
            if held != was_held {
                was_held = held;
                let _ = window.emit(ISLAND_HOLD_CHANGED_EVENT, held);
            }

            tick = tick.wrapping_add(1);
            if !CURSOR_TRACKING.load(Ordering::Relaxed) {
                last_cursor = None;
            } else if tick.is_multiple_of(CURSOR_EVENT_EVERY_TICKS) {
                let point = hwnd.and_then(cursor_in_window);
                if point.is_some() && point != last_cursor {
                    last_cursor = point;
                    let _ = window.emit(ISLAND_CURSOR_MOVED_EVENT, point);
                }
            }

            thread::sleep(Duration::from_millis(12));
        }
    });
}

fn cursor_in_window(hwnd: HWND) -> Option<CursorPoint> {
    let window_rect = win32::window::window_rect(hwnd)?;
    let cursor = win32::window::cursor_position()?;
    let physical_scale = (window_rect.right - window_rect.left).max(1) as f64 / STAGE_WINDOW_WIDTH;
    let round = |value: f64| (value * 10.0).round() / 10.0;
    Some(CursorPoint {
        x: round((cursor.x - window_rect.left) as f64 / physical_scale),
        y: round((cursor.y - window_rect.top) as f64 / physical_scale),
    })
}

fn cursor_is_on_banner(hwnd: HWND) -> bool {
    let Some(rect) = banner_rect() else {
        return false;
    };
    let state = read_window_state();
    if !matches!(state.mode, IslandMode::Collapsed) || state.is_tucked {
        return false;
    }
    cursor_in_window(hwnd).is_some_and(|point| rect.contains(point.x, point.y))
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct IslandOnScreen {
    pub left: f64,
    pub top: f64,
    pub width: f64,
    pub height: f64,
    pub expanded: bool,
}

pub(crate) fn island_on_screen(hwnd: HWND) -> Option<IslandOnScreen> {
    let window_rect = win32::window::window_rect(hwnd)?;
    let window_width = (window_rect.right - window_rect.left).max(1) as f64;
    let physical_scale = window_width / STAGE_WINDOW_WIDTH;
    let state = read_window_state();
    let (base_width, base_height) = state
        .mode
        .base_size(state.collapsed_width, state.expanded_width, state.expanded_height);
    let width = base_width * state.active_scale() * physical_scale;
    let height = base_height * state.active_scale() * physical_scale;
    Some(IslandOnScreen {
        left: window_rect.left as f64 + (window_width - width) / 2.0,
        top: window_rect.top as f64,
        width,
        height,
        expanded: matches!(state.mode, IslandMode::Expanded),
    })
}

pub(super) fn cursor_is_inside_island(hwnd: HWND) -> bool {
    let Some(window_rect) = win32::window::window_rect(hwnd) else {
        return true;
    };
    let Some(cursor) = win32::window::cursor_position() else {
        return true;
    };

    let window_width = (window_rect.right - window_rect.left).max(1) as f64;
    let physical_scale = window_width / STAGE_WINDOW_WIDTH;
    let local_x = (cursor.x - window_rect.left) as f64;
    let local_y = (cursor.y - window_rect.top) as f64;
    let state = read_window_state();

    let (base_width, base_height) = state
        .mode
        .base_size(state.collapsed_width, state.expanded_width, state.expanded_height);
    let island_width = base_width * state.active_scale() * physical_scale;
    let island_height = base_height * state.active_scale() * physical_scale;
    let island_left = (window_width - island_width) / 2.0;
    let island_top = 0.0;
    let radius = state.bottom_corner_radius() * state.active_scale() * physical_scale;
    let top_radius = state.top_corner_radius() * state.active_scale() * physical_scale;

    point_in_notch(
        local_x,
        local_y,
        island_left,
        island_top,
        island_width,
        island_height,
        radius,
        top_radius,
        state.corner_shape,
    )
}

#[expect(
    clippy::too_many_arguments,
    reason = "a point and the notch's rectangle, two radii and their shape, all plain values"
)]
pub(super) fn point_in_notch(
    x: f64,
    y: f64,
    left: f64,
    top: f64,
    width: f64,
    height: f64,
    radius: f64,
    top_radius: f64,
    shape: CornerShape,
) -> bool {
    let right = left + width;
    let bottom = top + height;

    if x < left || x > right || y < top || y > bottom {
        return false;
    }

    let top_radius = top_radius.min(width / 2.0).min(height / 2.0);
    if y < top + top_radius && (x < left + top_radius || x > right - top_radius) {
        let dx = x - x.clamp(left + top_radius, right - top_radius);
        let dy = y - (top + top_radius);
        return shape.contains(dx, dy, top_radius);
    }

    let radius = radius.min(width / 2.0).min(height);
    if y <= bottom - radius || (x >= left + radius && x <= right - radius) {
        return true;
    }
    let center_x = if x < left + radius {
        left + radius
    } else if x > right - radius {
        right - radius
    } else {
        x
    };
    let center_y = y.min(bottom - radius);
    let dx = x - center_x;
    let dy = y - center_y;

    shape.contains(dx, dy, radius)
}
