use tauri::{AppHandle, Manager, PhysicalPosition, WebviewWindow};

use super::drag_grid_window;
use super::drag_hint::hint_for;
use super::geometry::{island_rect, IslandOnScreen};
use super::screen;
use super::side::{full_rect, is_outer, Rect, SNAP_DISTANCE};
use super::state::{Edge, IslandMode, IslandPosition, IslandWindowState};
use super::top_edge::{screen_below, top_edge, TopEdge};

pub(super) const CENTER_SNAP_DISTANCE: f64 = 12.0;
const POLL_EVERY: u32 = 3;

#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) struct Screen {
    pub(super) full: Rect,
    pub(super) work: Rect,
    pub(super) scale: f64,
    pub(super) top: TopEdge,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct CenterSnap {
    pub(super) edge: Edge,
    pub(super) offset: (i32, i32),
}

fn screens(window: &WebviewWindow, state: IslandWindowState) -> Vec<Screen> {
    window
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|monitor| Screen {
            full: full_rect(monitor),
            work: screen::monitor_work_rect(monitor),
            scale: screen::monitor_scale(monitor),
            top: top_edge(monitor, super::notch::under_menu_bar(window, monitor, state)),
        })
        .collect()
}

fn contains((left, top, width, height): Rect, (x, y): (f64, f64)) -> bool {
    x >= f64::from(left) && x < f64::from(left + width) && y >= f64::from(top) && y < f64::from(top + height)
}

pub(super) fn screen_for(rect: IslandOnScreen, screens: &[Screen]) -> Option<usize> {
    let center = (rect.left + rect.width / 2.0, rect.top + rect.height / 2.0);
    screens.iter().position(|screen| contains(screen.full, center)).or_else(|| {
        let fulls: Vec<Rect> = screens.iter().map(|screen| screen.full).collect();
        screen_below(center, &fulls)
    })
}

pub(super) fn center_offset(rect: IslandOnScreen, (work_left, work_top, work_width, work_height): Rect, edge: Edge, reach: f64) -> Option<(f64, f64)> {
    let offset = match edge {
        Edge::Top | Edge::Bottom => (f64::from(work_left) + f64::from(work_width) / 2.0 - (rect.left + rect.width / 2.0), 0.0),
        Edge::Left | Edge::Right => (0.0, f64::from(work_top) + f64::from(work_height) / 2.0 - (rect.top + rect.height / 2.0)),
    };
    (offset.0.abs().max(offset.1.abs()) <= reach).then_some(offset)
}

pub(super) fn center_snap(rect: IslandOnScreen, screens: &[Screen], index: usize, collapsed: bool) -> Option<CenterSnap> {
    let screen = screens.get(index)?;
    let fulls: Vec<Rect> = screens.iter().map(|screen| screen.full).collect();
    let snap = SNAP_DISTANCE * screen.scale;
    let edge = hint_for(rect, screen.work, screen.top, snap, collapsed, |edge| is_outer(edge, screen.full, &fulls))?;
    let (dx, dy) = center_offset(rect, screen.work, edge, CENTER_SNAP_DISTANCE * screen.scale)?;
    Some(CenterSnap { edge, offset: (dx.round() as i32, dy.round() as i32) })
}

fn window_size(window: &WebviewWindow) -> (f64, f64) {
    screen::window_size(window).map_or((0.0, 0.0), |size| (f64::from(size.width), f64::from(size.height)))
}

pub(super) fn align_on_drop(window: &WebviewWindow, position: IslandPosition, state: IslandWindowState) -> IslandPosition {
    let (width, height) = window_size(window);
    let screens = screens(window, state);
    let rect = island_rect(f64::from(position.x), f64::from(position.y), width, height, state);
    let collapsed = matches!(state.mode, IslandMode::Collapsed);
    let Some(snap) = screen_for(rect, &screens).and_then(|index| center_snap(rect, &screens, index, collapsed)) else {
        return position;
    };
    if snap.offset == (0, 0) {
        return position;
    }
    let moved = IslandPosition::at(position.x + snap.offset.0, position.y + snap.offset.1);
    if let Err(error) = screen::set_window_position(window, PhysicalPosition::new(moved.x, moved.y)) {
        eprintln!("Failed to center the island on the edge: {error}");
        return position;
    }
    moved
}

pub(super) struct DragGrid {
    app: AppHandle,
    screens: Vec<Screen>,
    state: IslandWindowState,
    size: (f64, f64),
    polls: u32,
    shown: Option<(usize, Option<Edge>)>,
}

impl DragGrid {
    pub(super) fn start(window: &WebviewWindow, state: IslandWindowState) -> Self {
        let mut grid = Self {
            app: window.app_handle().clone(),
            screens: screens(window, state),
            state,
            size: window_size(window),
            polls: 0,
            shown: None,
        };
        grid.update(window);
        grid
    }

    fn collapsed(&self) -> bool {
        matches!(self.state.mode, IslandMode::Collapsed)
    }

    fn rect_at(&self, position: PhysicalPosition<i32>) -> IslandOnScreen {
        island_rect(f64::from(position.x), f64::from(position.y), self.size.0, self.size.1, self.state)
    }

