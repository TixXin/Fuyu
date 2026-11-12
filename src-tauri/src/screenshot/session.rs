//! One screenshot: every monitor is captured first (the screen freezes), then each gets its own
//! overlay window showing that picture at the monitor's own scale, where the user selects a
//! region. One window per monitor, not one across all: a window spanning monitors of different
//! scales is resized by Windows and the selection drifts (Flameshot #4495).
//!
//! The overlay windows stay alive hidden between screenshots (created when the module is turned
//! on), because a new WebView takes a few hundred milliseconds to appear.

use std::{
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Mutex,
    },
    thread,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Monitor, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use super::targets::{self, LocalTarget, Target};
use crate::win32;

/// Overlay windows are `screenshot-<monitor index>`.
pub(crate) const WINDOW_PREFIX: &str = "screenshot-";
/// Mirrored by `SCREENSHOT_SESSION_EVENT` in src/features/screenshot/api.ts.
const SESSION_EVENT: &str = "screenshot-session";
/// Mirrored by `SCREENSHOT_ENDED_EVENT` in src/features/screenshot/api.ts.
const ENDED_EVENT: &str = "screenshot-ended";

/// How the screenshot starts: choose a region; choose one and at once copy it, read its text
/// (OCR) or translate that text, without the toolbar; or with the whole monitor under the pointer
/// chosen.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum Mode {
    Region,
    Copy,
    Text,
    Translate,
    Fullscreen,
}

/// What an overlay needs to show its monitor's picture (mirrored by `ScreenshotSession` in api.ts).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OverlaySession {
    id: u64,
    mode: Mode,
    /// The picture's size in physical pixels.
    width: u32,
    height: u32,
    /// This monitor has the pointer: it gets the keyboard, and the whole-monitor selection.
    under_pointer: bool,
}

/// A rectangle of a monitor's picture, in its physical pixels.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct PixelRect {
    pub(crate) x: u32,
    pub(crate) y: u32,
    pub(crate) width: u32,
    pub(crate) height: u32,
}

/// One monitor's frozen picture.
struct Frame {
    label: String,
    /// The monitor's top-left on the virtual screen.
    origin: (i32, i32),
    width: u32,
    height: u32,
    rgba: Vec<u8>,
}

struct Session {
    id: u64,
    mode: Mode,
    frames: Vec<Frame>,
    pointer_label: String,
    /// What the selection snaps to (C41.2): windows first, controls added as they are read.
    targets: Vec<Target>,
}

static SESSION: Mutex<Option<Session>> = Mutex::new(None);
static NEXT_ID: AtomicU64 = AtomicU64::new(1);
/// A capture is being taken; a second shortcut press meanwhile does nothing.
static STARTING: AtomicBool = AtomicBool::new(false);

fn session() -> std::sync::MutexGuard<'static, Option<Session>> {
    SESSION.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// Takes a screenshot unless one is already open. Runs on its own thread: capturing and placing
/// the windows waits on the main thread, and the hotkey thread also runs the keyboard hook.
pub(crate) fn start(app: &AppHandle, mode: Mode) {
    if session().is_some() || STARTING.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    thread::spawn(move || {
        if let Err(error) = open(&app, mode) {
            eprintln!("screenshot failed: {error}");
        }
        STARTING.store(false, Ordering::SeqCst);
    });
}

fn label(index: usize) -> String {
    format!("{WINDOW_PREFIX}{index}")
}

