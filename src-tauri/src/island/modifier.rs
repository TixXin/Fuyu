//! Alt + left-button drag on the island (C25): from its edge, the expanded panel's width or height
//! changes, or the collapsed island's width; from anywhere else, the island moves (mod.rs
//! drag_island). The passthrough loop asks `target` while Alt is held, so the page can show the
//! matching cursor and hint lines.

use serde::Serialize;
use std::{
    sync::atomic::{AtomicBool, AtomicU8, Ordering},
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
/// and taller (island px, before the scale) the island is than when the drag began.
const ISLAND_RESIZE_EVENT: &str = "island-resize";
/// How far in from the left, right and bottom edges (island px) a press resizes.
const EDGE: f64 = 12.0;

static RESIZING: AtomicBool = AtomicBool::new(false);
/// The edge being dragged while RESIZING, as `ModifierTarget::to_u8`.
static RESIZE_TARGET: AtomicU8 = AtomicU8::new(0);

/// What an Alt press at the cursor does. Mirrored by IslandModifierTarget in api.ts. The side is
/// kept so the page can light the edge under the cursor; the width always changes on both sides,
/// as the island stays centred.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ModifierTarget {
    None,
    Move,
    /// The left edge: the width.
    Left,
    /// The right edge: the width.
    Right,
    /// The bottom edge: the height.
    Bottom,
    /// A bottom corner, as far up and in as its rounding goes: both.
    BottomLeft,
    BottomRight,
}

impl ModifierTarget {
    fn to_u8(self) -> u8 {
        self as u8
    }

    fn from_u8(value: u8) -> Self {
        [Self::None, Self::Move, Self::Left, Self::Right, Self::Bottom, Self::BottomLeft, Self::BottomRight]
            .get(usize::from(value))
            .copied()
            .unwrap_or(Self::None)
    }
}

/// Which edges a point at `(x, y)` from the island's top-left corner, on an island `width` x
/// `height` with bottom corners rounded by `corner` (all island px), is on: the side it widens
/// towards (-1 left, 1 right, 0 none) and whether it is on the bottom edge. Within a bottom
/// corner's rounding, a point on either edge counts as on both, so the whole curve resizes both
/// ways, as the hint line drawn along it says.
pub(super) fn edges_at(x: f64, y: f64, width: f64, height: f64, corner: f64) -> (i8, bool) {
    let mut side = if x < EDGE {
        -1
    } else if x > width - EDGE {
        1
    } else {
        0
    };
    let mut bottom = y > height - EDGE;
    if (side != 0 || bottom) && y > height - corner && (x < corner || x > width - corner) {
        side = if x < width / 2.0 { -1 } else { 1 };
        bottom = true;
    }
    (side, bottom)
}

fn target_for(side: i8, bottom: bool) -> ModifierTarget {
    match (side, bottom) {
        (-1, true) => ModifierTarget::BottomLeft,
        (1, true) => ModifierTarget::BottomRight,
        (-1, false) => ModifierTarget::Left,
        (1, false) => ModifierTarget::Right,
        (_, true) => ModifierTarget::Bottom,
        _ => ModifierTarget::Move,
    }
}

/// The edges under the cursor: the expanded panel's sides and bottom, the collapsed island's
/// sides only (it is too low to spare a bottom edge from moving it), with the physical pixels per
/// island px.
fn edges_under_cursor(hwnd: HWND) -> Option<(i8, bool, f64)> {
    let window_rect = win32::window::window_rect(hwnd)?;
    let cursor = win32::window::cursor_position()?;
    let state = read_window_state();
    let window_width = (window_rect.right - window_rect.left).max(1) as f64;
    let per_px = window_width / STAGE_WINDOW_WIDTH * state.active_scale();
    let (width, height) = state.mode.base_size(state.collapsed_width, state.expanded_width, state.expanded_height);
    let left = (window_width - width * per_px) / 2.0;
    let x = ((cursor.x - window_rect.left) as f64 - left) / per_px;
    let y = (cursor.y - window_rect.top) as f64 / per_px;
    let (side, bottom) = match state.mode {
        IslandMode::Expanded => edges_at(x, y, width, height, state.bottom_corner_radius()),
        IslandMode::Collapsed => (edges_at(x, y, width, height, 0.0).0, false),
    };
    Some((side, bottom, per_px))
}

/// What an Alt press would do, with the cursor already known to be over the island.
pub(super) fn target(hwnd: HWND) -> ModifierTarget {
    if read_window_state().is_tucked {
        return ModifierTarget::None;
    }
    edges_under_cursor(hwnd).map_or(ModifierTarget::Move, |(side, bottom, _)| target_for(side, bottom))
}

