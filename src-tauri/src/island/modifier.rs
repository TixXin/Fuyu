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

const ISLAND_RESIZE_EVENT: &str = "island-resize";
const EDGE: f64 = 12.0;

static RESIZING: AtomicBool = AtomicBool::new(false);
static PANEL_RESIZABLE: AtomicBool = AtomicBool::new(true);
static RESIZE_TARGET: AtomicU8 = AtomicU8::new(0);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ModifierTarget {
    None,
    Move,
    Left,
    Right,
    Bottom,
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
        IslandMode::Expanded if !PANEL_RESIZABLE.load(Ordering::SeqCst) => (0, false),
        IslandMode::Expanded => edges_at(x, y, width, height, state.bottom_corner_radius()),
        IslandMode::Collapsed => (edges_at(x, y, width, height, 0.0).0, false),
    };
    Some((side, bottom, per_px))
}

#[tauri::command]
pub fn set_island_panel_resizable(resizable: bool) {
    PANEL_RESIZABLE.store(resizable, Ordering::SeqCst);
}

pub(super) fn target(hwnd: HWND) -> ModifierTarget {
    if read_window_state().is_tucked {
        return ModifierTarget::None;
    }
    edges_under_cursor(hwnd).map_or(ModifierTarget::Move, |(side, bottom, _)| target_for(side, bottom))
}

pub(super) fn is_resizing() -> bool {
    RESIZING.load(Ordering::SeqCst)
}

pub(super) fn resize_target() -> ModifierTarget {
    ModifierTarget::from_u8(RESIZE_TARGET.load(Ordering::SeqCst))
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResizeDelta {
    width: f64,
    height: f64,
    collapsed: bool,
    done: bool,
}

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
        assert_eq!(at(6.0, 380.0), ModifierTarget::BottomLeft);
        assert_eq!(at(540.0, 394.0), ModifierTarget::BottomRight);
        assert_eq!(at(6.0, 360.0), ModifierTarget::Left);
        assert_eq!(at(500.0, 394.0), ModifierTarget::Bottom);
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
