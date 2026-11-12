//! The guide is a transparent overlay over the island's screen. It takes the pointer only over its
//! cards (their rectangles come from the page), so the real island below and the desktop stay
//! usable, and it tells the page where the island is now, so the page can light it up.

use serde::{Deserialize, Serialize};
use std::{
    sync::{Mutex, PoisonError},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

use crate::{island::passthrough::island_on_screen, win32};

/// Mirrored by ONBOARDING_ISLAND_EVENT in src/windows/onboarding/api.ts. The payload is the
/// island in the overlay's CSS pixels with whether it is open, or null while it is hidden.
const ISLAND_EVENT: &str = "onboarding-island";
const TICK: Duration = Duration::from_millis(30);

/// A rectangle in the overlay's CSS pixels, as `getBoundingClientRect` gives it.
#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
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

/// The overlay's cards, which take the pointer; everywhere else it falls through.
#[tauri::command]
pub fn set_onboarding_card_rects(rects: Vec<Rect>) {
    let usable = rects.into_iter().filter(|rect| rect.is_usable()).collect();
    *CARDS.lock().unwrap_or_else(PoisonError::into_inner) = usable;
}

/// Runs while the overlay exists: follows the island and lets the pointer through outside the cards.
pub fn start(app: &AppHandle, overlay: WebviewWindow) {
    let island = app.get_webview_window(crate::island::WINDOW_LABEL);
    thread::spawn(move || {
        let island_hwnd = island.as_ref().and_then(|island| island.hwnd().ok());
        let mut ignoring = None;
        let mut last: Option<Option<IslandRect>> = None;
        loop {
            // The overlay was closed: stop.
            let Ok(origin) = overlay.outer_position() else { break };
            let Ok(scale) = overlay.scale_factor() else { break };
            let to_css = |x: f64, y: f64| ((x - f64::from(origin.x)) / scale, (y - f64::from(origin.y)) / scale);

            let shown = island.as_ref().is_some_and(|island| island.is_visible().unwrap_or(false));
            let rect = island_hwnd.filter(|_| shown).and_then(island_on_screen).map(|on_screen| {
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

            let on_card = win32::window::cursor_position().is_some_and(|cursor| {
                let (x, y) = to_css(f64::from(cursor.x), f64::from(cursor.y));
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
    use super::Rect;

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
}
