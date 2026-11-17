use std::{
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Mutex, PoisonError,
    },
    thread,
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WebviewWindowBuilder};

use super::screen;
use super::side::Rect;
use super::state::Edge;

pub(crate) const WINDOW_LABEL: &str = "drag-grid";
const STATE_EVENT: &str = "drag-grid-state";
const FADE_OUT: Duration = Duration::from_millis(160);

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DragGridState {
    visible: bool,
    lines: bool,
    snap: Option<Edge>,
}

static STATE: Mutex<DragGridState> = Mutex::new(DragGridState { visible: false, lines: true, snap: None });
static PLACED: Mutex<Option<Rect>> = Mutex::new(None);
static GENERATION: AtomicU64 = AtomicU64::new(0);
static LINES: AtomicBool = AtomicBool::new(true);

pub(super) fn set_lines(on: bool) {
    LINES.store(on, Ordering::SeqCst);
}

pub(super) fn lines() -> bool {
    LINES.load(Ordering::SeqCst)
}

pub(super) fn present(app: &AppHandle, work: Rect, snap: Option<Edge>) {
    GENERATION.fetch_add(1, Ordering::SeqCst);
    let state = DragGridState { visible: true, lines: lines(), snap };
    *STATE.lock().unwrap_or_else(PoisonError::into_inner) = state;
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let window = match grid_window(&handle) {
            Ok(window) => window,
            Err(error) => {
                eprintln!("could not open the drag grid: {error}");
                return;
            }
        };
        place(&window, work);
        reveal(&handle, &window);
        let _ = window.emit_to(WINDOW_LABEL, STATE_EVENT, state);
    });
}

pub(super) fn dismiss(app: &AppHandle) {
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let state = {
        let mut state = STATE.lock().unwrap_or_else(PoisonError::into_inner);
        state.visible = false;
        *state
    };
    let Some(window) = app.get_webview_window(WINDOW_LABEL) else {
        return;
    };
    let _ = window.emit_to(WINDOW_LABEL, STATE_EVENT, state);
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(FADE_OUT);
        if GENERATION.load(Ordering::SeqCst) != generation {
            return;
        }
        let _ = app.run_on_main_thread(move || {
            if GENERATION.load(Ordering::SeqCst) == generation {
                conceal(&window);
            }
        });
    });
}

fn grid_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        return Ok(window);
    }
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == WINDOW_LABEL)
        .ok_or_else(|| "The drag grid window config was not found.".to_string())?
        .clone();
    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| error.to_string())?
        .visible(false)
        .focused(false)
        .build()
        .map_err(|error| format!("Could not create the drag grid window: {error}"))?;
    let _ = window.set_ignore_cursor_events(true);
    #[cfg(target_os = "macos")]
    crate::macos::drag_grid::make_grid_panel(&window)?;
    *PLACED.lock().unwrap_or_else(PoisonError::into_inner) = None;
    Ok(window)
}

fn place(window: &WebviewWindow, (left, top, width, height): Rect) {
    let mut placed = PLACED.lock().unwrap_or_else(PoisonError::into_inner);
    if *placed == Some((left, top, width, height)) {
        return;
    }
    let size = PhysicalSize::new(width.max(1) as u32, height.max(1) as u32);
    let _ = screen::set_window_position(window, PhysicalPosition::new(left, top));
    let _ = screen::set_window_size(window, size);
    let _ = screen::set_window_position(window, PhysicalPosition::new(left, top));
    *placed = Some((left, top, width, height));
}

#[cfg(windows)]
fn reveal(app: &AppHandle, window: &WebviewWindow) {
    let island = app.get_webview_window(super::WINDOW_LABEL).and_then(|island| island.hwnd().ok());
    let shown = match (window.hwnd(), island) {
        (Ok(grid), Some(island)) => crate::win32::z_order::show_below(grid, island),
        _ => false,
    };
    if !shown {
        let _ = window.show();
    }
}

#[cfg(target_os = "macos")]
fn reveal(_app: &AppHandle, window: &WebviewWindow) {
    if !crate::macos::drag_grid::show_grid_panel(window) {
        let _ = window.show();
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
fn reveal(_app: &AppHandle, window: &WebviewWindow) {
    let _ = window.show();
}

fn conceal(window: &WebviewWindow) {
    #[cfg(target_os = "macos")]
    crate::macos::drag_grid::hide_grid_panel(window);
    let _ = window.destroy();
}

#[tauri::command]
pub fn get_drag_grid_state() -> DragGridState {
    *STATE.lock().unwrap_or_else(PoisonError::into_inner)
}
