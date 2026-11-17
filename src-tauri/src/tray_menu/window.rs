use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex, PoisonError,
    },
    thread,
    time::{Duration, Instant},
};

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WebviewWindowBuilder, WindowEvent};

use super::place::{self, Platform, Rect, Screen};
use crate::{island::screen, settings_window::open_trace::WindowTrace};

pub(crate) const WINDOW_LABEL: &str = "tray-menu";
const OPEN_EVENT: &str = "tray-menu-open";
const DEFAULT_SIZE: (f64, f64) = (320.0, 420.0);
const SHOW_FALLBACK: Duration = Duration::from_millis(700);
const REOPEN_GUARD: Duration = Duration::from_millis(400);

#[derive(Clone, Copy)]
struct Anchor {
    icon: Option<Rect>,
    cursor: (f64, f64),
}

static ANCHOR: Mutex<Option<Anchor>> = Mutex::new(None);
static SIZE: Mutex<(f64, f64)> = Mutex::new(DEFAULT_SIZE);
static HIDDEN_AT: Mutex<Option<Instant>> = Mutex::new(None);
static GENERATION: AtomicU64 = AtomicU64::new(0);
static PENDING_TRACE: Mutex<Option<WindowTrace>> = Mutex::new(None);

#[cfg(target_os = "macos")]
const PLATFORM: Platform = Platform::MacOs;
#[cfg(not(target_os = "macos"))]
const PLATFORM: Platform = Platform::Windows;

struct Display {
    screen: Screen,
    backing: f64,
}

fn displays(app: &AppHandle) -> Vec<Display> {
    app.available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|monitor| {
            let origin = screen::monitor_origin(monitor);
            let size = screen::monitor_size(monitor);
            let (left, top, width, height) = screen::monitor_work_rect(monitor);
            Display {
                screen: Screen {
                    bounds: Rect::new(f64::from(origin.x), f64::from(origin.y), f64::from(size.width), f64::from(size.height)),
                    work: Rect::new(f64::from(left), f64::from(top), f64::from(width), f64::from(height)),
                    scale: screen::monitor_scale(monitor),
                },
                backing: monitor.scale_factor(),
            }
        })
        .collect()
}

fn icon_in_screen_units(rect: &tauri::Rect, displays: &[Display]) -> Option<Rect> {
    let position = rect.position.to_physical::<f64>(1.0);
    let size = rect.size.to_physical::<f64>(1.0);
    let physical = Rect::new(position.x, position.y, size.width, size.height);
    if PLATFORM == Platform::Windows {
        return Some(physical);
    }
    displays.iter().find_map(|display| {
        let scale = display.backing.max(0.1);
        let candidate = Rect::new(physical.left / scale, physical.top / scale, size.width / scale, size.height / scale);
        let center = ((candidate.left + candidate.right) / 2.0, (candidate.top + candidate.bottom) / 2.0);
        place::screen_for(&[display.screen], center).map(|_| candidate)
    })
}

pub(crate) fn card_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(WINDOW_LABEL)
}

pub(crate) fn is_open(app: &AppHandle) -> bool {
    card_window(app).is_some_and(|window| window.is_visible().unwrap_or(false))
}

fn create(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = card_window(app) {
        return Ok(window);
    }
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == WINDOW_LABEL)
        .ok_or_else(|| "The tray card window config was not found.".to_string())?
        .clone();
    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| error.to_string())?
        .visible(false)
        .build()
        .map_err(|error| format!("Could not create the tray card window: {error}"))?;
    let handle = app.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::Focused(false) if is_open(&handle) => hide(&handle),
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            hide(&handle);
        }
        _ => {}
    });
    #[cfg(target_os = "macos")]
    crate::macos::tray_panel::make_tray_panel(&window)?;
    Ok(window)
}

pub(crate) fn toggle(app: &AppHandle, icon: Option<&tauri::Rect>) {
    if is_open(app) {
        hide(app);
        return;
    }
    let recently_hidden = HIDDEN_AT.lock().unwrap_or_else(PoisonError::into_inner).is_some_and(|at| at.elapsed() < REOPEN_GUARD);
    if recently_hidden {
        return;
    }
    let icon = icon_rect_copy(icon);
    let trace = WindowTrace::begin(WINDOW_LABEL, if card_window(app).is_some() { "reuse" } else { "create" });
    let handle = app.clone();
    let queued = app.run_on_main_thread(move || {
        if let Err(error) = open(&handle, icon_anchor(&handle, icon.as_ref()), trace) {
            eprintln!("failed to open the tray card: {error}");
            crate::tray::pop_up_native_menu(&handle);
        }
    });
    if let Err(error) = queued {
        eprintln!("failed to open the tray card: {error}");
    }
}

fn icon_rect_copy(rect: Option<&tauri::Rect>) -> Option<tauri::Rect> {
    rect.map(|rect| tauri::Rect { position: rect.position, size: rect.size })
}

