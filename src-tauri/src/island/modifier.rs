//! Alt + left-button drag on the island (C25): from its edge, the expanded panel's width or height
//! changes; from anywhere else, the island moves (mod.rs drag_island). The passthrough loop asks
//! `target` while Alt is held, so the page can show the matching cursor.

use serde::Serialize;
use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::Duration,
};
use tauri::{Emitter, WebviewWindow};
use windows::Win32::Foundation::HWND;

use super::{
    geometry::STAGE_WINDOW_WIDTH,
    state::{read_window_state, IslandMode},
};
use crate::win32;

/// Mirrored by ISLAND_RESIZE_EVENT in src/windows/island/api.ts. The payload is how much wider
/// and taller (island px, before the scale) the panel is than when the drag began.
const ISLAND_RESIZE_EVENT: &str = "island-resize";
/// How far in from the left, right and bottom edges (island px) a press resizes.
const EDGE: f64 = 12.0;

static RESIZING: AtomicBool = AtomicBool::new(false);

/// What an Alt press at the cursor does. Mirrored by IslandModifierTarget in api.ts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ModifierTarget {
    None,
    Move,
    /// The left or right edge: the width (the island stays centred, so both sides move).
    Width,
    Height,
    /// A bottom corner: both.
    Both,
}

/// Which edges a point at `(x, y)` from the island's top-left corner, on an island `width` x
/// `height` (all island px), is on: the side it widens towards (-1 left, 1 right, 0 none) and
/// whether it is on the bottom edge.
pub(super) fn edges_at(x: f64, y: f64, width: f64, height: f64) -> (i8, bool) {
    let side = if x < EDGE {
        -1
    } else if x > width - EDGE {
        1
    } else {
        0
    };
    (side, y > height - EDGE)
}

fn target_for(side: i8, bottom: bool) -> ModifierTarget {
    match (side != 0, bottom) {
        (true, true) => ModifierTarget::Both,
        (true, false) => ModifierTarget::Width,
        (false, true) => ModifierTarget::Height,
        (false, false) => ModifierTarget::Move,
    }
}

/// The cursor relative to the island's top-left, in island px, with the island's size and the
/// physical pixels per island px.
fn cursor_on_island(hwnd: HWND) -> Option<(f64, f64, f64, f64, f64)> {
    let window_rect = win32::window::window_rect(hwnd)?;
    let cursor = win32::window::cursor_position()?;
    let state = read_window_state();
    let window_width = (window_rect.right - window_rect.left).max(1) as f64;
    let per_px = window_width / STAGE_WINDOW_WIDTH * state.active_scale();
    let (width, height) = state.mode.base_size(state.collapsed_width, state.expanded_width, state.expanded_height);
    let left = (window_width - width * per_px) / 2.0;
    let x = ((cursor.x - window_rect.left) as f64 - left) / per_px;
    let y = (cursor.y - window_rect.top) as f64 / per_px;
    Some((x, y, width, height, per_px))
}

/// What an Alt press would do, with the cursor already known to be over the island.
pub(super) fn target(hwnd: HWND) -> ModifierTarget {
    let state = read_window_state();
    if state.is_tucked {
        return ModifierTarget::None;
    }
    if !matches!(state.mode, IslandMode::Expanded) {
        return ModifierTarget::Move;
    }
    cursor_on_island(hwnd).map_or(ModifierTarget::Move, |(x, y, width, height, _)| {
        let (side, bottom) = edges_at(x, y, width, height);
        target_for(side, bottom)
    })
}

/// A resize under way: the island stays open even with Alt let go (useIslandHold.ts).
pub(super) fn is_resizing() -> bool {
    RESIZING.load(Ordering::SeqCst)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResizeDelta {
    width: f64,
    height: f64,
    done: bool,
}

/// Starts a resize when the cursor is on an edge of the expanded panel; returns whether it did.
/// Until the left button goes up, the page hears how far the panel grew and sets the size.
pub(super) fn start_resize(window: &WebviewWindow) -> bool {
    let Ok(hwnd) = window.hwnd() else {
        return false;
    };
    let state = read_window_state();
    if state.is_tucked || !matches!(state.mode, IslandMode::Expanded) || RESIZING.load(Ordering::SeqCst) {
        return false;
    }
    let Some((x, y, width, height, per_px)) = cursor_on_island(hwnd) else {
        return false;
    };
    let (side, bottom) = edges_at(x, y, width, height);
    if side == 0 && !bottom {
        return false;
    }
    let Some(start) = win32::window::cursor_position() else {
        return false;
    };
    RESIZING.store(true, Ordering::SeqCst);
    let window = window.clone();
    thread::spawn(move || {
        let mut last = (0.0, 0.0);
        let delta = || {
            let cursor = win32::window::cursor_position().unwrap_or(start);
            let width = f64::from(side) * 2.0 * f64::from(cursor.x - start.x) / per_px;
            let height = if bottom { f64::from(cursor.y - start.y) / per_px } else { 0.0 };
            (width.round(), height.round())
        };
        while win32::input::is_left_button_down() {
            let now = delta();
            if now != last {
                last = now;
                let _ = window.emit(ISLAND_RESIZE_EVENT, ResizeDelta { width: now.0, height: now.1, done: false });
            }
            thread::sleep(Duration::from_millis(12));
        }
        let (width, height) = delta();
        let _ = window.emit(ISLAND_RESIZE_EVENT, ResizeDelta { width, height, done: true });
        RESIZING.store(false, Ordering::SeqCst);
    });
    true
}

#[cfg(test)]
mod tests {
    use super::{edges_at, target_for, ModifierTarget};

    #[test]
    fn edges_pick_what_an_alt_drag_changes() {
        let at = |x, y| {
            let (side, bottom) = edges_at(x, y, 560.0, 400.0);
            target_for(side, bottom)
        };
        assert_eq!(at(280.0, 200.0), ModifierTarget::Move);
        assert_eq!(at(4.0, 200.0), ModifierTarget::Width);
        assert_eq!(at(556.0, 200.0), ModifierTarget::Width);
        assert_eq!(at(280.0, 395.0), ModifierTarget::Height);
        assert_eq!(at(556.0, 395.0), ModifierTarget::Both);
        assert_eq!(edges_at(4.0, 10.0, 560.0, 400.0), (-1, false));
        assert_eq!(edges_at(556.0, 10.0, 560.0, 400.0), (1, false));
    }
}
