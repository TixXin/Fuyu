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
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

use super::{
    capture,
    output::Picture,
    pin_edit::{self, PinTurn},
    pin_store::{self, SavedPin, StoreItem},
    session,
};
use crate::island::screen;

pub(crate) const WINDOW_PREFIX: &str = "pin-";
const ASSIGNED_EVENT: &str = "screenshot-pin-assigned";
pub(crate) const MARGIN: f64 = 10.0;
const MIN_SCALE: f64 = 0.1;
const MAX_SCALE: f64 = 8.0;
const MIN_SIDE: f64 = 16.0;
const HANDOFF_TIMEOUT: Duration = Duration::from_millis(600);
const SWAP_DELAY: Duration = Duration::from_millis(50);
const MAX_PINS: usize = 20;
const COLLAPSED_SIDE: f64 = 56.0;

type Frame = (i32, i32, u32, u32);

struct Pin {
    picture: Arc<Picture>,
    margin: u32,
    density: f64,
    session: Option<u64>,
    opacity: f64,
    stored: Option<String>,
    collapsed: Option<Frame>,
    reserved: Option<(u32, u32)>,
}

impl Pin {
    fn new(picture: Picture, margin: u32, density: f64, session: Option<u64>) -> Self {
        Self { picture: Arc::new(picture), margin, density, session, opacity: 1.0, stored: None, collapsed: None, reserved: None }
    }

    fn info(&self) -> PinInfo {
        PinInfo { width: self.picture.width, height: self.picture.height, opacity: self.opacity }
    }
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PinInfo {
    width: u32,
    height: u32,
    opacity: f64,
}

static PINS: Mutex<BTreeMap<String, Pin>> = Mutex::new(BTreeMap::new());
static NEXT_ID: AtomicU64 = AtomicU64::new(1);
static HIDDEN: AtomicBool = AtomicBool::new(false);

fn pins() -> MutexGuard<'static, BTreeMap<String, Pin>> {
    PINS.lock().unwrap_or_else(PoisonError::into_inner)
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
        .accept_first_mouse(true)
        .visible(false)
        .build()
        .map_err(|error| error.to_string())?;
    capture::prepare_pin(&window);
    let moved = app.clone();
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Moved(_)) {
            pin_store::request_save(&moved);
        }
    });
    Ok(window)
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
    let window = build(app)?;
    let label = window.label().to_string();
    let units = capture::units_per_css(scale);
    let margin = (MARGIN * units).round().max(0.0) as u32;
    let density = scale / units;
    let pin = Pin::new(picture, margin, density, session);
    let info = pin.info();
    let shown = shown_size((info.width, info.height), density);
    let (width, height) = (shown.0 + margin * 2, shown.1 + margin * 2);
    let evicted = {
        let mut guard = pins();
        let mut to_remove = Vec::new();
        while guard.len() >= MAX_PINS {
            if let Some(oldest) = guard.keys().next().cloned() {
                guard.remove(&oldest);
                to_remove.push(oldest);
            } else {
                break;
            }
        }
        guard.insert(label.clone(), pin);
        to_remove
    };
    for old_label in evicted {
        if let Some(old) = app.get_webview_window(&old_label) {
            let _ = old.destroy();
        }
    }
    let placed = screen::set_window_size(&window, PhysicalSize::new(width, height))
        .and_then(|()| screen::set_window_position(&window, PhysicalPosition::new(at.0 - margin as i32, at.1 - margin as i32)));
    if let Err(error) = placed {
        pins().remove(&label);
        let _ = window.destroy();
        return Err(error);
    }
    let _ = app.emit_to(label.as_str(), ASSIGNED_EVENT, info);
    pin_store::thaw();
    pin_store::request_save(app);
    Ok(())
}

pub(super) fn restore(app: &AppHandle, picture: Picture, saved: &SavedPin) -> Result<(), String> {
    let window = build(app)?;
    let label = window.label().to_string();
    let mut pin = Pin::new(picture, saved.margin, saved.density, None);
    pin.opacity = saved.opacity.clamp(0.0, 1.0);
    pin.stored = Some(saved.file.clone());
    let info = pin.info();
    pins().insert(label.clone(), pin);
    let placed = screen::set_window_size(&window, PhysicalSize::new(saved.width, saved.height))
        .and_then(|()| screen::set_window_position(&window, PhysicalPosition::new(saved.x, saved.y)));
    if let Err(error) = placed {
        pins().remove(&label);
        let _ = window.destroy();
        return Err(error);
    }
    let _ = app.emit_to(label.as_str(), ASSIGNED_EVENT, info);
    Ok(())
}

pub(super) fn info(label: &str) -> Option<PinInfo> {
    pins().get(label).map(Pin::info)
}

fn frame(window: &WebviewWindow) -> Result<Frame, String> {
    let position = screen::window_position(window)?;
    let size = screen::window_size(window)?;
    Ok((position.x, position.y, size.width, size.height))
}

fn set_frame(window: &WebviewWindow, (x, y, width, height): Frame) -> Result<(), String> {
    screen::set_window_size(window, PhysicalSize::new(width, height))?;
    screen::set_window_position(window, PhysicalPosition::new(x, y))
}

fn inset((x, y, width, height): Frame, margin: u32) -> Frame {
    (x + margin as i32, y + margin as i32, width.saturating_sub(margin * 2), height.saturating_sub(margin * 2))
}

fn outset((x, y, width, height): Frame, margin: u32) -> Frame {
    (x - margin as i32, y - margin as i32, width + margin * 2, height + margin * 2)
}

