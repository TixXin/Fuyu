use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SideDockEdge {
    Left,
    Right,
}

impl SideDockEdge {
    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::Left => "side-left",
            Self::Right => "side-right",
        }
    }

    pub(crate) fn url(self) -> &'static str {
        match self {
            Self::Left => "index.html?window=side&edge=left",
            Self::Right => "index.html?window=side&edge=right",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ScreenRect {
    pub left: i32,
    pub top: i32,
    pub width: i32,
    pub height: i32,
}

impl ScreenRect {
    pub(crate) fn right(self) -> i32 {
        self.left + self.width
    }

    pub(crate) fn bottom(self) -> i32 {
        self.top + self.height
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct DockHitShape {
    pub edge: SideDockEdge,
    pub expanded: bool,
    pub strip_width: f64,
    pub strip_height: f64,
    pub gap: f64,
}

pub(crate) fn is_outer_side(edge: SideDockEdge, target: ScreenRect, monitors: &[ScreenRect]) -> bool {
    !monitors.iter().any(|other| {
        if *other == target {
            return false;
        }
        let vertical_overlap = other.top < target.bottom() && other.bottom() > target.top;
        if !vertical_overlap {
            return false;
        }
        match edge {
            SideDockEdge::Left => (other.right() - target.left).abs() <= 2,
            SideDockEdge::Right => (other.left - target.right()).abs() <= 2,
        }
    })
}

pub(crate) fn pick_outer_monitor(
    edge: SideDockEdge,
    primary_index: Option<usize>,
    monitors: &[ScreenRect],
) -> Option<usize> {
    if monitors.is_empty() {
        return None;
    }
    if let Some(index) = primary_index {
        if let Some(&primary) = monitors.get(index) {
            if is_outer_side(edge, primary, monitors) {
                return Some(index);
            }
        }
    }
    let outer: Vec<usize> = monitors
        .iter()
        .enumerate()
        .filter(|(_, rect)| is_outer_side(edge, **rect, monitors))
        .map(|(index, _)| index)
        .collect();
    if outer.is_empty() {
        return primary_index.filter(|&i| i < monitors.len()).or(Some(0));
    }
    match edge {
        SideDockEdge::Left => outer.into_iter().min_by_key(|&i| monitors[i].left),
        SideDockEdge::Right => outer.into_iter().max_by_key(|&i| monitors[i].right()),
    }
}

pub(crate) fn dock_window_rect(
    edge: SideDockEdge,
    work: ScreenRect,
    scale: f64,
    width_css: f64,
    height_css: f64,
    along: f64,
) -> (i32, i32, u32, u32) {
    let scale = if scale.is_finite() && scale > 0.1 { scale } else { 1.0 };
    let along = if along.is_finite() { along.clamp(0.0, 1.0) } else { 0.5 };
    let max_width = work.width.max(48);
    let max_height = work.height.max(48);
    let width = ((width_css.max(12.0) * scale).round() as i32).clamp(12, max_width);
    let height = ((height_css.max(48.0) * scale).round() as i32).clamp(48, max_height);
    let x = match edge {
        SideDockEdge::Left => work.left,
        SideDockEdge::Right => work.right() - width,
    };
    let desired_top = work.top as f64 + along * work.height as f64 - height as f64 / 2.0;
    let lowest = (work.bottom() - height) as f64;
    let y = desired_top.min(lowest).max(work.top as f64).round() as i32;
    (x, y, width as u32, height as u32)
}

fn contains(x: f64, y: f64, left: f64, top: f64, right: f64, bottom: f64) -> bool {
    x >= left && x <= right && y >= top && y <= bottom
}

pub(crate) fn cursor_hits_dock(
    win_left: f64,
    win_top: f64,
    win_w: f64,
    win_h: f64,
    scale: f64,
    shape: DockHitShape,
    cursor_x: f64,
    cursor_y: f64,
) -> bool {
    let scale = if scale.is_finite() && scale > 0.1 { scale } else { 1.0 };
    let bezel = 3.0 * scale;
    let win_right = win_left + win_w;
    let win_bottom = win_top + win_h;
    let (outer_left, outer_right) = match shape.edge {
        SideDockEdge::Left => (win_left - bezel, win_right),
        SideDockEdge::Right => (win_left, win_right + bezel),
    };
    if !shape.expanded {
        let pad_y = 4.0 * scale;
        return contains(cursor_x, cursor_y, outer_left, win_top - pad_y, outer_right, win_bottom + pad_y);
    }
    if shape.strip_width <= 0.0 || shape.strip_height <= 0.0 {
        return contains(cursor_x, cursor_y, outer_left, win_top, outer_right, win_bottom);
    }
    let strip_band = (shape.strip_width + shape.gap + 8.0) * scale;
    if win_w <= strip_band + 28.0 * scale {
        return contains(cursor_x, cursor_y, outer_left, win_top, outer_right, win_bottom);
    }
    let (drawer_l, drawer_r, strip_l, strip_r) = match shape.edge {
        SideDockEdge::Left => (win_left + strip_band - shape.gap * scale, win_right, outer_left, win_left + strip_band),
        SideDockEdge::Right => (win_left, win_right - strip_band + shape.gap * scale, win_right - strip_band, outer_right),
    };
    if contains(cursor_x, cursor_y, drawer_l, win_top, drawer_r, win_bottom) {
        return true;
    }
    let half_strip = ((shape.strip_height + 20.0) * scale) * 0.5;
    let mid_y = win_top + win_h * 0.5;
    contains(cursor_x, cursor_y, strip_l, (mid_y - half_strip).max(win_top), strip_r, (mid_y + half_strip).min(win_bottom))
}

#[cfg(test)]
mod tests {
    use super::{cursor_hits_dock, dock_window_rect, is_outer_side, pick_outer_monitor, DockHitShape, ScreenRect, SideDockEdge};

    #[test]
    fn seam_between_two_horizontal_monitors_is_not_outer() {
        let left = ScreenRect { left: -1920, top: 0, width: 1920, height: 1080 };
        let right = ScreenRect { left: 0, top: 0, width: 1920, height: 1080 };
        let monitors = [left, right];

        assert!(is_outer_side(SideDockEdge::Left, left, &monitors));
        assert!(!is_outer_side(SideDockEdge::Right, left, &monitors));
        assert!(!is_outer_side(SideDockEdge::Left, right, &monitors));
        assert!(is_outer_side(SideDockEdge::Right, right, &monitors));

        assert_eq!(pick_outer_monitor(SideDockEdge::Left, Some(1), &monitors), Some(0));
        assert_eq!(pick_outer_monitor(SideDockEdge::Right, Some(0), &monitors), Some(1));
    }

    #[test]
    fn dock_window_rect_pins_to_edge_and_clamps_within_work_area() {
        let work = ScreenRect { left: 0, top: 40, width: 1440, height: 860 };
        let (rx, ry, rw, rh) = dock_window_rect(SideDockEdge::Right, work, 1.0, 400.0, 540.0, 0.5);
        assert_eq!((rx, ry, rw, rh), (1040, 200, 400, 540));

        let (lx, ly, lw, lh) = dock_window_rect(SideDockEdge::Left, work, 1.0, 20.0, 100.0, 0.0);
        assert_eq!((lx, ly, lw, lh), (0, 40, 20, 100));

        let (_, by, _, _) = dock_window_rect(SideDockEdge::Right, work, 1.0, 400.0, 540.0, 1.0);
        assert_eq!(by, 360);
    }

    #[test]
    fn cursor_hit_ignores_empty_gutter_above_strip_in_drawer_mode() {
        let shape = DockHitShape {
            edge: SideDockEdge::Right,
            expanded: true,
            strip_width: 64.0,
            strip_height: 180.0,
            gap: 6.0,
        };
        assert!(cursor_hits_dock(1000.0, 100.0, 460.0, 540.0, 1.0, shape, 1100.0, 120.0));
        assert!(cursor_hits_dock(1000.0, 100.0, 460.0, 540.0, 1.0, shape, 1440.0, 370.0));
        assert!(!cursor_hits_dock(1000.0, 100.0, 460.0, 540.0, 1.0, shape, 1440.0, 110.0));
        assert!(!cursor_hits_dock(1000.0, 100.0, 460.0, 540.0, 1.0, shape, 950.0, 370.0));
    }
}
