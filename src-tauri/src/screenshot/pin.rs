//! Pins (C41.4): a screenshot kept on top of everything in its own small window, where it was
//! taken, at the same size. Several can be open at once; each can be dragged, zoomed, faded, made
//! click-through, copied, saved and closed. Their pictures stay in memory until they close.
//!
//! Pinning has to feel instant, so one pin window is kept ready, hidden, like the screenshot
//! overlays: a new WebView takes a few hundred milliseconds. The frozen screenshot stays up until
//! the pin has drawn its picture, then the two swap at once and the selection seems to lift off
//! the screen. The window is a little larger than the picture, for the pin's shadow.

use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex, MutexGuard, PoisonError,
    },
    thread,
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use super::{output::Picture, session};
use crate::win32;

/// Pin windows are `pin-<number>`.
pub(crate) const WINDOW_PREFIX: &str = "pin-";
/// Mirrored by `PIN_ASSIGNED_EVENT` in src/features/screenshot/api.ts: the ready pin window got a
/// picture to show.
const ASSIGNED_EVENT: &str = "screenshot-pin-assigned";
/// Room around the picture for the pin's shadow, in CSS pixels (`MARGIN` in PinWindow.css).
pub(crate) const MARGIN: f64 = 10.0;
/// Zooming stops at these scales of the picture's own size.
const MIN_SCALE: f64 = 0.1;
const MAX_SCALE: f64 = 8.0;
/// The smallest a zoomed pin gets, in physical pixels, so it can still be grabbed.
const MIN_SIDE: f64 = 16.0;
/// A pin that has not drawn by then is shown anyway and the screenshot goes, so the screen never
/// stays frozen.
const HANDOFF_TIMEOUT: Duration = Duration::from_millis(600);
/// How long the screenshot stays under a pin that has just shown.
const SWAP_DELAY: Duration = Duration::from_millis(50);

struct Pin {
    picture: Arc<Picture>,
    /// `MARGIN` in this window's physical pixels.
    margin: u32,
    /// The screenshot to close once the pin shows.
    session: Option<u64>,
}

/// What a pin page needs before it can show (mirrored by `PinInfo` in api.ts).
#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PinInfo {
    width: u32,
    height: u32,
}

static PINS: Mutex<BTreeMap<String, Pin>> = Mutex::new(BTreeMap::new());
/// The hidden pin window kept ready for the next pin.
static SPARE: Mutex<Option<String>> = Mutex::new(None);
static NEXT_ID: AtomicU64 = AtomicU64::new(1);
/// All pins are hidden (T); a new pin shows them again.
static HIDDEN: AtomicBool = AtomicBool::new(false);

fn pins() -> MutexGuard<'static, BTreeMap<String, Pin>> {
    PINS.lock().unwrap_or_else(PoisonError::into_inner)
}

fn spare() -> MutexGuard<'static, Option<String>> {
    SPARE.lock().unwrap_or_else(PoisonError::into_inner)
}

fn build(app: &AppHandle) -> Result<WebviewWindow, String> {
    let _building = session::building();
    let label = format!("{WINDOW_PREFIX}{}", NEXT_ID.fetch_add(1, Ordering::SeqCst));
    let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html?window=pin".into()))
        .title("Fuyu")
        // Transparent for the shadow around the picture, and for fading it (Ctrl + wheel).
        .transparent(true)
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .focused(false)
        .visible(false)
        .build()
        .map_err(|error| error.to_string())?;
    // The page animates the pin in and out; Windows' own show and hide animations would fight it.
    if let Ok(hwnd) = window.hwnd() {
        let _ = win32::dwm::disable_transitions(hwnd);
    }
    Ok(window)
}

/// Creates the hidden pin window the next pin will use, unless there is one. Not on the main
/// thread: building a window waits for it.
pub(super) fn prepare(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        if spare().is_some() {
            return;
        }
        match build(&app) {
            Ok(window) => *spare() = Some(window.label().to_string()),
            Err(error) => eprintln!("failed to prepare a pin window: {error}"),
        }
    });
}

/// The ready pin window, or a new one when there is none.
fn take_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    let ready = spare().take().and_then(|label| app.get_webview_window(&label));
    match ready {
        Some(window) => Ok(window),
        None => build(app),
    }
}

/// Pins `picture` with its top-left at `at` on the virtual screen (physical pixels, `scale` the
/// monitor's). The screenshot `session` stays open until the pin shows (`ready`).
///
/// Returns at once: the window work runs on its own thread, and whatever happens to it, the
/// screenshot closes within `HANDOFF_TIMEOUT`.
pub(super) fn open(app: &AppHandle, picture: Picture, at: (i32, i32), scale: f64, session: Option<u64>) {
    if let Some(id) = session {
        let app = app.clone();
        thread::spawn(move || {
            thread::sleep(HANDOFF_TIMEOUT);
            give_up_waiting(&app, id);
        });
    }
    let app = app.clone();
    thread::spawn(move || {
        if let Err(error) = place(&app, picture, at, scale, session) {
            eprintln!("failed to pin the screenshot: {error}");
            if let Some(id) = session {
                session::end_if(&app, id);
            }
        }
    });
}

