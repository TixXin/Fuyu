#![cfg_attr(not(windows), allow(dead_code))]

use serde::Deserialize;
use std::sync::{Mutex, PoisonError};

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

#[tauri::command]
pub fn set_island_banner_rect(rect: Option<BannerRect>) {
    *BANNER_RECT.lock().unwrap_or_else(PoisonError::into_inner) = rect.filter(|rect| rect.is_usable());
}

pub(super) fn banner_rect() -> Option<BannerRect> {
    *BANNER_RECT.lock().unwrap_or_else(PoisonError::into_inner)
}
