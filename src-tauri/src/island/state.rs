use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock, PoisonError};
use tauri::PhysicalPosition;

use super::geometry::{
    COLLAPSED_ISLAND_HEIGHT, COLLAPSED_ISLAND_WIDTH, COLLAPSED_RADIUS, DEFAULT_COLLAPSED_SCALE,
    DEFAULT_EXPANDED_ISLAND_HEIGHT, DEFAULT_EXPANDED_SCALE, DEFAULT_MARGIN_Y,
    EXPANDED_ISLAND_WIDTH, EXPANDED_RADIUS, SIDE_HANDLE_HEIGHT, SIDE_HANDLE_RADIUS, SIDE_HANDLE_WIDTH,
};

pub(super) static WINDOW_STATE: OnceLock<Mutex<IslandWindowState>> = OnceLock::new();

#[derive(Clone, Copy)]
pub(crate) enum IslandMode {
    Collapsed,
    Expanded,
}

impl IslandMode {
    pub(super) fn from_value(value: &str) -> Result<Self, String> {
        match value {
            "collapsed" => Ok(Self::Collapsed),
            "expanded" => Ok(Self::Expanded),
            _ => Err(format!("Unsupported island mode: {value}")),
        }
    }

    pub(super) fn base_size(self, collapsed_width: f64, expanded_width: f64, expanded_height: f64) -> (f64, f64) {
        match self {
            Self::Collapsed => (collapsed_width, COLLAPSED_ISLAND_HEIGHT),
            Self::Expanded => (expanded_width, expanded_height),
        }
    }

    pub(super) fn corner_radius(self) -> f64 {
        match self {
            Self::Collapsed => COLLAPSED_RADIUS,
            Self::Expanded => EXPANDED_RADIUS,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum MonitorFollow {
    Primary,
    Cursor,
    Foreground,
}

impl MonitorFollow {
    pub(super) fn from_value(value: &str) -> Option<Self> {
        match value {
            "primary" => Some(Self::Primary),
            "cursor" => Some(Self::Cursor),
            "foreground" => Some(Self::Foreground),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum CornerShape {
    Round,
    Squircle,
}

impl CornerShape {
    pub(super) fn from_value(value: &str) -> Option<Self> {
        match value {
            "round" => Some(Self::Round),
            "squircle" => Some(Self::Squircle),
            _ => None,
        }
    }

    pub(super) fn contains(self, dx: f64, dy: f64, radius: f64) -> bool {
        match self {
            Self::Round => dx * dx + dy * dy <= radius * radius,
            Self::Squircle => dx.powi(4) + dy.powi(4) <= radius.powi(4),
        }
    }
}

#[derive(Clone, Copy)]
pub(crate) struct IslandWindowState {
    pub(super) mode: IslandMode,
    pub(super) is_tucked: bool,
    pub(super) collapsed_scale: f64,
    pub(super) expanded_scale: f64,
    pub(super) margin_y: f64,
    pub(super) under_menu_bar: bool,
    pub(super) collapsed_width: f64,
    pub(super) expanded_width: f64,
    pub(super) expanded_height: f64,
    pub(super) custom_position: Option<IslandPosition>,
    pub(super) out_at_top: bool,
    pub(super) is_dragging: bool,
    pub(super) attached_edge: Option<Edge>,
    pub(super) glass_enabled: bool,
    pub(super) corner_radius: f64,
    pub(super) corner_shape: CornerShape,
    pub(super) monitor_follow: MonitorFollow,
    pub(super) followed_monitor: Option<(i32, i32)>,
    pub(super) fit_notch: bool,
    pub(super) notch: Option<super::notch::Notch>,
    pub(super) notch_drop: bool,
}

impl IslandWindowState {
    fn corner_radius_factor(self) -> f64 {
        self.corner_radius / EXPANDED_RADIUS
    }

    pub(super) fn bottom_corner_radius(self) -> f64 {
        if self.is_side_handle() {
            return SIDE_HANDLE_RADIUS;
        }
        self.mode.corner_radius() * self.corner_radius_factor()
    }

    pub(super) fn side(self) -> Option<Edge> {
        self.attached_edge.filter(|edge| *edge != Edge::Top)
    }

    fn is_side_handle(self) -> bool {
        self.side().is_some() && matches!(self.mode, IslandMode::Collapsed)
    }

    pub(super) fn base_size(self) -> (f64, f64) {
        if self.is_side_handle() {
            return (SIDE_HANDLE_WIDTH, SIDE_HANDLE_HEIGHT);
        }
        if let (IslandMode::Collapsed, Some(notch)) = (self.mode, self.notch) {
            return super::notch::collapsed_size(self.collapsed_width, self.collapsed_scale, notch, self.is_tucked, self.notch_drop);
        }
        self.mode.base_size(self.collapsed_width, self.expanded_width, self.expanded_height)
    }

    pub(super) fn top_corner_radius(self) -> f64 {
        if self.attached_edge == Some(Edge::Top) {
            0.0
        } else {
            self.bottom_corner_radius()
        }
    }

    pub(super) fn active_scale(self) -> f64 {
        match self.mode {
            IslandMode::Collapsed => self.collapsed_scale,
            IslandMode::Expanded => self.expanded_scale,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Edge {
    Top,
    Left,
    Right,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
pub struct IslandPosition {
    pub(super) x: i32,
    pub(super) y: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) edge: Option<Edge>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) along: Option<f64>,
}

impl IslandPosition {
    pub(super) fn at(x: i32, y: i32) -> Self {
        Self { x, y, edge: None, along: None }
    }
}

impl Default for IslandWindowState {
    fn default() -> Self {
        Self {
            mode: IslandMode::Collapsed,
            is_tucked: false,
            collapsed_scale: DEFAULT_COLLAPSED_SCALE,
            expanded_scale: DEFAULT_EXPANDED_SCALE,
            margin_y: DEFAULT_MARGIN_Y,
            under_menu_bar: false,
            collapsed_width: COLLAPSED_ISLAND_WIDTH,
            expanded_width: EXPANDED_ISLAND_WIDTH,
            expanded_height: DEFAULT_EXPANDED_ISLAND_HEIGHT,
            custom_position: None,
            out_at_top: false,
            is_dragging: false,
            attached_edge: Some(Edge::Top),
            glass_enabled: false,
            corner_radius: EXPANDED_RADIUS,
            corner_shape: CornerShape::Squircle,
            monitor_follow: MonitorFollow::Primary,
            followed_monitor: None,
            fit_notch: false,
            notch: None,
            notch_drop: false,
        }
    }
}

pub(super) fn window_state() -> &'static Mutex<IslandWindowState> {
    WINDOW_STATE.get_or_init(|| Mutex::new(IslandWindowState::default()))
}

pub(super) fn mutate_window_state(
    update: impl FnOnce(&mut IslandWindowState) -> IslandWindowState,
) -> IslandWindowState {
    let mut state = window_state()
        .lock()
        .unwrap_or_else(PoisonError::into_inner);
    update(&mut state)
}

pub(super) fn read_window_state() -> IslandWindowState {
    *window_state()
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
}

pub(crate) fn record_dragged_position(position: PhysicalPosition<i32>) {
    mutate_window_state(|state| {
        if state.is_dragging && !state.is_tucked {
            state.custom_position = Some(IslandPosition::at(position.x, position.y));
        }
        *state
    });
}
