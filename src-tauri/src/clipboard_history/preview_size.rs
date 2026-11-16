use serde::{Deserialize, Serialize};

use super::preview_window::{place_beside, Rect, Side};

pub(super) const STANDARD_WIDTH: f64 = 420.0;
pub(super) const MIN_WIDTH: f64 = 320.0;
pub(super) const MIN_HEIGHT: f64 = 240.0;
const MEDIUM_WIDTH_SHARE: f64 = 0.6;
const MEDIUM_HEIGHT_SHARE: f64 = 0.75;
const MAX_CUSTOM: u32 = 16_384;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum PreviewSize {
    #[default]
    Standard,
    Medium,
    Full,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum SizeRequest {
    Standard,
    Medium,
    Full,
    Next,
    ToggleFull,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Edge {
    N,
    S,
    E,
    W,
    Ne,
    Nw,
    Se,
    Sw,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PreviewSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    preview_size: Option<PreviewSize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    preview_width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    preview_height: Option<u32>,
}

impl PreviewSettings {
    pub(super) fn normalized(mut self) -> Self {
        self.preview_width = self.preview_width.map(|width| width.clamp(MIN_WIDTH as u32, MAX_CUSTOM));
        self.preview_height = self.preview_height.map(|height| height.clamp(MIN_HEIGHT as u32, MAX_CUSTOM));
        if self.preview_size == Some(PreviewSize::Custom) && self.custom().is_none() {
            self.preview_size = Some(PreviewSize::Standard);
        }
        self
    }

    pub(super) fn size(&self) -> PreviewSize {
        self.preview_size.unwrap_or_default()
    }

    pub(super) fn custom(&self) -> Option<(u32, u32)> {
        Some((self.preview_width?, self.preview_height?))
    }

    pub(super) fn set_size(&mut self, size: PreviewSize) {
        self.preview_size = Some(size);
    }

    pub(super) fn set_custom(&mut self, width: u32, height: u32) {
        self.preview_size = Some(PreviewSize::Custom);
        self.preview_width = Some(width.clamp(MIN_WIDTH as u32, MAX_CUSTOM));
        self.preview_height = Some(height.clamp(MIN_HEIGHT as u32, MAX_CUSTOM));
    }
}

pub(super) fn requested(current: PreviewSize, request: SizeRequest, restore: PreviewSize) -> PreviewSize {
    match request {
        SizeRequest::Standard => PreviewSize::Standard,
        SizeRequest::Medium => PreviewSize::Medium,
        SizeRequest::Full => PreviewSize::Full,
        SizeRequest::Next => match current {
            PreviewSize::Standard | PreviewSize::Custom => PreviewSize::Medium,
            PreviewSize::Medium => PreviewSize::Full,
            PreviewSize::Full => PreviewSize::Standard,
        },
        SizeRequest::ToggleFull if current == PreviewSize::Full => restore,
        SizeRequest::ToggleFull => PreviewSize::Full,
    }
}

fn fit(width: i32, height: i32, area: Rect) -> (i32, i32) {
    (width.min(area.right - area.left).max(1), height.min(area.bottom - area.top).max(1))
}

pub(super) fn frame(size: PreviewSize, custom: Option<(u32, u32)>, anchor: Rect, area: Rect, scale: f64, gap: i32) -> (Rect, Side) {
    let scaled = |value: f64| (value * scale).round() as i32;
    let anchor_height = anchor.bottom - anchor.top;
    let (width, height) = match (size, custom) {
        (PreviewSize::Full, _) => {
            let side = if area.right - anchor.right >= anchor.left - area.left { Side::Right } else { Side::Left };
            return (area, side);
        }
        (PreviewSize::Medium, _) => {
            let width = (f64::from(area.right - area.left) * MEDIUM_WIDTH_SHARE).round() as i32;
            let height = (f64::from(area.bottom - area.top) * MEDIUM_HEIGHT_SHARE).round() as i32;
            (width.max(scaled(STANDARD_WIDTH)), height.max(anchor_height))
        }
        (PreviewSize::Custom, Some((width, height))) => (scaled(f64::from(width)), scaled(f64::from(height))),
        _ => (scaled(STANDARD_WIDTH), anchor_height),
    };
    let (width, height) = fit(width, height, area);
    let (x, y, side) = place_beside(anchor, (width, height), area, gap);
    (Rect { left: x, top: y, right: x + width, bottom: y + height }, side)
}

pub(super) fn resized(start: Rect, edge: Edge, (dx, dy): (i32, i32), min: (i32, i32), area: Rect) -> Rect {
    let mut next = start;
    let (west, east, north, south) = match edge {
        Edge::N => (false, false, true, false),
        Edge::S => (false, false, false, true),
        Edge::E => (false, true, false, false),
        Edge::W => (true, false, false, false),
        Edge::Ne => (false, true, true, false),
        Edge::Nw => (true, false, true, false),
        Edge::Se => (false, true, false, true),
        Edge::Sw => (true, false, false, true),
    };
    if west {
        next.left = (start.left + dx).clamp(area.left.min(start.right - min.0), start.right - min.0);
    }
    if east {
        next.right = (start.right + dx).clamp(start.left + min.0, area.right.max(start.left + min.0));
    }
    if north {
        next.top = (start.top + dy).clamp(area.top.min(start.bottom - min.1), start.bottom - min.1);
    }
    if south {
        next.bottom = (start.bottom + dy).clamp(start.top + min.1, area.bottom.max(start.top + min.1));
    }
    next
}

#[cfg(test)]
mod tests {
    use super::{frame, requested, resized, Edge, PreviewSettings, PreviewSize, Rect, SizeRequest};
    use crate::clipboard_history::preview_window::Side;

    const AREA: Rect = Rect { left: 0, top: 0, right: 1920, bottom: 1040 };

    fn anchor(left: i32, top: i32) -> Rect {
        Rect { left, top, right: left + 380, bottom: top + 559 }
    }

    fn rect(left: i32, top: i32, width: i32, height: i32) -> Rect {
        Rect { left, top, right: left + width, bottom: top + height }
    }

    #[test]
    fn standard_keeps_the_old_size_beside_the_popup() {
        assert_eq!(frame(PreviewSize::Standard, None, anchor(100, 100), AREA, 1.0, 8), (rect(488, 100, 420, 559), Side::Right));
        assert_eq!(frame(PreviewSize::Standard, None, anchor(100, 100), AREA, 1.5, 12), (rect(492, 100, 630, 559), Side::Right));
        assert_eq!(frame(PreviewSize::Standard, None, anchor(1500, 100), AREA, 1.0, 8), (rect(1072, 100, 420, 559), Side::Left));
    }

    #[test]
    fn medium_takes_a_share_of_the_work_area_and_flips_sides() {
        assert_eq!(frame(PreviewSize::Medium, None, anchor(100, 100), AREA, 1.0, 8), (rect(488, 100, 1152, 780), Side::Right));
        assert_eq!(frame(PreviewSize::Medium, None, anchor(1400, 100), AREA, 1.0, 8), (rect(240, 100, 1152, 780), Side::Left));
        assert_eq!(frame(PreviewSize::Medium, None, anchor(1400, 600), AREA, 1.0, 8), (rect(240, 260, 1152, 780), Side::Left));
    }

    #[test]
    fn full_covers_the_work_area_of_the_popup_screen() {
        let second = Rect { left: 1920, top: 0, right: 3840, bottom: 1080 };
        assert_eq!(frame(PreviewSize::Full, None, anchor(2000, 100), second, 1.0, 8), (second, Side::Right));
        assert_eq!(frame(PreviewSize::Full, None, anchor(1500, 100), AREA, 1.0, 8), (AREA, Side::Left));
    }

    #[test]
    fn custom_sizes_are_scaled_and_kept_on_the_work_area() {
        assert_eq!(frame(PreviewSize::Custom, Some((600, 500)), anchor(100, 100), AREA, 1.0, 8), (rect(488, 100, 600, 500), Side::Right));
        assert_eq!(frame(PreviewSize::Custom, Some((600, 500)), anchor(100, 100), AREA, 2.0, 16), (rect(496, 40, 1200, 1000), Side::Right));
        assert_eq!(frame(PreviewSize::Custom, Some((4000, 3000)), anchor(100, 100), AREA, 1.0, 8), (AREA, Side::Right));
        assert_eq!(frame(PreviewSize::Custom, None, anchor(100, 100), AREA, 1.0, 8), (rect(488, 100, 420, 559), Side::Right));
    }

    #[test]
    fn the_size_key_cycles_three_steps_and_double_click_toggles_full() {
        assert_eq!(requested(PreviewSize::Standard, SizeRequest::Next, PreviewSize::Standard), PreviewSize::Medium);
        assert_eq!(requested(PreviewSize::Medium, SizeRequest::Next, PreviewSize::Standard), PreviewSize::Full);
        assert_eq!(requested(PreviewSize::Full, SizeRequest::Next, PreviewSize::Standard), PreviewSize::Standard);
        assert_eq!(requested(PreviewSize::Custom, SizeRequest::Next, PreviewSize::Standard), PreviewSize::Medium);
        assert_eq!(requested(PreviewSize::Custom, SizeRequest::ToggleFull, PreviewSize::Standard), PreviewSize::Full);
        assert_eq!(requested(PreviewSize::Full, SizeRequest::ToggleFull, PreviewSize::Custom), PreviewSize::Custom);
    }

    #[test]
    fn dragging_an_edge_respects_the_minimum_and_the_work_area() {
        let start = rect(500, 100, 420, 559);
        assert_eq!(resized(start, Edge::E, (100, 50), (320, 240), AREA), rect(500, 100, 520, 559));
        assert_eq!(resized(start, Edge::Nw, (-60, -40), (320, 240), AREA), rect(440, 60, 480, 599));
        assert_eq!(resized(start, Edge::W, (300, 0), (320, 240), AREA), rect(600, 100, 320, 559));
        assert_eq!(resized(start, Edge::Se, (5000, 5000), (320, 240), AREA), Rect { left: 500, top: 100, right: 1920, bottom: 1040 });
        assert_eq!(resized(start, Edge::N, (0, -500), (320, 240), AREA), Rect { left: 500, top: 0, right: 920, bottom: 659 });
    }

    #[test]
    fn old_settings_without_preview_fields_still_read() {
        let settings: PreviewSettings = serde_json::from_str("{}").unwrap_or_default();
        assert_eq!(settings.size(), PreviewSize::Standard);
        let broken: PreviewSettings = serde_json::from_str(r#"{"previewSize":"custom"}"#).unwrap_or_default();
        assert_eq!(broken.normalized().size(), PreviewSize::Standard);
    }
}