pub(super) fn turn(app: &AppHandle, window: &WebviewWindow, turn: PinTurn) -> Result<(), String> {
    let (info, margin) = {
        let mut guard = pins();
        let pin = guard.get_mut(window.label()).ok_or_else(|| "This pin is closed.".to_string())?;
        if pin.collapsed.is_some() || pin.reserved.is_some() {
            return Err("Finish editing or open the pin first.".to_string());
        }
        pin.picture = Arc::new(pin_edit::turn_picture(&pin.picture, turn));
        pin.stored = None;
        (pin.info(), pin.margin)
    };
    let (x, y, width, height) = inset(frame(window)?, margin);
    set_frame(window, outset(pin_edit::turned_frame((x, y), (width, height), turn), margin))?;
    let _ = app.emit_to(window.label(), ASSIGNED_EVENT, info);
    pin_store::request_save(app);
    Ok(())
}

pub(super) fn replace(app: &AppHandle, window: &WebviewWindow, picture: Picture) -> Result<(), String> {
    let info = {
        let mut guard = pins();
        let pin = guard.get_mut(window.label()).ok_or_else(|| "This pin is closed.".to_string())?;
        pin.picture = Arc::new(picture);
        pin.stored = None;
        pin.info()
    };
    let _ = app.emit_to(window.label(), ASSIGNED_EVENT, info);
    pin_store::request_save(app);
    Ok(())
}

pub(super) fn collapse(app: &AppHandle, window: &WebviewWindow, collapsed: bool) -> Result<(), String> {
    let current = frame(window)?;
    let side = (COLLAPSED_SIDE * window.scale_factor().unwrap_or(1.0)).round().max(1.0) as u32;
    let next = {
        let mut guard = pins();
        let pin = guard.get_mut(window.label()).ok_or_else(|| "This pin is closed.".to_string())?;
        match (collapsed, pin.collapsed) {
            (true, None) => {
                pin.collapsed = Some(current);
                let (x, y, width, height) = inset(current, pin.margin);
                Some(outset(pin_edit::collapsed_frame((x, y), (width, height), side), pin.margin))
            }
            (false, Some(before)) => {
                pin.collapsed = None;
                Some((current.0, current.1, before.2, before.3))
            }
            _ => None,
        }
    };
    if let Some(next) = next {
        set_frame(window, next)?;
        pin_store::request_save(app);
    }
    Ok(())
}

pub(super) fn reserve(window: &WebviewWindow, extra_css: (f64, f64)) -> Result<(), String> {
    let factor = window.scale_factor().unwrap_or(1.0);
    let extra = ((extra_css.0.max(0.0) * factor).round() as u32, (extra_css.1.max(0.0) * factor).round() as u32);
    let (x, y, width, height) = frame(window)?;
    let size = {
        let mut guard = pins();
        let pin = guard.get_mut(window.label()).ok_or_else(|| "This pin is closed.".to_string())?;
        let original = *pin.reserved.get_or_insert((width, height));
        if extra == (0, 0) {
            pin.reserved = None;
            original
        } else {
            let inner = (original.0.saturating_sub(pin.margin * 2), original.1.saturating_sub(pin.margin * 2));
            let (inner_width, inner_height) = pin_edit::reserved_size(inner, extra);
            (inner_width + pin.margin * 2, inner_height + pin.margin * 2)
        }
    };
    screen::set_window_size(window, PhysicalSize::new(size.0, size.1))?;
    screen::set_window_position(window, PhysicalPosition::new(x, y))
}

pub(super) fn set_opacity(app: &AppHandle, label: &str, opacity: f64) {
    if let Some(pin) = pins().get_mut(label) {
        pin.opacity = if opacity.is_finite() { opacity.clamp(0.0, 1.0) } else { 1.0 };
    }
    pin_store::request_save(app);
}

pub(super) fn store_items(app: &AppHandle) -> Vec<StoreItem> {
    let guard = pins();
    guard
        .iter()
        .filter(|(_, pin)| pin.session.is_none())
        .filter_map(|(label, pin)| {
            let window = app.get_webview_window(label)?;
            let (x, y, width, height) = frame(&window).ok()?;
            let (width, height) = pin.collapsed.map(|before| (before.2, before.3)).or(pin.reserved).unwrap_or((width, height));
            Some(StoreItem {
                label: label.clone(),
                picture: Arc::clone(&pin.picture),
                file: pin.stored.clone(),
                saved: SavedPin { file: String::new(), x, y, width, height, margin: pin.margin, density: pin.density, opacity: pin.opacity },
            })
        })
        .collect()
}

pub(super) fn mark_stored(label: &str, picture: &Arc<Picture>, file: &str) {
    if let Some(pin) = pins().get_mut(label).filter(|pin| Arc::ptr_eq(&pin.picture, picture)) {
        pin.stored = Some(file.to_string());
    }
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
    screen::set_window_size(window, PhysicalSize::new(width + margin * 2, height + margin * 2))?;
    screen::set_window_position(window, PhysicalPosition::new(x - margin as i32, y - margin as i32))?;
    pin_store::request_save(window.app_handle());
    Ok(())
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
    pin_store::request_save(window.app_handle());
}

pub(super) fn close_all(app: &AppHandle) {
    for window in pin_windows(app) {
        close(&window);
    }
    HIDDEN.store(false, Ordering::SeqCst);
}

pub(super) fn close_every(app: &AppHandle) {
    pin_store::freeze();
    for (label, window) in app.webview_windows() {
        if label.starts_with(WINDOW_PREFIX) {
            close(&window);
        }
    }
    HIDDEN.store(false, Ordering::SeqCst);
}
