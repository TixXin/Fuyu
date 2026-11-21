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

pub(crate) fn supported() -> bool {
    false
}

pub(super) fn wanted(_state: IslandWindowState) -> bool {
    false
}

pub(super) fn keep_flag(_previous: Option<IslandPosition>, next: IslandPosition) -> IslandPosition {
    next
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
