use std::sync::{Mutex, PoisonError};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use super::place::Rect;
use crate::island::{self, screen};

const ACTION_EVENT: &str = "island-menu-action";
const MAX_ROWS: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IslandMenuRow {
    id: String,
    name: String,
    shown: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IslandMenuBounds {
    left: f64,
    top: f64,
    width: f64,
    height: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActionPayload {
    action: &'static str,
    id: Option<String>,
}

static ROWS: Mutex<Option<Vec<IslandMenuRow>>> = Mutex::new(None);

pub(super) fn rows() -> Option<Vec<IslandMenuRow>> {
    ROWS.lock().unwrap_or_else(PoisonError::into_inner).clone()
}

pub(super) fn forget() {
    *ROWS.lock().unwrap_or_else(PoisonError::into_inner) = None;
}

fn flip(rows: &mut [IslandMenuRow], id: &str) -> bool {
    let Some(row) = rows.iter_mut().find(|row| row.id == id) else {
        return false;
    };
    row.shown = !row.shown;
    true
}

fn on_screen(origin: (f64, f64), scale: f64, bounds: IslandMenuBounds) -> Option<Rect> {
    let values = [bounds.left, bounds.top, bounds.width, bounds.height, scale];
    if values.iter().any(|value| !value.is_finite()) || bounds.width <= 0.0 || bounds.height <= 0.0 || scale <= 0.0 {
        return None;
    }
    Some(Rect::new(origin.0 + bounds.left * scale, origin.1 + bounds.top * scale, bounds.width * scale, bounds.height * scale))
}

fn parse_action(action: &str) -> Result<&'static str, String> {
    match action {
        "toggle" => Ok("toggle"),
        "arrange" => Ok("arrange"),
        "resize" => Ok("resize"),
        other => Err(format!("Unknown island menu action: {other}")),
    }
}

#[tauri::command]
pub async fn island_menu_open(app: AppHandle, rows: Vec<IslandMenuRow>, bounds: IslandMenuBounds) -> Result<(), String> {
    let window = island::main_window(&app)?;
    let origin = screen::window_position(&window)?;
    let scale = screen::window_scale(&window)?;
    let rect = on_screen((f64::from(origin.x), f64::from(origin.y)), scale, bounds).ok_or_else(|| "The island bounds must be positive.".to_string())?;
    *ROWS.lock().unwrap_or_else(PoisonError::into_inner) = Some(rows.into_iter().take(MAX_ROWS).collect());
    super::window::open_beside_island(&app, rect);
    Ok(())
}

#[tauri::command]
pub async fn island_menu_rows() -> Option<Vec<IslandMenuRow>> {
    rows()
}

#[tauri::command]
pub async fn island_menu_action(app: AppHandle, action: String, id: Option<String>) -> Result<(), String> {
    let action = parse_action(&action)?;
    if action == "toggle" {
        let id = id.as_deref().ok_or_else(|| "Toggling an island menu row needs its id.".to_string())?;
        let mut rows = ROWS.lock().unwrap_or_else(PoisonError::into_inner);
        if !rows.as_mut().is_some_and(|rows| flip(rows, id)) {
            return Err(format!("The island menu has no row {id}."));
        }
    } else {
        super::hide(&app);
    }
    app.emit_to(island::WINDOW_LABEL, ACTION_EVENT, ActionPayload { action, id }).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{flip, on_screen, parse_action, IslandMenuBounds, IslandMenuRow, Rect};

    fn row(id: &str, shown: bool) -> IslandMenuRow {
        IslandMenuRow { id: id.to_string(), name: id.to_string(), shown }
    }

    #[test]
    fn toggling_flips_only_the_named_row() {
        let mut rows = vec![row("mail", true), row("music", false)];
        assert!(flip(&mut rows, "music"));
        assert_eq!(rows, vec![row("mail", true), row("music", true)]);
        assert!(!flip(&mut rows, "missing"));
    }

    #[test]
    fn page_bounds_become_screen_units_from_the_window_origin() {
        let bounds = IslandMenuBounds { left: 10.0, top: 96.0, width: 200.0, height: 32.0 };
        assert_eq!(on_screen((800.0, 950.0), 1.5, bounds), Some(Rect::new(815.0, 1094.0, 300.0, 48.0)));
        assert_eq!(on_screen((0.0, 0.0), 1.0, IslandMenuBounds { width: 0.0, ..bounds }), None);
        assert_eq!(on_screen((0.0, 0.0), f64::NAN, bounds), None);
    }

    #[test]
    fn only_known_actions_are_accepted() {
        assert_eq!(parse_action("toggle"), Ok("toggle"));
        assert_eq!(parse_action("arrange"), Ok("arrange"));
        assert_eq!(parse_action("resize"), Ok("resize"));
        assert!(parse_action("quit").is_err());
    }
}