fn open(app: &AppHandle, mode: Mode) -> Result<(), String> {
    let monitors = app.available_monitors().map_err(|error| error.to_string())?;
    let pointer = win32::window::cursor_position().map(|point| (point.x, point.y));
    let mut frames = Vec::new();
    let mut pointer_label = None;
    for (index, monitor) in monitors.iter().enumerate() {
        let (position, size) = (monitor.position(), monitor.size());
        let Some(rgba) = win32::screen_capture::capture(position.x, position.y, size.width, size.height) else {
            continue;
        };
        if pointer.is_some_and(|point| contains(monitor, point)) {
            pointer_label = Some(label(index));
        }
        frames.push(Frame { label: label(index), origin: (position.x, position.y), width: size.width, height: size.height, rgba });
    }
    // Right after the capture, so the windows are where the picture shows them.
    let (window_targets, window_handles) = targets::windows_on_screen();
    let Some(first) = frames.first() else {
        return Err("no monitor could be captured".to_string());
    };
    let pointer_label = pointer_label.unwrap_or_else(|| first.label.clone());
    place_windows(app, &monitors)?;

    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    let announcements: Vec<(String, OverlaySession)> = frames
        .iter()
        .map(|frame| (frame.label.clone(), overlay_session(id, mode, frame, &pointer_label)))
        .collect();
    *session() = Some(Session { id, mode, frames, pointer_label, targets: window_targets });
    targets::read_controls(app, id, window_handles);
    // An overlay that is still loading misses this; it asks with `current` once it has loaded.
    for (label, announcement) in announcements {
        let _ = app.emit_to(label.as_str(), SESSION_EVENT, announcement);
    }
    Ok(())
}

fn overlay_session(id: u64, mode: Mode, frame: &Frame, pointer_label: &str) -> OverlaySession {
    OverlaySession { id, mode, width: frame.width, height: frame.height, under_pointer: frame.label == pointer_label }
}

fn contains(monitor: &Monitor, (x, y): (i32, i32)) -> bool {
    let (position, size) = (monitor.position(), monitor.size());
    let (right, bottom) = (position.x + size.width as i32, position.y + size.height as i32);
    (position.x..right).contains(&x) && (position.y..bottom).contains(&y)
}

/// An overlay window per monitor, each covering its monitor exactly; windows for monitors that
/// went away are closed. Not on the main thread: building a window waits for it.
fn place_windows(app: &AppHandle, monitors: &[Monitor]) -> Result<(), String> {
    for (index, monitor) in monitors.iter().enumerate() {
        let window = overlay_window(app, &label(index))?;
        // Position first: moving onto a monitor of another scale makes Windows resize the
        // window, so the size is set once it is there.
        window.set_position(PhysicalPosition::new(monitor.position().x, monitor.position().y)).map_err(|error| error.to_string())?;
        window.set_size(PhysicalSize::new(monitor.size().width, monitor.size().height)).map_err(|error| error.to_string())?;
    }
    for (name, window) in app.webview_windows() {
        let index = name.strip_prefix(WINDOW_PREFIX).and_then(|index| index.parse::<usize>().ok());
        if index.is_some_and(|index| index >= monitors.len()) {
            let _ = window.destroy();
        }
    }
    Ok(())
}

/// Held while a screenshot window (an overlay or a pin) is built: building WebViews from two
/// threads at once can hang on Windows, and a hung build left a pin's screenshot frozen.
static BUILDING: Mutex<()> = Mutex::new(());

pub(crate) fn building() -> std::sync::MutexGuard<'static, ()> {
    BUILDING.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn overlay_window(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(label) {
        return Ok(window);
    }
    let _building = building();
    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html?window=screenshot".into()))
        .title("Fuyu")
        // A hidden WebView stops painting, so the first frame after `show` can be the last one it
        // painted (blank). Transparent, that frame shows the real screen, which the frozen
        // picture matches, so nothing flashes.
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
    // Without this, hiding the overlay plays Windows' shrink-and-fade over the whole monitor.
    if let Err(error) = window.hwnd().map_err(|error| error.to_string()).and_then(|hwnd| win32::dwm::disable_transitions(hwnd).map_err(|error| error.to_string())) {
        eprintln!("screenshot overlay keeps its show/hide animation: {error}");
    }
    Ok(window)
}

/// Creates the overlay windows ahead of the first screenshot, so it opens at once.
pub(crate) fn prepare(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        let placed = app.available_monitors().map_err(|error| error.to_string()).and_then(|monitors| place_windows(&app, &monitors));
        if let Err(error) = placed {
            eprintln!("failed to prepare the screenshot windows: {error}");
        }
        super::pin::prepare(&app);
    });
}

