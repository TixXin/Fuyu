//! Pins (C41.4): a screenshot kept on top of everything in its own small window, where it was
//! taken, at the same size. Several can be open at once; each can be dragged, zoomed, faded, made
//! click-through, copied, saved and closed. Their pictures stay in memory until they close.

use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex, MutexGuard, PoisonError,
    },
};

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use super::output::Picture;

/// Pin windows are `pin-<number>`.
pub(crate) const WINDOW_PREFIX: &str = "pin-";
/// Zooming stops at these scales of the picture's own size.
const MIN_SCALE: f64 = 0.1;
const MAX_SCALE: f64 = 8.0;
/// The smallest a zoomed pin gets, in physical pixels, so it can still be grabbed.
const MIN_SIDE: f64 = 16.0;

static PINS: Mutex<BTreeMap<String, Arc<Picture>>> = Mutex::new(BTreeMap::new());
static NEXT_ID: AtomicU64 = AtomicU64::new(1);
/// All pins are hidden (T); a new pin shows them again.
static HIDDEN: AtomicBool = AtomicBool::new(false);

fn pins() -> MutexGuard<'static, BTreeMap<String, Arc<Picture>>> {
    PINS.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Pins `picture` with its top-left at `at` on the virtual screen (physical pixels). It shows once
/// its page has drawn the picture (`ready`).
pub(super) fn open(app: &AppHandle, picture: Picture, at: (i32, i32)) -> Result<(), String> {
    if HIDDEN.swap(false, Ordering::SeqCst) {
        set_all_visible(app, true);
    }
    let label = format!("{WINDOW_PREFIX}{}", NEXT_ID.fetch_add(1, Ordering::SeqCst));
    let (width, height) = (picture.width, picture.height);
    pins().insert(label.clone(), Arc::new(picture));
    let url = format!("index.html?window=pin&width={width}&height={height}");
    let built = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
        .title("Fuyu")
        // Transparent so the page can fade the picture (Ctrl + wheel).
        .transparent(true)
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .visible(false)
        .build();
    let window = match built {
        Ok(window) => window,
        Err(error) => {
            pins().remove(&label);
            return Err(error.to_string());
        }
    };
    // Position first: moving onto a monitor of another scale makes Windows resize the window.
    window.set_position(PhysicalPosition::new(at.0, at.1)).map_err(|error| error.to_string())?;
    window.set_size(PhysicalSize::new(width, height)).map_err(|error| error.to_string())?;
    Ok(())
}

/// The picture of the pin `label`: RGBA rows, its size in the page's URL.
pub(super) fn picture(label: &str) -> Option<Arc<Picture>> {
    pins().get(label).cloned()
}

/// The pin has drawn its picture: show it, with the keyboard.
pub(super) fn ready(window: &WebviewWindow) {
    if HIDDEN.load(Ordering::SeqCst) {
        return;
    }
    let _ = window.show();
    let _ = window.set_focus();
}

/// The pin window went away (closed from its menu, Esc or Alt+F4): let go of its picture.
pub(crate) fn forget(label: &str) {
    pins().remove(label);
}

/// Zooms the pin to `scale` of its picture's size, keeping the point at `anchor` (fractions of
/// the window, 0 to 1) where it is on the screen.
pub(super) fn zoom(window: &WebviewWindow, scale: f64, anchor: (f64, f64)) -> Result<(), String> {
    let picture = picture(window.label()).ok_or_else(|| "This pin is closed.".to_string())?;
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let (x, y, width, height) = zoomed((position.x, position.y), (size.width, size.height), (picture.width, picture.height), scale, anchor);
    window.set_position(PhysicalPosition::new(x, y)).map_err(|error| error.to_string())?;
    window.set_size(PhysicalSize::new(width, height)).map_err(|error| error.to_string())
}

/// Where a pin at `position` and `size` goes when its `picture` is shown at `scale`, `anchor`
/// staying put: (x, y, width, height).
pub(super) fn zoomed(position: (i32, i32), size: (u32, u32), picture: (u32, u32), scale: f64, anchor: (f64, f64)) -> (i32, i32, u32, u32) {
    let scale = if scale.is_finite() { scale.clamp(MIN_SCALE, MAX_SCALE) } else { 1.0 };
    let (fx, fy) = (anchor.0.clamp(0.0, 1.0), anchor.1.clamp(0.0, 1.0));
    let width = (f64::from(picture.0) * scale).round().max(MIN_SIDE);
    let height = (f64::from(picture.1) * scale).round().max(MIN_SIDE);
    let x = f64::from(position.0) + f64::from(size.0) * fx - width * fx;
    let y = f64::from(position.1) + f64::from(size.1) * fy - height * fy;
    (x.round() as i32, y.round() as i32, width as u32, height as u32)
}

/// Lets clicks pass through the pin to what is under it. Hiding and showing all pins (T) makes
/// them take clicks again, since a click-through pin cannot be clicked to turn it off.
pub(super) fn click_through(window: &WebviewWindow, through: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(through).map_err(|error| error.to_string())
}

fn pin_windows(app: &AppHandle) -> Vec<WebviewWindow> {
    app.webview_windows().into_iter().filter(|(label, _)| label.starts_with(WINDOW_PREFIX)).map(|(_, window)| window).collect()
}

fn set_all_visible(app: &AppHandle, visible: bool) {
    for window in pin_windows(app) {
        if visible {
            let _ = window.set_ignore_cursor_events(false);
            let _ = window.show();
        } else {
            let _ = window.hide();
        }
    }
}

/// Hides every pin, or shows them all again (taking clicks again). Nothing without pins.
pub(super) fn toggle_all(app: &AppHandle) {
    if pin_windows(app).is_empty() {
        HIDDEN.store(false, Ordering::SeqCst);
        return;
    }
    let hide = !HIDDEN.load(Ordering::SeqCst);
    HIDDEN.store(hide, Ordering::SeqCst);
    set_all_visible(app, !hide);
}

pub(super) fn close(window: &WebviewWindow) {
    forget(window.label());
    let _ = window.destroy();
}

pub(super) fn close_all(app: &AppHandle) {
    for window in pin_windows(app) {
        close(&window);
    }
    HIDDEN.store(false, Ordering::SeqCst);
}
