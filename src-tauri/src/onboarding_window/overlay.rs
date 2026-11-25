use serde::{Deserialize, Serialize};
use std::{
    sync::{Mutex, PoisonError},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

use crate::island::{passthrough::island_on_screen, screen};

const ISLAND_EVENT: &str = "onboarding-island";
const INSETS_EVENT: &str = "onboarding-insets";
const TICK: Duration = Duration::from_millis(30);

#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct SafeInsets {
    pub top: f64,
    pub bottom: f64,
    pub left: f64,
    pub right: f64,
}

impl Rect {
    fn contains(self, x: f64, y: f64) -> bool {
        x >= self.x && x <= self.x + self.width && y >= self.y && y <= self.y + self.height
    }

    fn is_usable(self) -> bool {
        [self.x, self.y, self.width, self.height].iter().all(|value| value.is_finite())
            && self.width > 0.0
            && self.height > 0.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
struct IslandRect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    expanded: bool,
}

static CARDS: Mutex<Vec<Rect>> = Mutex::new(Vec::new());

#[tauri::command]
pub fn set_onboarding_card_rects(rects: Vec<Rect>) {
    let usable = rects.into_iter().filter(|rect| rect.is_usable()).collect();
    *CARDS.lock().unwrap_or_else(PoisonError::into_inner) = usable;
}

pub(crate) fn safe_insets_from_bounds(
    overlay_pos: (i32, i32),
    overlay_size: (u32, u32),
    work_pos: (i32, i32),
    work_size: (u32, u32),
    scale: f64,
) -> SafeInsets {
    let divisor = if scale.is_finite() && scale > 0.0 { scale } else { 1.0 };
    let overlay_right = overlay_pos.0.saturating_add(overlay_size.0 as i32);
    let overlay_bottom = overlay_pos.1.saturating_add(overlay_size.1 as i32);
    let work_right = work_pos.0.saturating_add(work_size.0 as i32);
    let work_bottom = work_pos.1.saturating_add(work_size.1 as i32);
    SafeInsets {
        top: (f64::from((work_pos.1 - overlay_pos.1).max(0)) / divisor).ceil(),
        bottom: (f64::from((overlay_bottom - work_bottom).max(0)) / divisor).ceil(),
        left: (f64::from((work_pos.0 - overlay_pos.0).max(0)) / divisor).ceil(),
        right: (f64::from((overlay_right - work_right).max(0)) / divisor).ceil(),
    }
}

pub(crate) fn compute_safe_insets(overlay: &WebviewWindow) -> Option<SafeInsets> {
    let origin = screen::window_position(overlay).ok()?;
    let size = overlay.outer_size().ok()?;
    let scale = screen::window_scale(overlay).ok()?;
    let monitor = overlay.current_monitor().ok().flatten()?;
    let work = monitor.work_area();
    Some(safe_insets_from_bounds(
        (origin.x, origin.y),
        (size.width, size.height),
        (work.position.x, work.position.y),
        (work.size.width, work.size.height),
        scale,
    ))
}

pub(crate) fn emit_safe_insets(overlay: &WebviewWindow) {
    if let Some(insets) = compute_safe_insets(overlay) {
        let _ = overlay.emit_to(super::WINDOW_LABEL, INSETS_EVENT, insets);
    }
}

pub fn start(app: &AppHandle, overlay: WebviewWindow) {
    let island = app.get_webview_window(crate::island::WINDOW_LABEL);
    thread::spawn(move || {
        let mut ignoring = None;
        let mut last: Option<Option<IslandRect>> = None;
        let mut last_insets: Option<SafeInsets> = None;
        while let Ok(origin) = screen::window_position(&overlay) {
            let Ok(scale) = screen::window_scale(&overlay) else { break };
            let to_css = |x: f64, y: f64| ((x - f64::from(origin.x)) / scale, (y - f64::from(origin.y)) / scale);

            if let Some(insets) = compute_safe_insets(&overlay) {
                if last_insets != Some(insets) {
                    last_insets = Some(insets);
                    let _ = overlay.emit_to(super::WINDOW_LABEL, INSETS_EVENT, insets);
                }
            }

            let rect = island
                .as_ref()
                .filter(|island| island.is_visible().unwrap_or(false))
                .and_then(island_on_screen)
                .map(|on_screen| {
                    let (x, y) = to_css(on_screen.left, on_screen.top);
                    IslandRect {
                        x: round(x),
                        y: round(y),
                        width: round(on_screen.width / scale),
                        height: round(on_screen.height / scale),
                        expanded: on_screen.expanded,
                    }
                });
            if last != Some(rect) {
                last = Some(rect);
                let _ = overlay.emit_to(super::WINDOW_LABEL, ISLAND_EVENT, rect);
            }

            let on_card = screen::cursor_position().is_some_and(|(cursor_x, cursor_y)| {
                let (x, y) = to_css(cursor_x, cursor_y);
                CARDS.lock().unwrap_or_else(PoisonError::into_inner).iter().any(|card| card.contains(x, y))
            });
            let ignore = !on_card;
            if ignoring != Some(ignore) && overlay.set_ignore_cursor_events(ignore).is_ok() {
                ignoring = Some(ignore);
            }
            thread::sleep(TICK);
        }
        set_onboarding_card_rects(Vec::new());
    });
}

fn round(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::{safe_insets_from_bounds, Rect, SafeInsets};

    #[test]
    fn a_card_takes_the_points_on_it_only() {
        let card = Rect { x: 10.0, y: 20.0, width: 100.0, height: 50.0 };
        assert!(card.contains(10.0, 20.0));
        assert!(card.contains(110.0, 70.0));
        assert!(!card.contains(9.0, 30.0));
        assert!(!card.contains(50.0, 71.0));
    }

    #[test]
    fn empty_or_broken_rectangles_are_dropped() {
        assert!(!Rect { x: 0.0, y: 0.0, width: 0.0, height: 10.0 }.is_usable());
        assert!(!Rect { x: f64::NAN, y: 0.0, width: 5.0, height: 10.0 }.is_usable());
        assert!(Rect { x: -5.0, y: 0.0, width: 5.0, height: 10.0 }.is_usable());
    }

    #[test]
    fn safe_insets_subtract_work_area_for_menu_bar_and_dock() {
        assert_eq!(
            safe_insets_from_bounds((0, 0), (3024, 1964), (0, 74), (3024, 1738), 2.0),
            SafeInsets { top: 37.0, bottom: 76.0, left: 0.0, right: 0.0 }
        );
        assert_eq!(
            safe_insets_from_bounds((0, 0), (3024, 1964), (144, 74), (2880, 1890), 2.0),
            SafeInsets { top: 37.0, bottom: 0.0, left: 72.0, right: 0.0 }
        );
        assert_eq!(
            safe_insets_from_bounds((0, 0), (1920, 1032), (0, 0), (1920, 1032), 1.0),
            SafeInsets { top: 0.0, bottom: 0.0, left: 0.0, right: 0.0 }
        );
    }
}
