use std::{
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Mutex, PoisonError,
    },
    thread,
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

use super::popup_place::WINDOW_LABEL as POPUP_LABEL;
use super::preview_size::{self, Edge, PreviewSize, SizeRequest};
use crate::island::screen;

pub(crate) const WINDOW_LABEL: &str = "clipboard-preview";
const OPENED_EVENT: &str = "clipboard-preview-opened";
const CLOSING_EVENT: &str = "clipboard-preview-closing";
const LAYOUT_EVENT: &str = "clipboard-preview-layout";
const GAP: f64 = 8.0;
const EXIT: Duration = Duration::from_millis(150);
const BLUR_SETTLE: Duration = Duration::from_millis(120);

static GENERATION: AtomicU64 = AtomicU64::new(0);
static EDITING: AtomicBool = AtomicBool::new(false);
static RESTORE: Mutex<Option<PreviewSize>> = Mutex::new(None);
static DRAG: Mutex<Option<Drag>> = Mutex::new(None);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Side {
    Left,
    Right,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct Rect {
    pub(super) left: i32,
    pub(super) top: i32,
    pub(super) right: i32,
    pub(super) bottom: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Layout {
    side: Side,
    size: PreviewSize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum DragPhase {
    Start,
    Move,
    End,
}

#[derive(Debug, Clone, Copy)]
struct Drag {
    start: Rect,
    area: Rect,
    scale: f64,
}

struct Screen {
    anchor: Rect,
    area: Rect,
    scale: f64,
}

pub(super) fn place_beside(anchor: Rect, size: (i32, i32), area: Rect, gap: i32) -> (i32, i32, Side) {
    let (width, height) = size;
    let right = anchor.right + gap;
    let left = anchor.left - gap - width;
    let (x, side) = if right + width <= area.right {
        (right, Side::Right)
    } else if left >= area.left {
        (left, Side::Left)
    } else if area.right - anchor.right >= anchor.left - area.left {
        ((area.right - width).max(area.left), Side::Right)
    } else {
        (area.left, Side::Left)
    };
    let y = anchor.top.clamp(area.top, (area.bottom - height).max(area.top));
    (x, y, side)
}

fn preview_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(WINDOW_LABEL)
        .ok_or_else(|| "The clipboard preview window is missing.".to_string())
}

fn popup_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(POPUP_LABEL)
        .ok_or_else(|| "The clipboard window is missing.".to_string())
}

fn window_rect(window: &WebviewWindow) -> Result<Rect, String> {
    let position = screen::window_position(window)?;
    let size = screen::window_size(window)?;
    Ok(Rect { left: position.x, top: position.y, right: position.x + size.width as i32, bottom: position.y + size.height as i32 })
}

fn popup_screen(app: &AppHandle) -> Result<Screen, String> {
    let popup = popup_window(app)?;
    let anchor = window_rect(&popup)?;
    let monitor = popup.current_monitor().ok().flatten();
    let scale = monitor.as_ref().map(screen::monitor_scale).unwrap_or(1.0);
    let area = monitor.map_or(Rect { left: i32::MIN / 2, top: i32::MIN / 2, right: i32::MAX / 2, bottom: i32::MAX / 2 }, |monitor| {
        let (left, top, width, height) = screen::monitor_work_rect(&monitor);
        Rect { left, top, right: left + width, bottom: top + height }
    });
    Ok(Screen { anchor, area, scale })
}

fn preview_settings() -> preview_size::PreviewSettings {
    super::service()
        .and_then(|service| service.snapshot())
        .map(|snapshot| snapshot.settings.preview)
        .unwrap_or_default()
}

fn set_bounds(window: &WebviewWindow, rect: Rect) {
    let width = (rect.right - rect.left).max(1) as u32;
    let height = (rect.bottom - rect.top).max(1) as u32;
    let _ = screen::set_window_size(window, PhysicalSize::new(width, height));
    let _ = screen::set_window_position(window, PhysicalPosition::new(rect.left, rect.top));
}

fn arrange(app: &AppHandle, preview: &WebviewWindow) -> Result<Layout, String> {
    let settings = preview_settings();
    let screen = popup_screen(app)?;
    let gap = (GAP * screen.scale).round() as i32;
    let (rect, side) = preview_size::frame(settings.size(), settings.custom(), screen.anchor, screen.area, screen.scale, gap);
    set_bounds(preview, rect);
    let layout = Layout { side, size: settings.size() };
    let _ = preview.emit_to(WINDOW_LABEL, LAYOUT_EVENT, layout);
    Ok(layout)
}

fn show(app: &AppHandle) -> Result<Side, String> {
    GENERATION.fetch_add(1, Ordering::SeqCst);
    let preview = preview_window(app)?;
    let hidden = super::service()
        .and_then(|service| service.snapshot())
        .map(|snapshot| snapshot.settings.hide_from_capture)
        .unwrap_or(true);
    let _ = preview.set_content_protected(hidden);
    let layout = arrange(app, &preview)?;
    show_without_focus(&preview)?;
    keep_below_popup(app, &preview);
    let _ = preview.emit_to(WINDOW_LABEL, OPENED_EVENT, layout.side);
    Ok(layout.side)
}

#[cfg(windows)]
fn keep_below_popup(app: &AppHandle, preview: &WebviewWindow) {
    let (Ok(popup), Ok(below)) = (popup_window(app), preview.hwnd()) else { return };
    if let Ok(above) = popup.hwnd() {
        crate::win32::window::place_below(below, above);
    }
}

#[cfg(not(windows))]
fn keep_below_popup(_app: &AppHandle, _preview: &WebviewWindow) {}

#[cfg(windows)]
fn show_without_focus(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|error| error.to_string())?;
    crate::win32::window::show_without_activating(hwnd);
    Ok(())
}