    fn snap_at(&self, position: PhysicalPosition<i32>) -> Option<(usize, Option<CenterSnap>)> {
        let rect = self.rect_at(position);
        let index = screen_for(rect, &self.screens)?;
        Some((index, center_snap(rect, &self.screens, index, self.collapsed())))
    }

    pub(super) fn align(&self, next: PhysicalPosition<i32>) -> PhysicalPosition<i32> {
        match self.snap_at(next) {
            Some((_, Some(snap))) => PhysicalPosition::new(next.x + snap.offset.0, next.y + snap.offset.1),
            _ => next,
        }
    }

    pub(super) fn poll(&mut self, window: &WebviewWindow) {
        self.polls += 1;
        if self.polls.is_multiple_of(POLL_EVERY) {
            self.update(window);
        }
    }

    fn update(&mut self, window: &WebviewWindow) {
        let Ok(position) = screen::window_position(window) else {
            return;
        };
        let Some((index, snap)) = self.snap_at(position) else {
            return;
        };
        let edge = snap.map(|snap| snap.edge);
        let wanted = (drag_grid_window::lines() || edge.is_some()).then_some((index, edge));
        if wanted == self.shown {
            return;
        }
        match wanted {
            Some((index, edge)) => {
                if let Some(screen) = self.screens.get(index) {
                    drag_grid_window::present(&self.app, screen.work, edge);
                }
            }
            None => drag_grid_window::dismiss(&self.app),
        }
        self.shown = wanted;
    }

    pub(super) fn finish(&mut self) {
        if self.shown.take().is_some() {
            drag_grid_window::dismiss(&self.app);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const WORK: Rect = (0, 0, 1920, 1040);
    const SCREEN: Screen = Screen { full: (0, 0, 1920, 1080), work: WORK, scale: 1.0, top: TopEdge { y: 0, reach: 0 } };

    fn rect(left: f64, top: f64, width: f64, height: f64) -> IslandOnScreen {
        IslandOnScreen { left, top, width, height, expanded: false }
    }

    #[test]
    fn near_the_top_or_bottom_the_island_centres_horizontally_within_reach() {
        let screens = [SCREEN];
        assert_eq!(center_snap(rect(815.0, 4.0, 300.0, 34.0), &screens, 0, true), Some(CenterSnap { edge: Edge::Top, offset: (-5, 0) }));
        assert_eq!(center_snap(rect(798.0, 1000.0, 300.0, 34.0), &screens, 0, true), Some(CenterSnap { edge: Edge::Bottom, offset: (12, 0) }));
        assert_eq!(center_snap(rect(797.0, 1000.0, 300.0, 34.0), &screens, 0, true), None);
        assert_eq!(center_snap(rect(810.0, 300.0, 300.0, 34.0), &screens, 0, true), None);
        assert_eq!(center_snap(rect(810.0, 4.0, 300.0, 34.0), &screens, 0, false), Some(CenterSnap { edge: Edge::Top, offset: (0, 0) }));
    }

    #[test]
    fn near_a_side_a_collapsed_island_centres_vertically() {
        let screens = [SCREEN];
        assert_eq!(center_snap(rect(6.0, 490.0, 44.0, 72.0), &screens, 0, true), Some(CenterSnap { edge: Edge::Left, offset: (0, -6) }));
        assert_eq!(center_snap(rect(1870.0, 474.0, 44.0, 72.0), &screens, 0, true), Some(CenterSnap { edge: Edge::Right, offset: (0, 10) }));
        assert_eq!(center_snap(rect(1870.0, 400.0, 44.0, 72.0), &screens, 0, true), None);
        assert_eq!(center_snap(rect(6.0, 490.0, 44.0, 72.0), &screens, 0, false), None);
    }

    #[test]
    fn a_side_shared_with_another_screen_does_not_pull() {
        let right = Screen { full: (1920, 0, 1920, 1080), work: (1920, 0, 1920, 1040), ..SCREEN };
        let screens = [SCREEN, right];
        assert_eq!(center_snap(rect(1870.0, 490.0, 44.0, 72.0), &screens, 0, true), None);
        assert_eq!(center_snap(rect(6.0, 490.0, 44.0, 72.0), &screens, 0, true).map(|snap| snap.edge), Some(Edge::Left));
    }

    #[test]
    fn the_scale_widens_the_reach_in_physical_pixels() {
        let screens = [Screen { scale: 2.0, ..SCREEN }];
        assert_eq!(center_snap(rect(786.0, 4.0, 300.0, 34.0), &screens, 0, true), Some(CenterSnap { edge: Edge::Top, offset: (24, 0) }));
    }

    #[test]
    fn the_island_belongs_to_the_screen_under_its_centre() {
        let right = Screen { full: (1920, 0, 1920, 1080), work: (1920, 0, 1920, 1040), ..SCREEN };
        let screens = [SCREEN, right];
        assert_eq!(screen_for(rect(1800.0, 300.0, 300.0, 34.0), &screens), Some(1));
        assert_eq!(screen_for(rect(1500.0, 300.0, 300.0, 34.0), &screens), Some(0));
        assert_eq!(screen_for(rect(800.0, -80.0, 300.0, 34.0), &screens), Some(0));
        assert_eq!(screen_for(rect(5000.0, 300.0, 300.0, 34.0), &screens), None);
    }
}
