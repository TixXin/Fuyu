use serde::Serialize;
use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::Duration,
};
use tauri::{Emitter, WebviewWindow};

use super::{
    banner_hit::{banner_rect, ISLAND_BANNER_HOVER_CHANGED_EVENT},
    geometry::{cursor_on_island, island_rect, stage_point, IslandOnScreen},
    state::{read_window_state, IslandMode},
};
use super::screen;
use crate::macos::input;

const ISLAND_HOVER_CHANGED_EVENT: &str = "island-hover-changed";
const ISLAND_HOLD_CHANGED_EVENT: &str = "island-hold-changed";
const ISLAND_MOVE_ARMED_CHANGED_EVENT: &str = "island-move-armed-changed";
const ISLAND_CURSOR_MOVED_EVENT: &str = "island-cursor-moved";
const CURSOR_EVENT_EVERY_TICKS: u32 = 3;
const TICK: Duration = Duration::from_millis(12);

static CURSOR_TRACKING: AtomicBool = AtomicBool::new(false);

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
    cursor_x: f64,
    cursor_y: f64,
}

#[tauri::command]
pub fn set_island_cursor_tracking(enabled: bool) {
    CURSOR_TRACKING.store(enabled, Ordering::Relaxed);
}

fn pointer(window: &WebviewWindow) -> Option<Pointer> {
    let position = screen::window_position(window).ok()?;
    let size = screen::window_size(window).ok()?;
    let (cursor_x, cursor_y) = screen::cursor_position()?;
    Some(Pointer {
        left: f64::from(position.x),
        top: f64::from(position.y),
        width: f64::from(size.width.max(1)),
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
        let mut was_held = false;
        let mut was_move_armed = false;
        let mut tick: u32 = 0;
        let mut last_cursor: Option<CursorPoint> = None;

        loop {
            let pointer = pointer(&window);
            let is_inside = pointer.is_none_or(|pointer| {
                cursor_on_island(pointer.left, pointer.top, pointer.width, pointer.cursor_x, pointer.cursor_y, read_window_state())
            });
            let is_on_banner = pointer.is_some_and(on_banner);
            let should_ignore = !is_inside && !is_on_banner;

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

            let option = input::is_option_key_down();
            let state = read_window_state();
            let move_armed = is_inside && option && !state.is_tucked;
            if move_armed != was_move_armed {
                was_move_armed = move_armed;
                let _ = window.emit(ISLAND_MOVE_ARMED_CHANGED_EVENT, if move_armed { "move" } else { "none" });
            }
            let held = option && matches!(state.mode, IslandMode::Expanded);
            if held != was_held {
                was_held = held;
                let _ = window.emit(ISLAND_HOLD_CHANGED_EVENT, held);
            }

            tick = tick.wrapping_add(1);
            if !CURSOR_TRACKING.load(Ordering::Relaxed) {
                last_cursor = None;
            } else if tick.is_multiple_of(CURSOR_EVENT_EVERY_TICKS) {
                let point = pointer.map(stage_cursor);
                if point.is_some() && point != last_cursor {
                    last_cursor = point;
                    let _ = window.emit(ISLAND_CURSOR_MOVED_EVENT, point);
                }
            }

            thread::sleep(TICK);
        }
    });
}
