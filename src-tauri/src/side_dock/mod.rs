pub(crate) mod geometry;

use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, OnceLock,
    },
    thread,
    time::Duration,
};
use tauri::{
    AppHandle, Emitter, Manager, Monitor, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};

use crate::island::screen;
use geometry::{cursor_hits_dock, dock_window_rect, pick_outer_monitor, DockHitShape, ScreenRect, SideDockEdge};

pub(crate) const OPEN_PAGE_EVENT: &str = "side-dock-open-page";
pub(crate) const HOVER_EVENT: &str = "side-dock-hover";

const IDLE_POLL_MS: u64 = 36;
const ACTIVE_POLL_MS: u64 = 20;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenPagePayload {
    edge: SideDockEdge,
    page: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HoverPayload {
    edge: SideDockEdge,
    inside: bool,
}

#[derive(Clone, Copy)]
struct EdgeRuntime {
    shape: DockHitShape,
    inside: bool,
    ignoring: bool,
}

static WATCHER_STARTED: AtomicBool = AtomicBool::new(false);
static RUNTIME_STATE: OnceLock<Mutex<HashMap<SideDockEdge, EdgeRuntime>>> = OnceLock::new();

fn runtime_map() -> &'static Mutex<HashMap<SideDockEdge, EdgeRuntime>> {
    RUNTIME_STATE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn default_shape(edge: SideDockEdge) -> DockHitShape {
    DockHitShape {
        edge,
        expanded: false,
        strip_width: 0.0,
        strip_height: 0.0,
        gap: 0.0,
    }
}

fn set_edge_shape(edge: SideDockEdge, shape: DockHitShape) {
    if let Ok(mut map) = runtime_map().lock() {
        map.entry(edge)
            .and_modify(|entry| entry.shape = shape)
            .or_insert(EdgeRuntime { shape, inside: false, ignoring: false });
    }
}

fn remove_edge_state(edge: SideDockEdge) {
    if let Ok(mut map) = runtime_map().lock() {
        map.remove(&edge);
    }
}

fn ensure_hover_watcher(app: &AppHandle) {
    if WATCHER_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }
    let handle = app.clone();
    let _ = thread::Builder::new().name("side-dock-hover".into()).spawn(move || {
        loop {
            let entries: Vec<(SideDockEdge, EdgeRuntime)> = runtime_map()
                .lock()
                .map(|map| map.iter().map(|(&k, &v)| (k, v)).collect())
                .unwrap_or_default();
            if entries.is_empty() {
                thread::sleep(Duration::from_millis(120));
                continue;
            }
            let cursor = screen::cursor_position();
            let mut any_active = false;
            if let Some((cx, cy)) = cursor {
                for (edge, state) in entries {
                    let Some(window) = handle.get_webview_window(edge.label()) else {
                        continue;
                    };
                    if !window.is_visible().unwrap_or(false) {
                        continue;
                    }
                    let (Ok(pos), Ok(size), Ok(scale)) = (
                        screen::window_position(&window),
                        screen::window_size(&window),
                        screen::window_scale(&window),
                    ) else {
                        continue;
                    };
                    let inside = cursor_hits_dock(
                        f64::from(pos.x),
                        f64::from(pos.y),
                        f64::from(size.width.max(1)),
                        f64::from(size.height.max(1)),
                        scale,
                        state.shape,
                        cx,
                        cy,
                    );
                    if inside || state.shape.expanded {
                        any_active = true;
                    }
                    let should_ignore = state.shape.expanded && !inside;
                    if should_ignore != state.ignoring {
                        let _ = window.set_ignore_cursor_events(should_ignore);
                    }
                    if inside != state.inside {
                        let _ = handle.emit_to(edge.label(), HOVER_EVENT, HoverPayload { edge, inside });
                    }
                    if let Ok(mut map) = runtime_map().lock() {
                        if let Some(entry) = map.get_mut(&edge) {
                            entry.inside = inside;
                            entry.ignoring = should_ignore;
                        }
                    }
                }
            }
            thread::sleep(Duration::from_millis(if any_active { ACTIVE_POLL_MS } else { IDLE_POLL_MS }));
        }
    });
}

fn monitor_full_rect(monitor: &Monitor) -> ScreenRect {
    let origin = screen::monitor_origin(monitor);
    let size = screen::monitor_size(monitor);
    ScreenRect {
        left: origin.x,
        top: origin.y,
        width: size.width as i32,
        height: size.height as i32,
    }
}

fn monitor_work_rect(monitor: &Monitor) -> ScreenRect {
    let (left, top, width, height) = screen::monitor_work_rect(monitor);
    ScreenRect { left, top, width, height }
}

fn target_monitor(app: &AppHandle, edge: SideDockEdge) -> Option<Monitor> {
    let monitors = app.available_monitors().ok()?;
    if monitors.is_empty() {
        return app.primary_monitor().ok().flatten();
    }
    let primary_rect = app.primary_monitor().ok().flatten().map(|m| monitor_full_rect(&m));
    let rects: Vec<ScreenRect> = monitors.iter().map(monitor_full_rect).collect();
    let primary_index = primary_rect.and_then(|target| rects.iter().position(|rect| *rect == target));
    let chosen = pick_outer_monitor(edge, primary_index, &rects)?;
    monitors.into_iter().nth(chosen)
}

