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

use super::{capture, output::Picture, session};
use crate::island::screen;

pub(crate) const WINDOW_PREFIX: &str = "pin-";
const ASSIGNED_EVENT: &str = "screenshot-pin-assigned";
pub(crate) const MARGIN: f64 = 10.0;
const MIN_SCALE: f64 = 0.1;
const MAX_SCALE: f64 = 8.0;
const MIN_SIDE: f64 = 16.0;
const HANDOFF_TIMEOUT: Duration = Duration::from_millis(600);
const SWAP_DELAY: Duration = Duration::from_millis(50);

struct Pin {
    picture: Arc<Picture>,
    margin: u32,
    density: f64,
    session: Option<u64>,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PinInfo {
    width: u32,
    height: u32,
}

static PINS: Mutex<BTreeMap<String, Pin>> = Mutex::new(BTreeMap::new());
static SPARE: Mutex<Option<String>> = Mutex::new(None);
static NEXT_ID: AtomicU64 = AtomicU64::new(1);
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
    capture::prepare_pin(&window);
    Ok(window)
}

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

fn take_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    let ready = spare().take().and_then(|label| app.get_webview_window(&label));
    match ready {
        Some(window) => Ok(window),
        None => build(app),
    }
}

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
    let units = capture::units_per_css(scale);
    let margin = (MARGIN * units).round().max(0.0) as u32;
    let density = scale / units;
    let info = PinInfo { width: picture.width, height: picture.height };
    let shown = shown_size((picture.width, picture.height), density);
    let (width, height) = (shown.0 + margin * 2, shown.1 + margin * 2);
    pins().insert(label.clone(), Pin { picture: Arc::new(picture), margin, density, session });
    let placed = screen::set_window_position(&window, PhysicalPosition::new(at.0 - margin as i32, at.1 - margin as i32))
        .and_then(|()| screen::set_window_size(&window, PhysicalSize::new(width, height)));
    if let Err(error) = placed {
        pins().remove(&label);
        let _ = window.destroy();
        return Err(error);
    }
    let _ = app.emit_to(label.as_str(), ASSIGNED_EVENT, info);
    prepare(app);
    Ok(())
}

pub(super) fn info(label: &str) -> Option<PinInfo> {
    pins().get(label).map(|pin| PinInfo { width: pin.picture.width, height: pin.picture.height })
}

pub(super) fn picture(label: &str) -> Option<Arc<Picture>> {
    pins().get(label).map(|pin| Arc::clone(&pin.picture))
}

pub(super) fn ready(app: &AppHandle, window: &WebviewWindow) {
    let session = pins().get_mut(window.label()).and_then(|pin| pin.session.take());
    if !HIDDEN.load(Ordering::SeqCst) {
        let _ = window.show();
        let _ = window.set_focus();
    }
    if let Some(id) = session {
        let app = app.clone();
        thread::spawn(move || {
            thread::sleep(SWAP_DELAY);
            session::end_if(&app, id);
        });
    }
}

pub(crate) fn forget(label: &str) {
    pins().remove(label);
    let mut spare = spare();
    if spare.as_deref() == Some(label) {
        *spare = None;
    }
}

pub(super) fn shown_size((width, height): (u32, u32), density: f64) -> (u32, u32) {
    if density == 1.0 {
        return (width, height);
    }
    let units = |pixels: u32| ((f64::from(pixels) / density).round() as u32).max(1);
    (units(width), units(height))
}

pub(super) fn zoom(window: &WebviewWindow, scale: f64, anchor: (f64, f64)) -> Result<(), String> {
    let (picture, margin) = pins()
        .get(window.label())
        .map(|pin| (shown_size((pin.picture.width, pin.picture.height), pin.density), pin.margin))
        .ok_or_else(|| "This pin is closed.".to_string())?;
    let position = screen::window_position(window)?;
    let size = screen::window_size(window)?;
    let inner = (position.x + margin as i32, position.y + margin as i32);
    let shown = (size.width.saturating_sub(margin * 2), size.height.saturating_sub(margin * 2));
    let (x, y, width, height) = zoomed(inner, shown, picture, scale, anchor);
    screen::set_window_position(window, PhysicalPosition::new(x - margin as i32, y - margin as i32))?;
    screen::set_window_size(window, PhysicalSize::new(width + margin * 2, height + margin * 2))
}

pub(super) fn zoomed(position: (i32, i32), size: (u32, u32), picture: (u32, u32), scale: f64, anchor: (f64, f64)) -> (i32, i32, u32, u32) {
    let scale = if scale.is_finite() { scale.clamp(MIN_SCALE, MAX_SCALE) } else { 1.0 };
    let (fx, fy) = (anchor.0.clamp(0.0, 1.0), anchor.1.clamp(0.0, 1.0));
    let width = (f64::from(picture.0) * scale).round().max(MIN_SIDE);
    let height = (f64::from(picture.1) * scale).round().max(MIN_SIDE);
    let x = f64::from(position.0) + f64::from(size.0) * fx - width * fx;
    let y = f64::from(position.1) + f64::from(size.1) * fy - height * fy;
    (x.round() as i32, y.round() as i32, width as u32, height as u32)
}

pub(super) fn click_through(window: &WebviewWindow, through: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(through).map_err(|error| error.to_string())
}

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