#[cfg(target_os = "macos")]
const MAC_LEVELS_ABOVE_MENU_BAR: i64 = 3;

#[cfg(target_os = "macos")]
fn show_without_focus(window: &WebviewWindow) -> Result<(), String> {
    let app = window.app_handle().clone();
    let fallback = window.clone();
    window
        .run_on_main_thread(move || {
            use tauri_nspanel::{ManagerExt, PanelLevel};
            if let Ok(panel) = app.get_webview_panel(WINDOW_LABEL) {
                panel.set_level(PanelLevel::MainMenu.value() + MAC_LEVELS_ABOVE_MENU_BAR);
            }
            if !crate::macos::island_panel::show_panel_without_key(&app, WINDOW_LABEL) {
                let _ = fallback.show();
            }
        })
        .map_err(|error| error.to_string())
}

#[cfg(not(any(windows, target_os = "macos")))]
fn show_without_focus(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())
}

#[cfg(windows)]
fn hide_now(window: &WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        crate::win32::window::hide_window(hwnd);
    }
}

#[cfg(not(windows))]
fn hide_now(window: &WebviewWindow) {
    let _ = window.hide();
}

pub(crate) fn hide(app: &AppHandle, animate: bool) {
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let Ok(window) = preview_window(app) else { return };
    if EDITING.swap(false, Ordering::SeqCst) {
        take_keys(&window, false);
    }
    if !window.is_visible().unwrap_or(false) {
        return;
    }
    if !animate {
        hide_now(&window);
        return;
    }
    let _ = window.emit_to(WINDOW_LABEL, CLOSING_EVENT, ());
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(EXIT);
        if GENERATION.load(Ordering::SeqCst) == generation {
            if let Ok(window) = preview_window(&app) {
                hide_now(&window);
            }
        }
    });
}

fn restore_size(settings: &preview_size::PreviewSettings) -> PreviewSize {
    let remembered = *RESTORE.lock().unwrap_or_else(PoisonError::into_inner);
    remembered.unwrap_or(if settings.custom().is_some() { PreviewSize::Custom } else { PreviewSize::Standard })
}

fn save_preview(change: impl FnOnce(&mut preview_size::PreviewSettings)) -> Result<(), String> {
    let service = super::service()?;
    let mut settings = service.snapshot()?.settings;
    let current = settings.preview.size();
    change(&mut settings.preview);
    if current != PreviewSize::Full && settings.preview.size() != current {
        *RESTORE.lock().unwrap_or_else(PoisonError::into_inner) = Some(current);
    }
    service.set_settings(settings).map(|_| ())
}

fn rearrange(app: &AppHandle) -> Result<Layout, String> {
    let preview = preview_window(app)?;
    if !preview.is_visible().unwrap_or(false) {
        let settings = preview_settings();
        return Ok(Layout { side: Side::Right, size: settings.size() });
    }
    arrange(app, &preview)
}

fn resize(app: &AppHandle, edge: Edge, delta: (f64, f64), phase: DragPhase) -> Result<(), String> {
    let preview = preview_window(app)?;
    let mut slot = DRAG.lock().unwrap_or_else(PoisonError::into_inner);
    if phase == DragPhase::Start {
        let screen = popup_screen(app)?;
        *slot = Some(Drag { start: window_rect(&preview)?, area: screen.area, scale: screen.scale });
    }
    let Some(drag) = *slot else { return Ok(()) };
    let scaled = |value: f64| (value * drag.scale).round() as i32;
    let min = (scaled(preview_size::MIN_WIDTH), scaled(preview_size::MIN_HEIGHT));
    let rect = preview_size::resized(drag.start, edge, (scaled(delta.0), scaled(delta.1)), min, drag.area);
    set_bounds(&preview, rect);
    if phase != DragPhase::End {
        return Ok(());
    }
    *slot = None;
    drop(slot);
    let logical = |value: i32| (f64::from(value) / drag.scale).round() as u32;
    save_preview(|settings| settings.set_custom(logical(rect.right - rect.left), logical(rect.bottom - rect.top)))?;
    rearrange(app).map(|_| ())
}

