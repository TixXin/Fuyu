#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct Rect {
    pub(crate) left: f64,
    pub(crate) top: f64,
    pub(crate) right: f64,
    pub(crate) bottom: f64,
}

impl Rect {
    pub(crate) fn new(left: f64, top: f64, width: f64, height: f64) -> Self {
        Self { left, top, right: left + width, bottom: top + height }
    }

    fn width(&self) -> f64 {
        self.right - self.left
    }

    fn height(&self) -> f64 {
        self.bottom - self.top
    }

    fn center(&self) -> (f64, f64) {
        ((self.left + self.right) / 2.0, (self.top + self.bottom) / 2.0)
    }

    fn contains(&self, (x, y): (f64, f64)) -> bool {
        x >= self.left && x < self.right && y >= self.top && y < self.bottom
    }

    fn point(x: f64, y: f64) -> Self {
        Self { left: x, top: y, right: x, bottom: y }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct Screen {
    pub(crate) bounds: Rect,
    pub(crate) work: Rect,
    pub(crate) scale: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Platform {
    Windows,
    MacOs,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Edge {
    Bottom,
    Top,
    Left,
    Right,
}

pub(crate) const GAP: f64 = 8.0;
const MENU_BAR_GAP: f64 = 4.0;
const MENU_BAR_SLACK: f64 = 4.0;

pub(crate) fn screen_for(screens: &[Screen], point: (f64, f64)) -> Option<Screen> {
    screens.iter().copied().find(|screen| screen.bounds.contains(point))
}

fn usable_icon(icon: Option<Rect>, screen: &Screen, platform: Platform) -> bool {
    let Some(icon) = icon else { return false };
    if icon.width() <= 0.0 || icon.height() <= 0.0 || !screen.bounds.contains(icon.center()) {
        return false;
    }
    match platform {
        Platform::Windows => true,
        Platform::MacOs => icon.top <= screen.work.top + MENU_BAR_SLACK,
    }
}

pub(crate) fn taskbar_edge(screen: &Screen, anchor: Rect) -> Edge {
    let gaps = [
        (Edge::Bottom, screen.bounds.bottom - screen.work.bottom),
        (Edge::Top, screen.work.top - screen.bounds.top),
        (Edge::Left, screen.work.left - screen.bounds.left),
        (Edge::Right, screen.bounds.right - screen.work.right),
    ];
    if let Some((edge, _)) = gaps.iter().copied().filter(|(_, gap)| *gap > 0.0).max_by(|a, b| a.1.total_cmp(&b.1)) {
        return edge;
    }
    let (x, y) = anchor.center();
    let distances = [
        (Edge::Bottom, screen.bounds.bottom - y),
        (Edge::Top, y - screen.bounds.top),
        (Edge::Left, x - screen.bounds.left),
        (Edge::Right, screen.bounds.right - x),
    ];
    distances.iter().copied().min_by(|a, b| a.1.total_cmp(&b.1)).map_or(Edge::Bottom, |(edge, _)| edge)
}

fn clamp(value: f64, low: f64, high: f64) -> f64 {
    value.min(high).max(low)
}

pub(crate) fn place(platform: Platform, icon: Option<Rect>, cursor: (f64, f64), screen: &Screen, size: (f64, f64)) -> (f64, f64) {
    let (width, height) = (size.0 * screen.scale, size.1 * screen.scale);
    let gap = GAP * screen.scale;
    let anchor = match icon {
        Some(icon) if usable_icon(Some(icon), screen, platform) => icon,
        _ => Rect::point(cursor.0, cursor.1),
    };
    let work = screen.work;
    let min_x = work.left + gap;
    let max_x = (work.right - width - gap).max(min_x);
    let min_y = work.top + if platform == Platform::MacOs { MENU_BAR_GAP * screen.scale } else { gap };
    let max_y = (work.bottom - height - gap).max(min_y);
    let (x, y) = match platform {
        Platform::MacOs => (anchor.right - width, anchor.bottom.max(work.top) + MENU_BAR_GAP * screen.scale),
        Platform::Windows => {
            let (center_x, center_y) = anchor.center();
            match taskbar_edge(screen, anchor) {
                Edge::Bottom => (center_x - width / 2.0, anchor.top.min(work.bottom) - height - gap),
                Edge::Top => (center_x - width / 2.0, anchor.bottom.max(work.top) + gap),
                Edge::Left => (anchor.right.max(work.left) + gap, center_y - height / 2.0),
                Edge::Right => (anchor.left.min(work.right) - width - gap, center_y - height / 2.0),
            }
        }
    };
    (clamp(x, min_x, max_x).round(), clamp(y, min_y, max_y).round())
}

#[cfg(test)]
#[path = "place_tests.rs"]
mod tests;
