use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex, PoisonError,
    },
    thread,
    time::Duration,
};

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewWindow};

use super::drag_grid_window::{self, GridSlot};
use super::geometry::apply_stage_geometry;
use super::screen;
use super::state::{mutate_window_state, read_window_state};
use crate::taskbar_host::{self, DockState, Rect};
use crate::win32::{input, window as win};

const STEP: Duration = Duration::from_millis(16);

#[derive(Clone, Copy)]
struct Drag {
    grab: i32,
    at: (i32, i32),
    width: i32,
}

static DRAG: Mutex<Option<Drag>> = Mutex::new(None);
static GENERATION: AtomicU64 = AtomicU64::new(0);
static STOPPED: AtomicU64 = AtomicU64::new(0);

pub(super) fn held_position() -> Option<(i32, i32)> {
    DRAG.lock().unwrap_or_else(PoisonError::into_inner).map(|drag| drag.at)
}

pub(super) fn along(bar: Rect, center: i32) -> Option<f64> {
    let width = bar.right - bar.left;
    (width > 0).then(|| (f64::from(center - bar.left) / f64::from(width)).clamp(0.0, 1.0))
}

fn slot_in(bar: Rect, rect: Rect) -> GridSlot {
    let (width, height) = (f64::from((bar.right - bar.left).max(1)), f64::from((bar.bottom - bar.top).max(1)));
    GridSlot {
        left: f64::from(rect.left - bar.left) / width,
        top: f64::from(rect.top - bar.top) / height,
        width: f64::from(rect.right - rect.left) / width,
        height: f64::from(rect.bottom - rect.top) / height,
    }
}

fn area(bar: Rect) -> (i32, i32, i32, i32) {
    (bar.left, bar.top, bar.right - bar.left, bar.bottom - bar.top)
}

pub(super) fn start(window: &WebviewWindow) -> Result<(), String> {
    if !super::taskbar::wanted(read_window_state()) {
        return Err("The island is not docked to the taskbar.".to_string());
    }
    let cursor = win::cursor_position().ok_or_else(|| "Could not read the pointer.".to_string())?;
    let position = screen::window_position(window)?;
    let width = screen::window_size(window)?.width as i32;
    *DRAG.lock().unwrap_or_else(PoisonError::into_inner) = Some(Drag { grab: cursor.x - position.x, at: (position.x, position.y), width });
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let window = window.clone();
    thread::spawn(move || follow(window, generation));
    Ok(())
}

pub(super) fn stop() {
    STOPPED.store(GENERATION.load(Ordering::SeqCst), Ordering::SeqCst);
}

fn follow(window: WebviewWindow, generation: u64) {
    loop {
        thread::sleep(STEP);
        if GENERATION.load(Ordering::SeqCst) != generation {
            return;
        }
        if STOPPED.load(Ordering::SeqCst) == generation || !input::is_left_button_down() {
            break;
        }
        let Some(drag) = *DRAG.lock().unwrap_or_else(PoisonError::into_inner) else {
            return;
        };
        let Some(cursor) = win::cursor_position() else {
            continue;
        };
        let x = cursor.x - drag.grab;
        if x != drag.at.0 {
            if let Some(slot) = DRAG.lock().unwrap_or_else(PoisonError::into_inner).as_mut() {
                slot.at.0 = x;
            }
            let _ = screen::set_window_position(&window, PhysicalPosition::new(x, drag.at.1));
        }
        let dock = taskbar_host::current(&window);
        if let Some(bar) = dock.and_then(|dock| dock.bar) {
            taskbar_host::set_preferred(&window, along(bar, x + drag.width / 2));
            drag_grid_window::present_slot(window.app_handle(), area(bar), dock.and_then(|dock| dock.rect).map(|rect| slot_in(bar, rect)));
        }
    }
    finish(&window);
}

fn landed(dock: Option<DockState>) -> Option<f64> {
    let dock = dock?;
    along(dock.bar?, dock.rect.map(|rect| (rect.left + rect.right) / 2)?)
}

fn finish(window: &WebviewWindow) {
    if DRAG.lock().unwrap_or_else(PoisonError::into_inner).take().is_none() {
        return;
    }
    let app: AppHandle = window.app_handle().clone();
    drag_grid_window::dismiss(&app);
    let along = landed(taskbar_host::current(window));
    taskbar_host::set_preferred(window, along);
    let state = mutate_window_state(|state| {
        if let (Some(position), Some(along)) = (state.custom_position.as_mut(), along) {
            position.along = Some(along);
        }
        *state
    });
    if let Some(position) = state.custom_position {
        let _ = window.emit(super::ISLAND_POSITION_CHANGED_EVENT, position);
    }
    if let Err(error) = apply_stage_geometry(window, state, true) {
        eprintln!("Failed to drop the island on the taskbar: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_position_is_a_share_of_the_bar_width() {
        let bar = Rect::new(1000, 2100, 3000, 2160);
        assert_eq!(along(bar, 2000), Some(0.5));
        assert_eq!(along(bar, 500), Some(0.0));
        assert_eq!(along(bar, 4000), Some(1.0));
        assert_eq!(along(Rect::new(0, 0, 0, 10), 5), None);
    }

    #[test]
    fn the_dashed_frame_is_placed_as_shares_of_the_bar() {
        let slot = slot_in(Rect::new(1000, 2100, 3000, 2160), Rect::new(1500, 2100, 1900, 2160));
        assert_eq!(slot, GridSlot { left: 0.25, top: 0.0, width: 0.2, height: 1.0 });
    }
}