/// The open screenshot as the overlay `label` shows it, or `None`.
pub(crate) fn current(label: &str) -> Option<OverlaySession> {
    let guard = session();
    let session = guard.as_ref()?;
    let frame = session.frames.iter().find(|frame| frame.label == label)?;
    Some(overlay_session(session.id, session.mode, frame, &session.pointer_label))
}

/// What the overlay `label` can snap to, in its picture's pixels.
pub(crate) fn targets_for(label: &str) -> Vec<LocalTarget> {
    let guard = session();
    let Some(session) = guard.as_ref() else {
        return Vec::new();
    };
    session
        .frames
        .iter()
        .find(|frame| frame.label == label)
        .map(|frame| targets::localize(&session.targets, frame.origin, (frame.width, frame.height)))
        .unwrap_or_default()
}

/// Adds controls read for screenshot `id`; the overlays to tell, or `None` once it is closed.
pub(super) fn add_targets(id: u64, more: Vec<Target>) -> Option<Vec<String>> {
    let mut guard = session();
    let session = guard.as_mut().filter(|session| session.id == id)?;
    session.targets.extend(more);
    Some(session.frames.iter().map(|frame| frame.label.clone()).collect())
}

/// The picture of the overlay `label`'s monitor, RGBA rows top to bottom.
pub(crate) fn frame(label: &str) -> Option<Vec<u8>> {
    session().as_ref()?.frames.iter().find(|frame| frame.label == label).map(|frame| frame.rgba.clone())
}

/// The overlay has drawn its picture: show it, with the keyboard on the monitor under the pointer.
pub(crate) fn overlay_ready(window: &WebviewWindow, id: u64) {
    let focus = match session().as_ref() {
        Some(session) if session.id == id => session.pointer_label == window.label(),
        _ => return,
    };
    let _ = window.show();
    if focus {
        let _ = window.set_focus();
    }
}

/// The top-left of the overlay `label`'s monitor on the virtual screen, in physical pixels.
pub(crate) fn origin(label: &str) -> Option<(i32, i32)> {
    session().as_ref()?.frames.iter().find(|frame| frame.label == label).map(|frame| frame.origin)
}

/// The pixels of `rect` in the overlay `label`'s picture, clipped to it: (width, height, RGBA).
pub(crate) fn selection(label: &str, rect: PixelRect) -> Option<(u32, u32, Vec<u8>)> {
    let guard = session();
    let frame = guard.as_ref()?.frames.iter().find(|frame| frame.label == label)?;
    crop(&frame.rgba, frame.width, frame.height, rect)
}

/// `rect` cut out of an RGBA picture `width` × `height`, clipped to it; `None` when nothing is left.
pub(crate) fn crop(rgba: &[u8], width: u32, height: u32, rect: PixelRect) -> Option<(u32, u32, Vec<u8>)> {
    let right = rect.x.saturating_add(rect.width).min(width);
    let bottom = rect.y.saturating_add(rect.height).min(height);
    if rect.x >= right || rect.y >= bottom || rgba.len() < width as usize * height as usize * 4 {
        return None;
    }
    let (cut_width, cut_height) = (right - rect.x, bottom - rect.y);
    let row = width as usize * 4;
    let mut out = Vec::with_capacity(cut_width as usize * cut_height as usize * 4);
    for y in rect.y..bottom {
        let start = y as usize * row + rect.x as usize * 4;
        out.extend_from_slice(&rgba[start..start + cut_width as usize * 4]);
    }
    Some((cut_width, cut_height, out))
}

/// The open screenshot's id.
pub(crate) fn id() -> Option<u64> {
    session().as_ref().map(|session| session.id)
}

/// Closes screenshot `id` if it is still the open one (a pin hands off from it, C41.4).
pub(crate) fn end_if(app: &AppHandle, id: u64) {
    if self::id() == Some(id) {
        end(app);
    }
}

/// Closes the screenshot: hides every overlay and lets go of the pictures.
pub(crate) fn end(app: &AppHandle) {
    session().take();
    for (name, window) in app.webview_windows() {
        if name.starts_with(WINDOW_PREFIX) {
            let _ = window.hide();
            let _ = app.emit_to(name.as_str(), ENDED_EVENT, ());
        }
    }
}