fn has_pointer(app: &AppHandle) -> bool {
    let Ok(preview) = preview_window(app) else { return false };
    if !preview.is_visible().unwrap_or(false) {
        return false;
    }
    let (Ok(rect), Some((x, y))) = (window_rect(&preview), screen::cursor_position()) else { return false };
    let (x, y) = (x.round() as i32, y.round() as i32);
    x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
}

pub(crate) fn editing() -> bool {
    EDITING.load(Ordering::SeqCst)
}

#[cfg(windows)]
fn take_keys(window: &WebviewWindow, on: bool) {
    let _ = window.set_focusable(on);
    if on {
        if let Ok(hwnd) = window.hwnd() {
            crate::win32::window::force_foreground(hwnd);
        }
    }
}

#[cfg(target_os = "macos")]
fn take_keys(window: &WebviewWindow, on: bool) {
    let target = window.clone();
    let _ = window.run_on_main_thread(move || crate::macos::preview_panel::take_keys(&target, on));
}

#[cfg(not(any(windows, target_os = "macos")))]
fn take_keys(window: &WebviewWindow, on: bool) {
    let _ = window.set_focusable(on);
    if on {
        let _ = window.set_focus();
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum EditEnd {
    #[default]
    Refocus,
    Leave,
    Blur,
}

fn set_editing(app: &AppHandle, on: bool, then: EditEnd) -> Result<(), String> {
    let preview = preview_window(app)?;
    if on && !preview.is_visible().unwrap_or(false) {
        return Err("The clipboard preview is not open.".to_string());
    }
    if EDITING.swap(on, Ordering::SeqCst) == on {
        return Ok(());
    }
    if on {
        take_keys(&preview, true);
        return Ok(());
    }
    if then == EditEnd::Refocus {
        super::refocus_popup(app);
    }
    take_keys(&preview, false);
    keep_below_popup(app, &preview);
    if then == EditEnd::Blur {
        let app = app.clone();
        thread::spawn(move || {
            thread::sleep(BLUR_SETTLE);
            let focused = popup_window(&app).ok().and_then(|popup| popup.is_focused().ok()).unwrap_or(false);
            if !focused && !editing() {
                let _ = super::hide_on_blur(&app);
            }
        });
    }
    Ok(())
}

#[tauri::command]
pub async fn set_clipboard_preview_editing(app: AppHandle, editing: bool, then: Option<EditEnd>) -> Result<(), String> {
    set_editing(&app, editing, then.unwrap_or_default())
}

#[tauri::command]
pub async fn show_clipboard_preview(app: AppHandle) -> Result<Side, String> {
    show(&app)
}

#[tauri::command]
pub async fn hide_clipboard_preview(app: AppHandle) -> Result<(), String> {
    hide(&app, true);
    Ok(())
}

#[tauri::command]
pub async fn set_clipboard_preview_size(app: AppHandle, size: SizeRequest) -> Result<Layout, String> {
    let settings = preview_settings();
    let next = preview_size::requested(settings.size(), size, restore_size(&settings));
    save_preview(|settings| settings.set_size(next))?;
    rearrange(&app)
}

#[tauri::command]
pub async fn resize_clipboard_preview(app: AppHandle, edge: Edge, dx: f64, dy: f64, phase: DragPhase) -> Result<(), String> {
    resize(&app, edge, (dx, dy), phase)
}

#[tauri::command]
pub async fn clipboard_preview_has_pointer(app: AppHandle) -> bool {
    has_pointer(&app)
}

#[cfg(test)]
mod tests {
    use super::{place_beside, Rect, Side};

    const AREA: Rect = Rect { left: 0, top: 0, right: 1920, bottom: 1040 };

    fn anchor(left: i32, top: i32) -> Rect {
        Rect { left, top, right: left + 380, bottom: top + 559 }
    }

    #[test]
    fn the_preview_goes_right_when_it_fits_and_left_otherwise() {
        assert_eq!(place_beside(anchor(100, 100), (420, 559), AREA, 8), (488, 100, Side::Right));
        assert_eq!(place_beside(anchor(1500, 100), (420, 559), AREA, 8), (1072, 100, Side::Left));
    }

    #[test]
    fn the_preview_stays_on_the_work_area() {
        assert_eq!(place_beside(anchor(100, 700), (420, 559), AREA, 8), (488, 481, Side::Right));
        let narrow = Rect { left: 0, top: 0, right: 900, bottom: 1040 };
        assert_eq!(place_beside(anchor(200, 0), (420, 559), narrow, 8), (480, 0, Side::Right));
        assert_eq!(place_beside(anchor(320, 0), (420, 559), narrow, 8), (0, 0, Side::Left));
    }
}