/// The pins still waiting for screenshot `id` show as they are, and the screenshot goes.
fn give_up_waiting(app: &AppHandle, id: u64) {
    let waiting: Vec<String> = pins()
        .iter_mut()
        .filter(|(_, pin)| pin.session == Some(id))
        .map(|(label, pin)| {
            pin.session = None;
            label.clone()
        })
        .collect();
    for label in waiting {
        if let Some(window) = app.get_webview_window(&label).filter(|_| !HIDDEN.load(Ordering::SeqCst)) {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
    session::end_if(app, id);
}

fn place(app: &AppHandle, picture: Picture, at: (i32, i32), scale: f64, session: Option<u64>) -> Result<(), String> {
    if HIDDEN.swap(false, Ordering::SeqCst) {
        set_all_visible(app, true);
    }
    let window = take_window(app)?;
    let label = window.label().to_string();
    let margin = (MARGIN * scale).round().max(0.0) as u32;
    let info = PinInfo { width: picture.width, height: picture.height };
    let (width, height) = (picture.width + margin * 2, picture.height + margin * 2);
    pins().insert(label.clone(), Pin { picture: Arc::new(picture), margin, session });
    // Position first: moving onto a monitor of another scale makes Windows resize the window.
    let placed = window
        .set_position(PhysicalPosition::new(at.0 - margin as i32, at.1 - margin as i32))
        .and_then(|()| window.set_size(PhysicalSize::new(width, height)));
    if let Err(error) = placed {
        pins().remove(&label);
        let _ = window.destroy();
        return Err(error.to_string());
    }
    // A page still loading misses this and asks with `info` once it has loaded.
    let _ = app.emit_to(label.as_str(), ASSIGNED_EVENT, info);
    prepare(app);
    Ok(())
}

/// The calling pin page's picture size, once it has one.
pub(super) fn info(label: &str) -> Option<PinInfo> {
    pins().get(label).map(|pin| PinInfo { width: pin.picture.width, height: pin.picture.height })
}

/// The picture of the pin `label`.
pub(super) fn picture(label: &str) -> Option<Arc<Picture>> {
    pins().get(label).map(|pin| Arc::clone(&pin.picture))
}

/// The pin has drawn its picture: show it, with the keyboard, and close the screenshot it came
/// from in the same moment, so the selection seems to lift off the frozen screen.
pub(super) fn ready(app: &AppHandle, window: &WebviewWindow) {
    let session = pins().get_mut(window.label()).and_then(|pin| pin.session.take());
    if !HIDDEN.load(Ordering::SeqCst) {
        let _ = window.show();
        let _ = window.set_focus();
    }
    if let Some(id) = session {
        // A frame later: the window's first frame after showing can be its last painted one.
        // The pin covers the same pixels of the screenshot, so the overlap does not show.
        let app = app.clone();
        thread::spawn(move || {
            thread::sleep(SWAP_DELAY);
            session::end_if(&app, id);
        });
    }
}

/// The pin window went away (closed from its menu, Esc or Alt+F4): let go of its picture.
pub(crate) fn forget(label: &str) {
    pins().remove(label);
    let mut spare = spare();
    if spare.as_deref() == Some(label) {
        *spare = None;
    }
}

/// Zooms the pin to `scale` of its picture's size, keeping the point at `anchor` (fractions of
/// the picture, 0 to 1) where it is on the screen.
pub(super) fn zoom(window: &WebviewWindow, scale: f64, anchor: (f64, f64)) -> Result<(), String> {
    let (picture, margin) = pins()
        .get(window.label())
        .map(|pin| ((pin.picture.width, pin.picture.height), pin.margin))
        .ok_or_else(|| "This pin is closed.".to_string())?;
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let inner = (position.x + margin as i32, position.y + margin as i32);
    let shown = (size.width.saturating_sub(margin * 2), size.height.saturating_sub(margin * 2));
    let (x, y, width, height) = zoomed(inner, shown, picture, scale, anchor);
    window.set_position(PhysicalPosition::new(x - margin as i32, y - margin as i32)).map_err(|error| error.to_string())?;
    window.set_size(PhysicalSize::new(width + margin * 2, height + margin * 2)).map_err(|error| error.to_string())
}

/// Where a picture shown at `position` and `size` goes when shown at `scale` of its own size
/// `picture`, `anchor` staying put: (x, y, width, height).
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

/// The pins on screen: not the hidden spare, nor one still waiting for its picture.
fn pin_windows(app: &AppHandle) -> Vec<WebviewWindow> {
    let pins = pins();
    app.webview_windows()
        .into_iter()
        .filter(|(label, _)| label.starts_with(WINDOW_PREFIX) && pins.get(label).is_some_and(|pin| pin.session.is_none()))
        .map(|(_, window)| window)
        .collect()
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
