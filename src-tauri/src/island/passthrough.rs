use serde::Serialize;
use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
};
use tauri::{Emitter, WebviewWindow};
use windows::Win32::Foundation::HWND;

use super::{
    banner_hit::{banner_rect, ISLAND_BANNER_HOVER_CHANGED_EVENT},
    modifier::{self, ModifierTarget},
    geometry::{
        cursor_near_island, cursor_near_stage, cursor_on_island, gaze_cursor_point, island_rect,
        passthrough_sleep_duration, should_ignore_cursor, stage_point, DimWakeTracker, IslandOnScreen,
    },
    state::{mutate_window_state, read_window_state, IslandMode, IslandWindowState},
    ISLAND_DIM_WAKE_EVENT,
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
        let mut dim_wake = DimWakeTracker::default();

        loop {
            if !window.is_visible().unwrap_or(true) {
                dim_wake = DimWakeTracker::default();
                thread::sleep(passthrough_sleep_duration(false, false));
                continue;
            }
            let (mut state, raw_inside, is_near_island, raw_cursor) = read_pointer_state(hwnd);
            if dim_wake.poll(state.dimmed_passthrough(), is_near_island, raw_cursor) {
                state = mutate_window_state(|current| {
                    current.is_dimmed = false;
                    *current
                });
                let _ = window.emit(ISLAND_DIM_WAKE_EVENT, ());
            }
            let is_inside = raw_inside && !state.dimmed_passthrough();
            let is_on_banner = hwnd.is_some_and(cursor_is_on_banner);
            let should_ignore = should_ignore_cursor(state, raw_inside, is_on_banner);

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
            let held = modifier::is_resizing() || (alt && matches!(state.mode, IslandMode::Expanded));
            if held != was_held {
                was_held = held;
                let _ = window.emit(ISLAND_HOLD_CHANGED_EVENT, held);
            }

            let near = hwnd.is_none_or(cursor_is_near_stage);
            tick = tick.wrapping_add(1);
            let tracking = CURSOR_TRACKING.load(Ordering::Relaxed);
            if !tracking || is_inside || state.is_tucked {
                last_cursor = None;
            } else if tick.is_multiple_of(CURSOR_EVENT_EVERY_TICKS) {
                let point = hwnd.and_then(|handle| gaze_cursor_in_window(handle, near));
                if point.is_some() && point != last_cursor {
                    last_cursor = point;
                    let _ = window.emit(ISLAND_CURSOR_MOVED_EVENT, point);
                }
            }

            let active = is_inside || is_on_banner || held || near;
            thread::sleep(passthrough_sleep_duration(true, active));
        }
    });
}

fn gaze_cursor_in_window(hwnd: HWND, near_stage: bool) -> Option<CursorPoint> {
    let point = cursor_in_window(hwnd)?;
    let (x, y) = gaze_cursor_point((point.x, point.y), near_stage);
    Some(CursorPoint { x, y })
}

fn cursor_in_window(hwnd: HWND) -> Option<CursorPoint> {
    let window_rect = win32::window::window_rect(hwnd)?;
    let cursor = win32::window::cursor_position()?;
    let (x, y) = stage_point(
        window_rect.left as f64,
        window_rect.top as f64,
        (window_rect.right - window_rect.left).max(1) as f64,
        cursor.x as f64,
        cursor.y as f64,
    );
    Some(CursorPoint { x, y })
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

pub(crate) fn island_on_screen(window: &WebviewWindow) -> Option<IslandOnScreen> {
    let window_rect = win32::window::window_rect(window.hwnd().ok()?)?;
    let window_width = (window_rect.right - window_rect.left).max(1) as f64;
    let window_height = (window_rect.bottom - window_rect.top).max(1) as f64;
    Some(island_rect(window_rect.left as f64, window_rect.top as f64, window_width, window_height, read_window_state()))
}

fn read_pointer_state(hwnd: Option<HWND>) -> (IslandWindowState, bool, bool, Option<(f64, f64)>) {
    let state = read_window_state();
    let Some(hwnd) = hwnd else {
        return (state, !state.dimmed_passthrough(), false, None);
    };
    let Some(window_rect) = win32::window::window_rect(hwnd) else {
        return (state, !state.dimmed_passthrough(), false, None);
    };
    let Some(cursor) = win32::window::cursor_position() else {
        return (state, !state.dimmed_passthrough(), false, None);
    };
    let left = window_rect.left as f64;
    let top = window_rect.top as f64;
    let width = (window_rect.right - window_rect.left).max(1) as f64;
    let height = (window_rect.bottom - window_rect.top).max(1) as f64;
    let cx = cursor.x as f64;
    let cy = cursor.y as f64;
    let inside = cursor_on_island(left, top, width, height, cx, cy, state);
    let near = inside || cursor_near_island(left, top, width, height, cx, cy, state);
    (state, inside, near, Some((cx, cy)))
}

fn cursor_is_near_stage(hwnd: HWND) -> bool {
    let Some(window_rect) = win32::window::window_rect(hwnd) else {
        return true;
    };
    let Some(cursor) = win32::window::cursor_position() else {
        return true;
    };
    cursor_near_stage(
        window_rect.left as f64,
        window_rect.top as f64,
        (window_rect.right - window_rect.left).max(1) as f64,
        (window_rect.bottom - window_rect.top).max(1) as f64,
        cursor.x as f64,
        cursor.y as f64,
    )
}
