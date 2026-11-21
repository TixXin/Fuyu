use serde::Serialize;
use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
};
use tauri::{AppHandle, Emitter, WebviewWindow};

use super::{
    banner_hit::{banner_rect, ISLAND_BANNER_HOVER_CHANGED_EVENT},
    modifier::{self, ModifierTarget},
    geometry::{
        cursor_near_island, cursor_near_stage, cursor_on_island, gaze_cursor_point, island_rect,
        hover_inside, passthrough_sleep_duration, should_ignore_cursor, stage_point, DimWakeTracker, IslandOnScreen,
    },
    state::{mutate_window_state, read_window_state, IslandMode},
    ISLAND_DIM_WAKE_EVENT,
};
use super::screen;
use crate::macos::input;

const ISLAND_HOVER_CHANGED_EVENT: &str = "island-hover-changed";
const ISLAND_HOLD_CHANGED_EVENT: &str = "island-hold-changed";
const ISLAND_MOVE_ARMED_CHANGED_EVENT: &str = "island-move-armed-changed";
const ISLAND_CURSOR_MOVED_EVENT: &str = "island-cursor-moved";
const ISLAND_HIDE_HINTS_EVENT: &str = "island-hide-hints";
const CURSOR_EVENT_EVERY_TICKS: u32 = 3;

static CURSOR_TRACKING: AtomicBool = AtomicBool::new(false);
static HINTS_POSSIBLE: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
struct CursorPoint {
    x: f64,
    y: f64,
}

#[derive(Debug, Clone, Copy)]
struct Pointer {
    left: f64,
    top: f64,
    width: f64,
    height: f64,
    cursor_x: f64,
    cursor_y: f64,
}

#[tauri::command]
pub fn set_island_cursor_tracking(enabled: bool) {
    CURSOR_TRACKING.store(enabled, Ordering::Relaxed);
}

pub(crate) fn hide_transient_hints(app: &AppHandle) -> bool {
    let Ok(window) = super::main_window(app) else {
        return false;
    };
    let _ = window.emit(ISLAND_HIDE_HINTS_EVENT, ());
    HINTS_POSSIBLE.load(Ordering::SeqCst)
}

fn pointer(window: &WebviewWindow) -> Option<Pointer> {
    let position = screen::window_position(window).ok()?;
    let size = screen::window_size(window).ok()?;
    let (cursor_x, cursor_y) = screen::cursor_position()?;
    Some(Pointer {
        left: f64::from(position.x),
        top: f64::from(position.y),
        width: f64::from(size.width.max(1)),
        height: f64::from(size.height.max(1)),
        cursor_x,
        cursor_y,
    })
}

pub(crate) fn island_on_screen(window: &WebviewWindow) -> Option<IslandOnScreen> {
    let position = screen::window_position(window).ok()?;
    let size = screen::window_size(window).ok()?;
    Some(island_rect(
        f64::from(position.x),
        f64::from(position.y),
        f64::from(size.width.max(1)),
        f64::from(size.height.max(1)),
        read_window_state(),
    ))
}

fn stage_cursor(pointer: Pointer) -> CursorPoint {
    let (x, y) = stage_point(pointer.left, pointer.top, pointer.width, pointer.cursor_x, pointer.cursor_y);
    CursorPoint { x, y }
}

fn on_banner(pointer: Pointer) -> bool {
    let Some(rect) = banner_rect() else {
        return false;
    };
    let state = read_window_state();
    if !matches!(state.mode, IslandMode::Collapsed) || state.is_tucked {
        return false;
    }
    let point = stage_cursor(pointer);
    rect.contains(point.x, point.y)
}

pub(crate) fn start_cursor_passthrough_loop(window: WebviewWindow) {
    thread::spawn(move || {
        let mut ignoring_cursor = false;
        let mut was_inside = false;
        let mut was_on_banner = false;
        let mut was_move_armed = ModifierTarget::None;
        let mut was_held = false;
        let mut tick: u32 = 0;
        let mut last_cursor: Option<CursorPoint> = None;
        let mut dim_wake = DimWakeTracker::default();

        loop {
            if !window.is_visible().unwrap_or(true) {
                dim_wake = DimWakeTracker::default();
                thread::sleep(passthrough_sleep_duration(false, false));
                continue;
            }
            let mut state = read_window_state();
            let pointer = pointer(&window);
            let raw_inside = pointer.map_or(!state.dimmed_passthrough(), |pointer| {
                cursor_on_island(pointer.left, pointer.top, pointer.width, pointer.height, pointer.cursor_x, pointer.cursor_y, state)
            });
            let is_near_island = raw_inside
                || pointer.is_some_and(|pointer| {
                    cursor_near_island(pointer.left, pointer.top, pointer.width, pointer.height, pointer.cursor_x, pointer.cursor_y, state)
                });
            let raw_cursor = pointer.map(|pointer| (pointer.cursor_x, pointer.cursor_y));
            if dim_wake.poll(state.dimmed_passthrough(), is_near_island, raw_cursor) {
                state = mutate_window_state(|current| {
                    current.is_dimmed = false;
                    *current
                });
                let _ = window.emit(ISLAND_DIM_WAKE_EVENT, ());
            }
            let is_inside = hover_inside(state, raw_inside);
            let is_on_banner = pointer.is_some_and(on_banner);
            let should_ignore = should_ignore_cursor(state, raw_inside, is_on_banner);

            if should_ignore != ignoring_cursor && window.set_ignore_cursor_events(should_ignore).is_ok() {
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

            let is_move_armed = if modifier::is_resizing() {
                modifier::resize_target()
            } else if !is_inside || state.is_tucked {
                ModifierTarget::None
            } else if input::is_left_button_down() {
                was_move_armed
            } else {
                modifier::target(&window)
            };
            if is_move_armed != was_move_armed {
                was_move_armed = is_move_armed;
                let _ = window.emit(ISLAND_MOVE_ARMED_CHANGED_EVENT, is_move_armed);
            }
            let held = modifier::is_resizing();
            if held != was_held {
                was_held = held;
                let _ = window.emit(ISLAND_HOLD_CHANGED_EVENT, held);
            }

            HINTS_POSSIBLE.store(is_inside, Ordering::SeqCst);

            let near = pointer.is_none_or(|p| cursor_near_stage(p.left, p.top, p.width, p.height, p.cursor_x, p.cursor_y));
            tick = tick.wrapping_add(1);
            let tracking = CURSOR_TRACKING.load(Ordering::Relaxed);
            if !tracking || is_inside || state.is_tucked {
                last_cursor = None;
            } else if tick.is_multiple_of(CURSOR_EVENT_EVERY_TICKS) {
                let point = pointer.map(|p| {
                    let raw = stage_cursor(p);
                    let (x, y) = gaze_cursor_point((raw.x, raw.y), near);
                    CursorPoint { x, y }
                });
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

