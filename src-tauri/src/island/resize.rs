use serde::Serialize;
use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, WebviewWindow};

use super::{
    geometry::stage_width,
    state::{read_window_state, Edge, IslandMode},
};

const ISLAND_RESIZE_EVENT: &str = "island-resize";
const POLL: Duration = Duration::from_millis(12);

static RESIZING: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResizeDelta {
    width: f64,
    height: f64,
    collapsed: bool,
    done: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(super) struct Drag {
    side: i8,
    height: bool,
    flipped: bool,
    per_px: f64,
    start: (f64, f64),
}

impl Drag {
    pub(super) fn delta(self, cursor: (f64, f64)) -> (f64, f64) {
        let width = f64::from(self.side) * 2.0 * (cursor.0 - self.start.0) / self.per_px;
        let pulled = if self.flipped { self.start.1 - cursor.1 } else { cursor.1 - self.start.1 };
        let height = if self.height { pulled / self.per_px } else { 0.0 };
        (width.round(), height.round())
    }
}

#[cfg(windows)]
fn window_width(window: &WebviewWindow) -> Option<f64> {
    let rect = crate::win32::window::window_rect(window.hwnd().ok()?)?;
    Some(f64::from((rect.right - rect.left).max(1)))
}

#[cfg(target_os = "macos")]
fn window_width(window: &WebviewWindow) -> Option<f64> {
    let size = super::screen::window_size(window).ok()?;
    Some(f64::from(size.width.max(1)))
}

pub(super) fn is_resizing() -> bool {
    RESIZING.load(Ordering::SeqCst)
}

fn drag_for(window: &WebviewWindow, width_sign: i8, height: bool) -> Option<(Drag, bool)> {
    let state = read_window_state();
    if state.is_tucked || state.side().is_some() {
        return None;
    }
    let collapsed = matches!(state.mode, IslandMode::Collapsed);
    let side = width_sign.clamp(-1, 1);
    let height = height && !collapsed;
    if side == 0 && !height {
        return None;
    }
    let per_px = window_width(window)? / stage_width() * state.active_scale();
    if !per_px.is_finite() || per_px <= 0.0 {
        return None;
    }
    let start = super::screen::cursor_position()?;
    let flipped = state.attached_edge == Some(Edge::Bottom);
    Some((Drag { side, height, flipped, per_px, start }, collapsed))
}

#[tauri::command]
pub fn start_island_resize(app: AppHandle, width_sign: i8, height: bool) -> Result<(), String> {
    let window = super::main_window(&app)?;
    let Some((drag, collapsed)) = drag_for(&window, width_sign, height) else {
        return Ok(());
    };
    if RESIZING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    thread::spawn(move || {
        let mut last = (0.0, 0.0);
        let now = || drag.delta(super::screen::cursor_position().unwrap_or(drag.start));
        while super::left_button_down() {
            let delta = now();
            if delta != last {
                last = delta;
                let _ = window.emit(ISLAND_RESIZE_EVENT, ResizeDelta { width: delta.0, height: delta.1, collapsed, done: false });
            }
            thread::sleep(POLL);
        }
        let (width, height) = now();
        let _ = window.emit(ISLAND_RESIZE_EVENT, ResizeDelta { width, height, collapsed, done: true });
        RESIZING.store(false, Ordering::SeqCst);
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::Drag;

    fn drag(side: i8, height: bool, flipped: bool) -> Drag {
        Drag { side, height, flipped, per_px: 2.0, start: (100.0, 100.0) }
    }

    #[test]
    fn width_grows_on_both_sides_from_whichever_edge_is_pulled() {
        assert_eq!(drag(1, false, false).delta((120.0, 140.0)), (20.0, 0.0));
        assert_eq!(drag(-1, false, false).delta((80.0, 100.0)), (20.0, 0.0));
        assert_eq!(drag(-1, false, false).delta((120.0, 100.0)), (-20.0, 0.0));
    }

    #[test]
    fn height_follows_the_free_edge() {
        assert_eq!(drag(0, true, false).delta((100.0, 140.0)), (0.0, 20.0));
        assert_eq!(drag(0, true, true).delta((100.0, 60.0)), (0.0, 20.0));
        assert_eq!(drag(1, true, false).delta((110.0, 110.0)), (10.0, 5.0));
    }
}
