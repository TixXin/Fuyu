use tauri::{AppHandle, Emitter, Monitor, PhysicalPosition, WebviewWindow};

use super::edge;
use super::geometry::{apply_stage_geometry, island_rect, monitor_at, STAGE_WINDOW_HEIGHT, STAGE_WINDOW_WIDTH};
use super::screen;
use super::side::{full_rect, is_outer, Rect};
use super::state::{mutate_window_state, Edge, IslandPosition, IslandWindowState};

const SNAP_DISTANCE: f64 = 16.0;

pub(super) fn is_bottom(position: IslandPosition) -> bool {
    position.edge == Some(Edge::Bottom)
}

pub(super) fn stage_y((_, work_top, _, work_height): Rect, stage_height: i32, tuck_depth: i32) -> i32 {
    work_top + work_height - stage_height + tuck_depth
}

pub(super) fn near_bottom(island_bottom: f64, (_, work_top, _, work_height): Rect, snap: f64) -> bool {
    island_bottom >= (work_top + work_height) as f64 - snap
}

pub(super) fn window_height(window: &WebviewWindow) -> f64 {
    screen::window_size(window).map_or(0.0, |size| f64::from(size.height))
}

pub(super) fn placed_on(monitor: &Monitor) -> IslandPosition {
    let scale = screen::monitor_scale(monitor);
    let (origin, size) = (screen::monitor_origin(monitor), screen::monitor_size(monitor));
    let stage_width = (STAGE_WINDOW_WIDTH * scale).round() as i32;
    let x = origin.x + (size.width as i32 - stage_width) / 2;
    let y = stage_y(screen::monitor_work_rect(monitor), (STAGE_WINDOW_HEIGHT * scale).round() as i32, 0);
    IslandPosition { x, y, edge: Some(Edge::Bottom), along: None }
}

pub(super) fn snap(window: &WebviewWindow, position: IslandPosition, state: IslandWindowState) -> Option<IslandPosition> {
    let size = screen::window_size(window).ok()?;
    let (width, height) = (f64::from(size.width), f64::from(size.height));
    let rect = island_rect(f64::from(position.x), f64::from(position.y), width, height, state);
    let center = ((rect.left + rect.width / 2.0).round() as i32, (rect.top + rect.height / 2.0).round() as i32);
    let monitor = monitor_at(window, center).ok().flatten()?;
    let work = screen::monitor_work_rect(&monitor);
    if !near_bottom(rect.top + rect.height, work, SNAP_DISTANCE * screen::monitor_scale(&monitor)) {
        return None;
    }
    let monitors: Vec<Rect> = window.available_monitors().ok()?.iter().map(full_rect).collect();
    if !is_outer(Edge::Bottom, full_rect(&monitor), &monitors) {
        return None;
    }
    let y = stage_y(work, height.round() as i32, 0);
    if y != position.y {
        if let Err(error) = screen::set_window_position(window, PhysicalPosition::new(position.x, y)) {
            eprintln!("Failed to snap island to the bottom edge: {error}");
            return None;
        }
    }
    edge::set_attached(window, Some(Edge::Bottom));
    Some(IslandPosition { x: position.x, y, edge: Some(Edge::Bottom), along: None })
}

pub(super) fn leave(window: &WebviewWindow, position: IslandPosition, state: IslandWindowState) -> IslandPosition {
    let size = screen::window_size(window).map_or((0.0, 0.0), |size| (f64::from(size.width), f64::from(size.height)));
    let y = island_rect(f64::from(position.x), f64::from(position.y), size.0, size.1, state).top.round() as i32;
    edge::set_attached(window, None);
    if y != position.y {
        if let Err(error) = screen::set_window_position(window, PhysicalPosition::new(position.x, y)) {
            eprintln!("Failed to move island off the bottom edge: {error}");
            return position;
        }
    }
    IslandPosition::at(position.x, y)
}

#[tauri::command]
pub fn set_island_edge(app: AppHandle, edge: Edge) -> Result<(), String> {
    if edge != Edge::Bottom {
        return Err(format!("Unsupported island edge: {edge:?}"));
    }
    let window = super::main_window(&app)?;
    let current = window.current_monitor().map_err(|error| error.to_string())?;
    let monitor = match current {
        Some(monitor) => monitor,
        None => window
            .primary_monitor()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "No monitor is available for island positioning.".to_string())?,
    };
    let position = placed_on(&monitor);
    let state = mutate_window_state(|state| {
        state.custom_position = Some(position);
        state.out_at_top = false;
        *state
    });
    apply_stage_geometry(&window, state, false)?;
    let _ = window.emit(super::ISLAND_POSITION_CHANGED_EVENT, position);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const WORK: Rect = (0, 0, 1920, 1040);

    #[test]
    fn the_stage_sits_on_the_bottom_of_the_work_area_and_tucks_below_it() {
        assert_eq!(stage_y(WORK, 460, 0), 580);
        assert_eq!(stage_y((0, 48, 1920, 1032), 460, 0), 620);
        assert_eq!(stage_y(WORK, 460, 24), 604);
        assert_eq!(stage_y((-1920, -1080, 1920, 1032), 920, 0), -968);
    }

    #[test]
    fn only_drops_near_or_below_the_bottom_snap() {
        assert!(near_bottom(1040.0, WORK, 16.0));
        assert!(near_bottom(1024.0, WORK, 16.0));
        assert!(near_bottom(1080.0, WORK, 16.0));
        assert!(!near_bottom(1023.0, WORK, 16.0));
        assert!(!near_bottom(600.0, WORK, 16.0));
    }

    #[test]
    fn stored_bottom_position_round_trips() {
        let position: IslandPosition = serde_json::from_str(r#"{"x":550,"y":580,"edge":"bottom"}"#).unwrap();
        assert!(is_bottom(position));
        assert_eq!(serde_json::to_string(&position).unwrap(), r#"{"x":550,"y":580,"edge":"bottom"}"#);
        assert!(!is_bottom(IslandPosition::at(550, 580)));
    }
}