/// A resize under way: the island stays open even with Alt let go (useIslandHold.ts).
pub(super) fn is_resizing() -> bool {
    RESIZING.load(Ordering::SeqCst)
}

/// The edge being dragged, reported in place of `target` until the button goes up, so its hint
/// stays lit wherever the cursor goes and whether or not Alt is still held.
pub(super) fn resize_target() -> ModifierTarget {
    ModifierTarget::from_u8(RESIZE_TARGET.load(Ordering::SeqCst))
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResizeDelta {
    width: f64,
    height: f64,
    /// The collapsed island's width is changing, not the panel's.
    collapsed: bool,
    done: bool,
}

/// Starts a resize when the cursor is on a resizable edge; returns whether it did. Until the left
/// button goes up, the page hears how far the island grew and sets the size.
pub(super) fn start_resize(window: &WebviewWindow) -> bool {
    let Ok(hwnd) = window.hwnd() else {
        return false;
    };
    let state = read_window_state();
    if state.is_tucked || RESIZING.load(Ordering::SeqCst) {
        return false;
    }
    let collapsed = matches!(state.mode, IslandMode::Collapsed);
    let Some((side, bottom, per_px)) = edges_under_cursor(hwnd) else {
        return false;
    };
    if side == 0 && !bottom {
        return false;
    }
    let Some(start) = win32::window::cursor_position() else {
        return false;
    };
    RESIZE_TARGET.store(target_for(side, bottom).to_u8(), Ordering::SeqCst);
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
                let _ = window.emit(ISLAND_RESIZE_EVENT, ResizeDelta { width: now.0, height: now.1, collapsed, done: false });
            }
            thread::sleep(Duration::from_millis(12));
        }
        let (width, height) = delta();
        let _ = window.emit(ISLAND_RESIZE_EVENT, ResizeDelta { width, height, collapsed, done: true });
        RESIZING.store(false, Ordering::SeqCst);
        RESIZE_TARGET.store(ModifierTarget::None.to_u8(), Ordering::SeqCst);
    });
    true
}

#[cfg(test)]
mod tests {
    use super::{edges_at, target_for, ModifierTarget};

    #[test]
    fn edges_pick_what_an_alt_drag_changes() {
        let at = |x, y| {
            let (side, bottom) = edges_at(x, y, 560.0, 400.0, 30.0);
            target_for(side, bottom)
        };
        assert_eq!(at(280.0, 200.0), ModifierTarget::Move);
        assert_eq!(at(4.0, 200.0), ModifierTarget::Left);
        assert_eq!(at(556.0, 200.0), ModifierTarget::Right);
        assert_eq!(at(280.0, 395.0), ModifierTarget::Bottom);
        assert_eq!(at(556.0, 395.0), ModifierTarget::BottomRight);
        assert_eq!(at(4.0, 395.0), ModifierTarget::BottomLeft);
        assert_eq!(edges_at(4.0, 10.0, 560.0, 400.0, 30.0), (-1, false));
        assert_eq!(edges_at(556.0, 10.0, 560.0, 400.0, 30.0), (1, false));
    }

    #[test]
    fn the_whole_bottom_corner_resizes_both_ways() {
        let at = |x, y| {
            let (side, bottom) = edges_at(x, y, 560.0, 400.0, 30.0);
            target_for(side, bottom)
        };
        // On the side edge, but within the rounding: both.
        assert_eq!(at(6.0, 380.0), ModifierTarget::BottomLeft);
        // On the bottom edge, within the rounding: both.
        assert_eq!(at(540.0, 394.0), ModifierTarget::BottomRight);
        // Above the rounding, and past it along the bottom: one way.
        assert_eq!(at(6.0, 360.0), ModifierTarget::Left);
        assert_eq!(at(500.0, 394.0), ModifierTarget::Bottom);
        // Inside the corner but off every edge: a move.
        assert_eq!(at(20.0, 380.0), ModifierTarget::Move);
    }

    #[test]
    fn targets_round_trip_through_the_atomic() {
        for target in [
            ModifierTarget::None,
            ModifierTarget::Move,
            ModifierTarget::Left,
            ModifierTarget::Right,
            ModifierTarget::Bottom,
            ModifierTarget::BottomLeft,
            ModifierTarget::BottomRight,
        ] {
            assert_eq!(ModifierTarget::from_u8(target.to_u8()), target);
        }
    }
}
