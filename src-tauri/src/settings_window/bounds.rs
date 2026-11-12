use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager, Monitor, WebviewWindow};

const BOUNDS_FILE_NAME: &str = "settings-window.json";

const GRAB_WIDTH: i32 = 120;
const GRAB_HEIGHT: i32 = 24;

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub(super) struct SavedBounds {
    pub x: i32,
    pub y: i32,
    pub width: f64,
    pub height: f64,
}

pub(super) type WorkArea = (i32, i32, u32, u32);

pub(super) fn load(app: &AppHandle) -> Option<SavedBounds> {
    let path = crate::home_dir::fuyu_home(app.path()).ok()?.join(BOUNDS_FILE_NAME);
    let bounds: SavedBounds = serde_json::from_str(&fs::read_to_string(path).ok()?).ok()?;
    (bounds.width.is_finite() && bounds.height.is_finite()).then_some(bounds)
}

pub(super) fn save(window: &WebviewWindow) {
    if window.is_minimized().unwrap_or(true) || window.is_maximized().unwrap_or(true) {
        return;
    }
    let (Ok(position), Ok(size), Ok(scale)) = (
        window.outer_position(),
        window.inner_size(),
        window.scale_factor(),
    ) else {
        return;
    };
    let size = size.to_logical::<f64>(scale);
    let bounds = SavedBounds {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    };
    let Ok(directory) = crate::home_dir::fuyu_home(window.app_handle().path()) else {
        return;
    };
    let Ok(json) = serde_json::to_string(&bounds) else {
        return;
    };
    if fs::create_dir_all(&directory).is_ok() {
        let _ = crate::fs_write::replace_file(&directory.join(BOUNDS_FILE_NAME), json.as_bytes());
    }
}

pub(super) fn screen_of(bounds: SavedBounds, monitors: &[Monitor]) -> Option<&Monitor> {
    monitors.iter().find(|monitor| {
        let area = monitor.work_area();
        let area = (
            area.position.x,
            area.position.y,
            area.size.width,
            area.size.height,
        );
        title_bar_on_screen(bounds.x, bounds.y, &[area])
    })
}

pub(super) fn title_bar_on_screen(x: i32, y: i32, areas: &[WorkArea]) -> bool {
    areas.iter().any(|&(left, top, width, height)| {
        let right = left.saturating_add(i32::try_from(width).unwrap_or(i32::MAX));
        let bottom = top.saturating_add(i32::try_from(height).unwrap_or(i32::MAX));
        x >= left
            && y >= top
            && x.saturating_add(GRAB_WIDTH) <= right
            && y.saturating_add(GRAB_HEIGHT) <= bottom
    })
}
