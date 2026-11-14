use std::{
    sync::atomic::{AtomicU64, Ordering},
    thread,
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewWindow};

use super::popup_place::WINDOW_LABEL as POPUP_LABEL;

pub(crate) const WINDOW_LABEL: &str = "clipboard-preview";
const OPENED_EVENT: &str = "clipboard-preview-opened";
const CLOSING_EVENT: &str = "clipboard-preview-closing";
const WIDTH: f64 = 420.0;
const GAP: f64 = 8.0;
const EXIT: Duration = Duration::from_millis(150);

static GENERATION: AtomicU64 = AtomicU64::new(0);

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

pub(crate) fn prepare(app: &AppHandle) {
    #[cfg(windows)]
    if let Ok(hwnd) = preview_window(app).and_then(|window| window.hwnd().map_err(|error| error.to_string())) {
        crate::win32::window::make_no_activate(hwnd);
    }
    #[cfg(not(windows))]
    let _ = app;
}

fn show(app: &AppHandle) -> Result<Side, String> {
    GENERATION.fetch_add(1, Ordering::SeqCst);
    let popup = app
        .get_webview_window(POPUP_LABEL)
        .ok_or_else(|| "The clipboard window is missing.".to_string())?;
    let preview = preview_window(app)?;
    let position = popup.outer_position().map_err(|error| error.to_string())?;
    let size = popup.outer_size().map_err(|error| error.to_string())?;
    let anchor = Rect {
        left: position.x,
        top: position.y,
        right: position.x + size.width as i32,
        bottom: position.y + size.height as i32,
    };
    let monitor = popup.current_monitor().ok().flatten();
    let scale = monitor.as_ref().map(|monitor| monitor.scale_factor()).unwrap_or(1.0);
    let area = monitor.map_or(Rect { left: i32::MIN / 2, top: i32::MIN / 2, right: i32::MAX / 2, bottom: i32::MAX / 2 }, |monitor| {
        let work = monitor.work_area();
        Rect {
            left: work.position.x,
            top: work.position.y,
            right: work.position.x + work.size.width as i32,
            bottom: work.position.y + work.size.height as i32,
        }
    });
    let width = (WIDTH * scale).round() as i32;
    let height = size.height as i32;
    let (x, y, side) = place_beside(anchor, (width, height), area, (GAP * scale).round() as i32);
    let hidden = super::service()
        .and_then(|service| service.snapshot())
        .map(|snapshot| snapshot.settings.hide_from_capture)
        .unwrap_or(true);
    let _ = preview.set_content_protected(hidden);
    let _ = preview.set_size(Size::Physical(PhysicalSize::new(width.max(1) as u32, height.max(1) as u32)));
    let _ = preview.set_position(Position::Physical(PhysicalPosition::new(x, y)));
    let _ = preview.emit_to(WINDOW_LABEL, OPENED_EVENT, side);
    show_without_focus(&preview)?;
    Ok(side)
}

#[cfg(windows)]
fn show_without_focus(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|error| error.to_string())?;
    crate::win32::window::show_without_activating(hwnd);
    Ok(())
}

#[cfg(not(windows))]
fn show_without_focus(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())
}

pub(crate) fn hide(app: &AppHandle, animate: bool) {
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let Ok(window) = preview_window(app) else { return };
    if !window.is_visible().unwrap_or(false) {
        return;
    }
    if !animate {
        let _ = window.hide();
        return;
    }
    let _ = window.emit_to(WINDOW_LABEL, CLOSING_EVENT, ());
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(EXIT);
        if GENERATION.load(Ordering::SeqCst) == generation {
            if let Ok(window) = preview_window(&app) {
                let _ = window.hide();
            }
        }
    });
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
