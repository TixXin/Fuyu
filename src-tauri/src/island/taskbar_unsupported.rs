use serde::Serialize;
use tauri::{Monitor, WebviewWindow};

use super::state::{IslandPosition, IslandWindowState};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IslandTaskbar {
    docked: bool,
    placed: bool,
    light: bool,
}

#[tauri::command]
pub fn start_island_taskbar_drag() {}

#[tauri::command]
pub fn end_island_taskbar_drag() {}

pub(crate) fn supported() -> bool {
    false
}

pub(super) fn wanted(_state: IslandWindowState) -> bool {
    false
}

pub(super) fn panel_room(_state: IslandWindowState) -> f64 {
    0.0
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(super) fn cursor_on_bar_or_panel(_window: (f64, f64, f64, f64), _cursor: (f64, f64), _state: IslandWindowState) -> Option<bool> {
    None
}

pub(super) fn keep_flag(_previous: Option<IslandPosition>, next: IslandPosition) -> IslandPosition {
    next
}

pub(super) fn lift(_window: &WebviewWindow) {}

pub(super) struct TaskbarDrop;

impl TaskbarDrop {
    pub(super) fn start(_window: &WebviewWindow, _state: IslandWindowState) -> Self {
        Self
    }

    pub(super) fn active(&self) -> bool {
        false
    }

    pub(super) fn poll(&mut self, _window: &WebviewWindow) -> bool {
        false
    }

    pub(super) fn finish(&mut self, _window: &WebviewWindow) -> Option<IslandPosition> {
        None
    }
}

pub(crate) fn reported() -> IslandTaskbar {
    IslandTaskbar::default()
}

pub(super) fn stage_position(
    _window: &WebviewWindow,
    _monitor: &Monitor,
    _state: IslandWindowState,
    _stage: (i32, i32),
) -> Option<(i32, i32)> {
    None
}