fn icon_anchor(app: &AppHandle, icon: Option<&tauri::Rect>) -> Anchor {
    let displays = displays(app);
    let cursor = screen::cursor_position().unwrap_or((0.0, 0.0));
    Anchor { icon: icon.and_then(|rect| icon_in_screen_units(rect, &displays)), cursor }
}

fn open(app: &AppHandle, anchor: Anchor, mut trace: WindowTrace) -> Result<(), String> {
    trace.mark("queued");
    let existed = card_window(app).is_some();
    let window = create(app)?;
    if !existed {
        trace.mark("built");
    }
    *lock_trace() = Some(trace);
    *ANCHOR.lock().unwrap_or_else(PoisonError::into_inner) = Some(anchor);
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    position(app, &window);
    let _ = window.emit_to(WINDOW_LABEL, OPEN_EVENT, ());
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(SHOW_FALLBACK);
        if GENERATION.load(Ordering::SeqCst) == generation && !is_open(&app) {
            reveal(&app, "fallback");
        }
    });
    Ok(())
}

fn lock_trace() -> std::sync::MutexGuard<'static, Option<WindowTrace>> {
    PENDING_TRACE.lock().unwrap_or_else(PoisonError::into_inner)
}

fn finish_trace(app: &AppHandle, trace: Option<WindowTrace>, via: &'static str) {
    if let Some(mut trace) = trace {
        trace.mark("show");
        trace.finish(app, Some(via));
    }
}

fn take_ready_trace() -> Option<WindowTrace> {
    let mut trace = lock_trace().take();
    if let Some(trace) = trace.as_mut() {
        trace.mark("ready");
    }
    trace
}

fn position(app: &AppHandle, window: &WebviewWindow) {
    let Some(anchor) = *ANCHOR.lock().unwrap_or_else(PoisonError::into_inner) else { return };
    let size = *SIZE.lock().unwrap_or_else(PoisonError::into_inner);
    let screens: Vec<Screen> = displays(app).into_iter().map(|display| display.screen).collect();
    let probe = anchor.icon.map_or(anchor.cursor, |icon| ((icon.left + icon.right) / 2.0, (icon.top + icon.bottom) / 2.0));
    let Some(screen) = place::screen_for(&screens, probe).or_else(|| place::screen_for(&screens, anchor.cursor)).or_else(|| screens.first().copied()) else {
        return;
    };
    let (x, y) = place::place(PLATFORM, anchor.icon, anchor.cursor, &screen, size);
    let width = (size.0 * screen.scale).round().max(1.0) as u32;
    let height = (size.1 * screen.scale).round().max(1.0) as u32;
    let _ = screen::set_window_size(window, PhysicalSize::new(width, height));
    let _ = screen::set_window_position(window, PhysicalPosition::new(x as i32, y as i32));
}

pub(crate) fn resize(app: &AppHandle, width: f64, height: f64) -> Result<(), String> {
    if !(width.is_finite() && height.is_finite()) || width < 1.0 || height < 1.0 {
        return Err("The tray card size must be positive.".to_string());
    }
    *SIZE.lock().unwrap_or_else(PoisonError::into_inner) = (width.min(800.0), height.min(1200.0));
    let window = card_window(app).ok_or_else(|| "The tray card window is missing.".to_string())?;
    position(app, &window);
    if !window.is_visible().unwrap_or(false) && ANCHOR.lock().unwrap_or_else(PoisonError::into_inner).is_some() {
        reveal(app, "frontend");
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn reveal(app: &AppHandle, via: &'static str) {
    let trace = take_ready_trace();
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(window) = card_window(&handle) else { return };
        crate::webview_memory::showing(&window);
        if !crate::macos::tray_panel::show_tray_panel(&window) {
            let _ = window.show();
            let _ = window.set_focus();
        }
        finish_trace(&handle, trace, via);
    });
}

#[cfg(not(target_os = "macos"))]
fn reveal(app: &AppHandle, via: &'static str) {
    let trace = take_ready_trace();
    let Some(window) = card_window(app) else { return };
    crate::webview_memory::showing(&window);
    let _ = window.show();
    let _ = window.set_focus();
    finish_trace(app, trace, via);
}

pub(crate) fn hide(app: &AppHandle) {
    GENERATION.fetch_add(1, Ordering::SeqCst);
    lock_trace().take();
    *ANCHOR.lock().unwrap_or_else(PoisonError::into_inner) = None;
    let Some(window) = card_window(app) else { return };
    if !window.is_visible().unwrap_or(false) {
        return;
    }
    *HIDDEN_AT.lock().unwrap_or_else(PoisonError::into_inner) = Some(Instant::now());
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(window) = card_window(&handle) else { return };
        #[cfg(target_os = "macos")]
        crate::macos::tray_panel::hide_tray_panel(&window);
        let _ = window.destroy();
    });
}
