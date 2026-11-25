use serde::Deserialize;
use std::sync::{Mutex, PoisonError};
use tauri::AppHandle;

use super::{
    geometry::apply_stage_geometry,
    main_window,
    state::{read_window_state, IslandMode},
};

pub(crate) const ISLAND_BANNER_HOVER_CHANGED_EVENT: &str = "island-banner-hover-changed";

#[derive(Debug, Clone, Copy, PartialEq, Deserialize)]
pub struct BannerRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl BannerRect {
    pub(super) fn contains(self, x: f64, y: f64) -> bool {
        x >= self.x && x <= self.x + self.width && y >= self.y && y <= self.y + self.height
    }

    fn is_usable(self) -> bool {
        [self.x, self.y, self.width, self.height].iter().all(|value| value.is_finite())
            && self.width > 0.0
            && self.height > 0.0
    }
}

static BANNER_RECT: Mutex<Option<BannerRect>> = Mutex::new(None);
static SIDE_BUBBLE_RECT: Mutex<Option<BannerRect>> = Mutex::new(None);
static OVERFLOW_RECT: Mutex<Option<BannerRect>> = Mutex::new(None);

fn sync_stage_for_popup_change(app: &AppHandle, had_popup: bool) {
    if had_popup == has_active_popup() {
        return;
    }
    let state = read_window_state();
    if !matches!(state.mode, IslandMode::Collapsed) {
        return;
    }
    if let Ok(window) = main_window(app) {
        let _ = apply_stage_geometry(&window, state, false);
    }
}

fn update_rect(slot: &Mutex<Option<BannerRect>>, rect: Option<BannerRect>) -> bool {
    let had_popup = has_active_popup();
    *slot.lock().unwrap_or_else(PoisonError::into_inner) = rect.filter(|rect| rect.is_usable());
    had_popup
}

#[tauri::command]
pub fn set_island_banner_rect(app: AppHandle, rect: Option<BannerRect>) {
    let had_popup = update_rect(&BANNER_RECT, rect);
    sync_stage_for_popup_change(&app, had_popup);
}

#[tauri::command]
pub fn set_island_side_bubble_rect(rect: Option<BannerRect>) {
    *SIDE_BUBBLE_RECT.lock().unwrap_or_else(PoisonError::into_inner) = rect.filter(|rect| rect.is_usable());
}

#[tauri::command]
pub fn set_island_overflow_rect(app: AppHandle, rect: Option<BannerRect>) {
    let had_popup = update_rect(&OVERFLOW_RECT, rect);
    sync_stage_for_popup_change(&app, had_popup);
}

#[cfg(test)]
pub(super) fn set_banner_rect_for_test(rect: Option<BannerRect>) {
    let _ = update_rect(&BANNER_RECT, rect);
}

#[cfg(test)]
pub(super) fn set_overflow_rect_for_test(rect: Option<BannerRect>) {
    let _ = update_rect(&OVERFLOW_RECT, rect);
}

pub(super) fn has_active_popup() -> bool {
    BANNER_RECT.lock().unwrap_or_else(PoisonError::into_inner).is_some()
        || OVERFLOW_RECT.lock().unwrap_or_else(PoisonError::into_inner).is_some()
}

pub(super) fn banner_rect() -> Option<BannerRect> {
    let side_bubble = *SIDE_BUBBLE_RECT.lock().unwrap_or_else(PoisonError::into_inner);
    let overflow = *OVERFLOW_RECT.lock().unwrap_or_else(PoisonError::into_inner);
    side_bubble.or(overflow).or(*BANNER_RECT.lock().unwrap_or_else(PoisonError::into_inner))
}