fn apply_geometry(app: &AppHandle, window: &WebviewWindow, edge: SideDockEdge, width: f64, height: f64, along: f64) -> Result<(), String> {
    let Some(monitor) = target_monitor(app, edge) else {
        return Ok(());
    };
    let work = monitor_work_rect(&monitor);
    let scale = screen::monitor_scale(&monitor);
    let (x, y, w, h) = dock_window_rect(edge, work, scale, width, height, along);
    let current_w = screen::window_size(window).map(|s| s.width).unwrap_or(0);
    if edge == SideDockEdge::Right && w > current_w {
        screen::set_window_position(window, PhysicalPosition::new(x, y))?;
        screen::set_window_size(window, PhysicalSize::new(w, h))
    } else {
        screen::set_window_size(window, PhysicalSize::new(w, h))?;
        screen::set_window_position(window, PhysicalPosition::new(x, y))
    }
}

fn create_window(app: &AppHandle, edge: SideDockEdge, width: f64, height: f64) -> Result<WebviewWindow, String> {
    let label = edge.label();
    if let Some(existing) = app.get_webview_window(label) {
        return Ok(existing);
    }
    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(edge.url().into()))
        .title("Fuyu Side Dock")
        .inner_size(width.max(12.0), height.max(48.0))
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false);
    let window = builder
        .build()
        .map_err(|error| format!("Could not create {label}: {error}"))?;
    let handle = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            if let Some(win) = handle.get_webview_window(label) {
                let _ = win.hide();
            }
        }
    });
    #[cfg(target_os = "macos")]
    crate::macos::island_panel::make_side_dock_panel(&window)?;
    Ok(window)
}

fn show_window(app: &AppHandle, window: &WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if crate::macos::island_panel::show_panel_without_key(app, window.label()) {
            return Ok(());
        }
    }
    let _ = app;
    window.show().map_err(|error| error.to_string())
}

fn destroy_window(app: &AppHandle, edge: SideDockEdge) {
    remove_edge_state(edge);
    let label = edge.label();
    #[cfg(target_os = "macos")]
    crate::macos::island_panel::forget_panel(app, label);
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.hide();
        let _ = window.destroy();
    }
}

#[tauri::command]
pub async fn sync_side_dock(
    app: AppHandle,
    edge: SideDockEdge,
    enabled: bool,
    width: f64,
    height: f64,
    along: f64,
) -> Result<(), String> {
    let handle = app.clone();
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let result = if !enabled {
            destroy_window(&handle, edge);
            Ok(())
        } else {
            set_edge_shape(edge, default_shape(edge));
            ensure_hover_watcher(&handle);
            create_window(&handle, edge, width, height).and_then(|window| {
                apply_geometry(&handle, &window, edge, width, height, along)?;
                show_window(&handle, &window)
            })
        };
        let _ = tx.send(result);
    })
    .map_err(|error| error.to_string())?;
    rx.recv().map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn set_side_dock_geometry(
    app: AppHandle,
    edge: SideDockEdge,
    width: f64,
    height: f64,
    along: f64,
    expanded: Option<bool>,
    strip_width: Option<f64>,
    strip_height: Option<f64>,
    gap: Option<f64>,
) -> Result<(), String> {
    let shape = DockHitShape {
        edge,
        expanded: expanded.unwrap_or(false),
        strip_width: strip_width.unwrap_or(0.0),
        strip_height: strip_height.unwrap_or(0.0),
        gap: gap.unwrap_or(0.0),
    };
    set_edge_shape(edge, shape);
    ensure_hover_watcher(&app);
    let handle = app.clone();
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let result = if let Some(window) = handle.get_webview_window(edge.label()) {
            let _ = window.set_ignore_cursor_events(false);
            apply_geometry(&handle, &window, edge, width, height, along)
        } else {
            Ok(())
        };
        let _ = tx.send(result);
    })
    .map_err(|error| error.to_string())?;
    rx.recv().map_err(|error| error.to_string())?
}

fn hide_window(window: &WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if crate::macos::tray_panel::hide_tray_panel(window) {
            return Ok(());
        }
    }
    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn set_side_dock_visible(app: AppHandle, edge: SideDockEdge, visible: bool) -> Result<(), String> {
    let handle = app.clone();
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let result = if let Some(window) = handle.get_webview_window(edge.label()) {
            if visible {
                show_window(&handle, &window)
            } else {
                hide_window(&window)
            }
        } else {
            Ok(())
        };
        let _ = tx.send(result);
    })
    .map_err(|error| error.to_string())?;
    rx.recv().map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn request_side_dock_page(app: AppHandle, edge: SideDockEdge, page: String) -> Result<(), String> {
    let label = edge.label();
    let payload = OpenPagePayload { edge, page };
    let _ = app.emit_to(label, OPEN_PAGE_EVENT, payload);
    Ok(())
}

macro_rules! tauri_commands {
    ($cb:ident [$($acc:tt)*] $($rest:ident);*) => {
        $cb!([$($acc)*
            crate::side_dock::sync_side_dock,
            crate::side_dock::set_side_dock_geometry,
            crate::side_dock::set_side_dock_visible,
            crate::side_dock::request_side_dock_page,
        ] $($rest);*)
    };
}
pub(crate) use tauri_commands;
