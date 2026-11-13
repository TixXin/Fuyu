use std::{
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Condvar, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Monitor, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use super::targets::{self, LocalTarget, Target};
use crate::island::screen;

pub(crate) const WINDOW_PREFIX: &str = "screenshot-";
const SESSION_EVENT: &str = "screenshot-session";
const ENDED_EVENT: &str = "screenshot-ended";
const CAPTURE_SETTLE: Duration = Duration::from_millis(80);
const CAPTURE_WAIT: Duration = Duration::from_secs(5);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum Mode {
    Region,
    Copy,
    Text,
    Translate,
    Long,
    Fullscreen,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OverlaySession {
    id: u64,
    mode: Mode,
    width: u32,
    height: u32,
    under_pointer: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct PixelRect {
    pub(crate) x: u32,
    pub(crate) y: u32,
    pub(crate) width: u32,
    pub(crate) height: u32,
}

struct Frame {
    label: String,
    origin: (i32, i32),
    width: u32,
    height: u32,
    scale: f64,
    rgba: Vec<u8>,
}

struct Session {
    id: u64,
    mode: Mode,
    frames: Vec<Frame>,
    pointer_label: String,
    targets: Vec<Target>,
    captured: bool,
    shown: Vec<String>,
}

static SESSION: Mutex<Option<Session>> = Mutex::new(None);
static CAPTURED: Condvar = Condvar::new();
static NEXT_ID: AtomicU64 = AtomicU64::new(1);
static STARTING: AtomicBool = AtomicBool::new(false);

fn session() -> std::sync::MutexGuard<'static, Option<Session>> {
    SESSION.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

pub(crate) fn start(app: &AppHandle, mode: Mode) {
    if session().is_some() || STARTING.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    thread::spawn(move || {
        if let Err(error) = open(&app, mode) {
            eprintln!("screenshot failed: {error}");
            crate::clipboard_history::refocus_popup(&app);
        }
        STARTING.store(false, Ordering::SeqCst);
    });
}

fn label(index: usize) -> String {
    format!("{WINDOW_PREFIX}{index}")
}

fn open(app: &AppHandle, mode: Mode) -> Result<(), String> {
    super::capture::ensure_access()?;
    if crate::clipboard_history::show_popup_in_screenshot(app) {
        thread::sleep(CAPTURE_SETTLE);
    }
    let monitors = app.available_monitors().map_err(|error| error.to_string())?;
    if monitors.is_empty() {
        return Err("no monitor is connected".to_string());
    }
    let pointer = screen::cursor_position().map(|(x, y)| (x.round() as i32, y.round() as i32));
    let pointer_index = monitors.iter().position(|monitor| pointer.is_some_and(|point| contains(monitor, point))).unwrap_or(0);
    let frames: Vec<Frame> = monitors.iter().enumerate().map(|(index, monitor)| grabbed(index, super::capture::planned(monitor))).collect();
    place_windows(app, &monitors)?;
    hold_overlays(app, true);

    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    *session() = Some(Session { id, mode, frames, pointer_label: label(pointer_index), targets: Vec::new(), captured: false, shown: Vec::new() });
    announce(app, id);

    let grabs: Vec<Option<super::capture::Grab>> = thread::scope(|scope| {
        let shots: Vec<_> = monitors.iter().map(|monitor| scope.spawn(move || super::capture::monitor(monitor))).collect();
        shots.into_iter().map(|shot| shot.join().ok().flatten()).collect()
    });
    let (window_targets, window_handles) = targets::windows_on_screen();
    finish_capture(app, id, grabs, window_targets);
    targets::read_controls(app, id, window_handles);
    Ok(())
}

fn grabbed(index: usize, grab: super::capture::Grab) -> Frame {
    Frame { label: label(index), origin: grab.origin, width: grab.width, height: grab.height, scale: grab.scale, rgba: grab.rgba }
}

fn announce(app: &AppHandle, id: u64) {
    let announcements: Vec<(String, OverlaySession)> = match session().as_ref() {
        Some(session) if session.id == id => session
            .frames
            .iter()
            .map(|frame| (frame.label.clone(), overlay_session(id, session.mode, frame, &session.pointer_label)))
            .collect(),
        _ => return,
    };
    for (label, announcement) in announcements {
        let _ = app.emit_to(label.as_str(), SESSION_EVENT, announcement);
    }
}

fn hold_overlays(app: &AppHandle, held: bool) {
    for (name, window) in app.webview_windows() {
        if name.starts_with(WINDOW_PREFIX) {
            let _ = window.set_ignore_cursor_events(held);
        }
    }
}

fn finish_capture(app: &AppHandle, id: u64, grabs: Vec<Option<super::capture::Grab>>, window_targets: Vec<Target>) {
    let mut resized = false;
    let mut failed = Vec::new();
    let focus = {
        let mut guard = session();
        let Some(session) = guard.as_mut().filter(|session| session.id == id) else {
            return;
        };
        for (index, grab) in grabs.into_iter().enumerate() {
            let Some(planned) = session.frames.iter_mut().find(|frame| frame.label == label(index)) else {
                continue;
            };
            match grab {
                Some(grab) => {
                    resized |= (grab.width, grab.height) != (planned.width, planned.height);
                    *planned = grabbed(index, grab);
                }
                None => failed.push(planned.label.clone()),
            }
        }
        session.frames.retain(|frame| !failed.contains(&frame.label));
        if session.frames.is_empty() {
            drop(guard);
            eprintln!("screenshot failed: no monitor could be captured");
            end(app);
            return;
        }
        if failed.contains(&session.pointer_label) {
            session.pointer_label = session.frames[0].label.clone();
            resized = true;
        }
        session.targets = window_targets;
        session.captured = true;
        CAPTURED.notify_all();
        session.shown.contains(&session.pointer_label).then(|| session.pointer_label.clone())
    };
    for label in &failed {
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.hide();
        }
    }
    hold_overlays(app, false);
    if resized {
        announce(app, id);
    }
    for (name, _) in app.webview_windows().into_iter().filter(|(name, _)| name.starts_with(WINDOW_PREFIX)) {
        let _ = app.emit_to(name.as_str(), targets::TARGETS_EVENT, id);
    }
    if let Some(window) = focus.and_then(|label| app.get_webview_window(&label)) {
        focus_overlay(&window);
    }
}

pub(crate) fn wait_for_capture() {
    let deadline = Instant::now() + CAPTURE_WAIT;
    let mut guard = session();
    while guard.as_ref().is_some_and(|session| !session.captured) {
        let Some(left) = deadline.checked_duration_since(Instant::now()) else {
            return;
        };
        guard = CAPTURED.wait_timeout(guard, left).unwrap_or_else(std::sync::PoisonError::into_inner).0;
    }
}

fn overlay_session(id: u64, mode: Mode, frame: &Frame, pointer_label: &str) -> OverlaySession {
    OverlaySession { id, mode, width: frame.width, height: frame.height, under_pointer: frame.label == pointer_label }
}

fn contains(monitor: &Monitor, (x, y): (i32, i32)) -> bool {
    let (position, size) = (screen::monitor_origin(monitor), screen::monitor_size(monitor));
    let (right, bottom) = (position.x + size.width as i32, position.y + size.height as i32);
    (position.x..right).contains(&x) && (position.y..bottom).contains(&y)
}

fn place_windows(app: &AppHandle, monitors: &[Monitor]) -> Result<(), String> {
    for (index, monitor) in monitors.iter().enumerate() {
        let window = overlay_window(app, &label(index))?;
        screen::set_window_position(&window, screen::monitor_origin(monitor))?;
        screen::set_window_size(&window, screen::monitor_size(monitor))?;
    }
    for (name, window) in app.webview_windows() {
        let index = name.strip_prefix(WINDOW_PREFIX).and_then(|index| index.parse::<usize>().ok());
        if index.is_some_and(|index| index >= monitors.len()) {
            let _ = window.destroy();
        }
    }
    Ok(())
}

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
    super::capture::prepare_overlay(app, &window);
    Ok(window)
}

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

pub(crate) fn current(label: &str) -> Option<OverlaySession> {
    let guard = session();
    let session = guard.as_ref()?;
    let frame = session.frames.iter().find(|frame| frame.label == label)?;
    Some(overlay_session(session.id, session.mode, frame, &session.pointer_label))
}

pub(crate) fn targets_for(label: &str) -> Vec<LocalTarget> {
    let guard = session();
    let Some(session) = guard.as_ref() else {
        return Vec::new();
    };
    session
        .frames
        .iter()
        .find(|frame| frame.label == label)
        .map(|frame| targets::localize(&session.targets, frame.origin, (frame.width, frame.height), frame.scale))
        .unwrap_or_default()
}

#[cfg_attr(not(windows), allow(dead_code))]
pub(super) fn add_targets(id: u64, more: Vec<Target>) -> Option<Vec<String>> {
    let mut guard = session();
    let session = guard.as_mut().filter(|session| session.id == id)?;
    session.targets.extend(more);
    Some(session.frames.iter().map(|frame| frame.label.clone()).collect())
}

pub(crate) fn frame(label: &str) -> Option<Vec<u8>> {
    session().as_ref()?.frames.iter().find(|frame| frame.label == label && !frame.rgba.is_empty()).map(|frame| frame.rgba.clone())
}

pub(crate) fn overlay_ready(window: &WebviewWindow, id: u64) {
    let focus = match session().as_mut() {
        Some(session) if session.id == id => {
            session.shown.push(window.label().to_string());
            session.captured && session.pointer_label == window.label()
        }
        _ => return,
    };
    let _ = window.show();
    if focus {
        focus_overlay(window);
    }
}

#[cfg(target_os = "macos")]
fn focus_overlay(window: &WebviewWindow) {
    let (app, label) = (window.app_handle().clone(), window.label().to_string());
    let target = window.clone();
    let _ = window.run_on_main_thread(move || {
        if !crate::macos::island_panel::make_panel_key(&app, &label) {
            let _ = target.set_focus();
        }
    });
}

#[cfg(not(target_os = "macos"))]
fn focus_overlay(window: &WebviewWindow) {
    let _ = window.set_focus();
}

pub(crate) fn origin(label: &str) -> Option<(i32, i32)> {
    session().as_ref()?.frames.iter().find(|frame| frame.label == label).map(|frame| frame.origin)
}

pub(crate) fn scale(label: &str) -> Option<f64> {
    session().as_ref()?.frames.iter().find(|frame| frame.label == label).map(|frame| frame.scale)
}

pub(crate) fn global_point(label: &str, left: u32, top: u32) -> Option<(i32, i32)> {
    let guard = session();
    let frame = guard.as_ref()?.frames.iter().find(|frame| frame.label == label)?;
    Some(offset(frame.origin, (left, top), frame.scale))
}

pub(crate) fn offset(origin: (i32, i32), (left, top): (u32, u32), scale: f64) -> (i32, i32) {
    let units = |pixels: u32| if scale == 1.0 { pixels } else { (f64::from(pixels) / scale).round() as u32 };
    (origin.0.saturating_add_unsigned(units(left)), origin.1.saturating_add_unsigned(units(top)))
}

pub(crate) fn selection(label: &str, rect: PixelRect) -> Option<(u32, u32, Vec<u8>)> {
    let guard = session();
    let frame = guard.as_ref()?.frames.iter().find(|frame| frame.label == label)?;
    crop(&frame.rgba, frame.width, frame.height, rect)
}

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

pub(crate) fn id() -> Option<u64> {
    session().as_ref().map(|session| session.id)
}

pub(crate) fn end_if(app: &AppHandle, id: u64) {
    if self::id() == Some(id) {
        end(app);
    }
}

pub(crate) fn end(app: &AppHandle) {
    let ended = session().take().is_some();
    CAPTURED.notify_all();
    for (name, window) in app.webview_windows() {
        if name.starts_with(WINDOW_PREFIX) {
            let _ = window.hide();
            let _ = app.emit_to(name.as_str(), ENDED_EVENT, ());
        }
    }
    if ended {
        crate::clipboard_history::refocus_popup(app);
    }
}
