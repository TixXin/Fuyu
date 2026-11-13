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
    geometry::{cursor_on_island, island_rect, stage_point, IslandOnScreen},
    state::{read_window_state, IslandMode},
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
    Some(island_rect(window_rect.left as f64, window_rect.top as f64, window_width, read_window_state()))
}

pub(super) fn cursor_is_inside_island(hwnd: HWND) -> bool {
    let Some(window_rect) = win32::window::window_rect(hwnd) else {
        return true;
    };
    let Some(cursor) = win32::window::cursor_position() else {
        return true;
    };

    cursor_on_island(
        window_rect.left as f64,
        window_rect.top as f64,
        (window_rect.right - window_rect.left).max(1) as f64,
        cursor.x as f64,
        cursor.y as f64,
        read_window_state(),
    )
}
