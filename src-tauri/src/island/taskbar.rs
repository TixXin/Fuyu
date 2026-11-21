use std::sync::{Arc, Mutex, PoisonError};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Monitor, WebviewWindow};

use super::geometry::apply_stage_geometry;
use super::screen;
use super::state::{read_window_state, Edge, IslandMode, IslandPosition, IslandWindowState};
use crate::taskbar_host::{self, BarEdge, DockState, DockStatus, Rect};

pub(crate) const TASKBAR_CHANGED_EVENT: &str = "island-taskbar-changed";
const ISLAND_ORDER: u8 = 0;
const PANEL_GAP: f64 = 8.0;
const PANEL_ROOM: f64 = 96.0;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IslandTaskbar {
    docked: bool,
    placed: bool,
    light: bool,
    lift: u32,
    room_left: u32,
    room_right: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct PanelSpace {
    lift: i32,
    room_left: i32,
    room_right: i32,
}

#[derive(Clone, Copy, PartialEq, Eq)]
struct Reservation {
    monitor: (i32, i32, u32, u32),
    width: i32,
}

static RESERVED: Mutex<Option<Reservation>> = Mutex::new(None);
static REPORTED: Mutex<IslandTaskbar> =
    Mutex::new(IslandTaskbar { docked: false, placed: false, light: false, lift: 0, room_left: 0, room_right: 0 });
static PANEL: Mutex<Option<PanelSpace>> = Mutex::new(None);

fn set_panel(next: Option<PanelSpace>) {
    *PANEL.lock().unwrap_or_else(PoisonError::into_inner) = next;
}

fn panel() -> Option<PanelSpace> {
    *PANEL.lock().unwrap_or_else(PoisonError::into_inner)
}

pub(crate) fn supported() -> bool {
    taskbar_host::supported()
}

pub(super) fn wanted(state: IslandWindowState) -> bool {
    state.custom_position.is_some_and(|position| position.taskbar && position.edge == Some(Edge::Bottom))
}

pub(super) fn keep_flag(previous: Option<IslandPosition>, next: IslandPosition) -> IslandPosition {
    match previous.filter(|position| position.taskbar) {
        Some(position) => IslandPosition { taskbar: true, along: position.along, ..next },
        None => next,
    }
}

pub(super) fn collapsed_size(state: IslandWindowState, scale: f64) -> (i32, i32) {
    let factor = state.collapsed_scale * scale;
    ((state.collapsed_width * factor).round() as i32, (state.collapsed_height * factor).round() as i32)
}

fn monitor_key(monitor: &Monitor) -> (i32, i32, u32, u32) {
    let (origin, size) = (screen::monitor_origin(monitor), screen::monitor_size(monitor));
    (origin.x, origin.y, size.width, size.height)
}

fn reapply(app: &AppHandle) {
    let Ok(window) = super::main_window(app) else {
        return;
    };
    if let Err(error) = apply_stage_geometry(&window, read_window_state(), false) {
        eprintln!("Failed to follow the taskbar: {error}");
    }
}

fn sync(window: &WebviewWindow, monitor: &Monitor, width: i32) {
    let next = Reservation { monitor: monitor_key(monitor), width };
    let mut reserved = RESERVED.lock().unwrap_or_else(PoisonError::into_inner);
    match *reserved {
        Some(current) if current == next => {}
        Some(current) if current.monitor == next.monitor => taskbar_host::resize_reserved(window, width),
        _ => {
            let app = window.app_handle().clone();
            let (x, y, w, h) = next.monitor;
            let monitor = Rect::new(x, y, x + w as i32, y + h as i32);
            taskbar_host::reserve(window.clone(), Some(monitor), width, ISLAND_ORDER, Arc::new(move || reapply(&app)));
        }
    }
    *reserved = Some(next);
}

fn release(window: &WebviewWindow) {
    if RESERVED.lock().unwrap_or_else(PoisonError::into_inner).take().is_some() {
        taskbar_host::undock(window);
    }
}

fn report(window: &WebviewWindow, next: IslandTaskbar) {
    let mut reported = REPORTED.lock().unwrap_or_else(PoisonError::into_inner);
    if *reported != next {
        *reported = next;
        let _ = window.emit(TASKBAR_CHANGED_EVENT, next);
    }
}

pub(super) fn lift(window: &WebviewWindow) {
    release(window);
    set_panel(None);
    report(window, IslandTaskbar::default());
}

pub(super) fn panel_room(state: IslandWindowState) -> f64 {
    if wanted(state) && supported() {
        PANEL_ROOM
    } else {
        0.0
    }
}

fn panel_space(state: DockState, island_height: i32, scale: f64) -> Option<PanelSpace> {
    let rect = state.rect.filter(|_| state.status == DockStatus::Shown && state.edge == Some(BarEdge::Bottom))?;
    let bar = state.bar.unwrap_or(rect);
    let gap = (PANEL_GAP * scale).round() as i32;
    let island_bottom = (rect.top + rect.bottom + island_height) / 2;
    let center = (rect.left + rect.right) / 2;
    Some(PanelSpace {
        lift: island_bottom - rect.top + gap,
        room_left: (center - bar.left - gap).max(0),
        room_right: (bar.right - center - gap).max(0),
    })
}

fn panel_shift(width: f64, room_left: f64, room_right: f64) -> f64 {
    let half = width / 2.0;
    if width >= room_left + room_right {
        (room_right - room_left) / 2.0
    } else if half > room_left {
        half - room_left
    } else if half > room_right {
        room_right - half
    } else {
        0.0
    }
}

pub(super) fn cursor_on_bar_or_panel(
    (left, top, width, height): (f64, f64, f64, f64),
    (x, y): (f64, f64),
    state: IslandWindowState,
) -> Option<bool> {
    let space = panel().filter(|_| wanted(state) && matches!(state.mode, IslandMode::Expanded))?;
    let lift = f64::from(space.lift);
    let bar = IslandWindowState { mode: IslandMode::Collapsed, ..state };
    let on_bar = super::geometry::cursor_on_island(left, top, width, height, x, y, bar);
    let panel_width = super::geometry::island_rect(left, top, width, height, state).width;
    let shift = panel_shift(panel_width, f64::from(space.room_left), f64::from(space.room_right));
    let on_panel = super::geometry::cursor_on_island(left + shift, top, width, height - lift, x, y, state);
    let between = {
        let rect = super::geometry::island_rect(left, top, width, height, bar);
        x >= rect.left && x <= rect.left + rect.width && y >= top + height - lift && y <= rect.top
    };
    Some(on_bar || on_panel || between)
}

pub(super) use super::taskbar_drag::TaskbarDrop;

pub(crate) fn reported() -> IslandTaskbar {
    *REPORTED.lock().unwrap_or_else(PoisonError::into_inner)
}

fn stage_on_bar(state: DockState, island: (i32, i32), stage: (i32, i32)) -> Option<(i32, i32)> {
    let rect = state.rect.filter(|_| state.status == DockStatus::Shown && state.edge == Some(BarEdge::Bottom))?;
    let x = rect.right - (island.0 + stage.0) / 2;
    let y = (rect.top + rect.bottom + island.1) / 2 - stage.1;
    Some((x, y))
}

pub(super) fn stage_position(
    window: &WebviewWindow,
    monitor: &Monitor,
    state: IslandWindowState,
    stage: (i32, i32),
) -> Option<(i32, i32)> {
    if !wanted(state) || !supported() {
        release(window);
        set_panel(None);
        report(window, IslandTaskbar::default());
        return None;
    }
    let island = collapsed_size(state, screen::monitor_scale(monitor));
    sync(window, monitor, island.0);
    let held = super::taskbar_drag::held_position();
    if held.is_none() {
        taskbar_host::set_preferred(window, state.custom_position.and_then(|position| position.along));
    }
    let dock = taskbar_host::current(window);
    let placed = held.or_else(|| dock.and_then(|dock| stage_on_bar(dock, island, stage)));
    let scale = screen::monitor_scale(monitor);
    let space = dock.filter(|_| held.is_none() && placed.is_some()).and_then(|dock| panel_space(dock, island.1, scale));
    set_panel(space);
    taskbar_host::set_raised(window, placed.is_some() && matches!(state.mode, IslandMode::Expanded));
    let css = |value: i32| (f64::from(value) / scale.max(0.1)).round().max(0.0) as u32;
    report(window, IslandTaskbar {
        docked: true,
        placed: placed.is_some(),
        light: dock.is_some_and(|dock| dock.light),
        lift: space.map_or(0, |space| css(space.lift)),
        room_left: space.map_or(0, |space| css(space.room_left)),
        room_right: space.map_or(0, |space| css(space.room_right)),
    });
    placed
}

#[tauri::command]
pub fn start_island_taskbar_drag(app: AppHandle) -> Result<(), String> {
    super::taskbar_drag::start(&super::main_window(&app)?)
}

#[tauri::command]
pub fn end_island_taskbar_drag() {
    super::taskbar_drag::stop();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shown(left: i32, right: i32) -> DockState {
        DockState { status: DockStatus::Shown, rect: Some(Rect::new(left, 2100, right, 2160)), edge: Some(BarEdge::Bottom), light: false, bar: None }
    }

    #[test]
    fn the_collapsed_island_ends_at_the_slot_and_sits_in_the_middle_of_the_bar() {
        let (x, y) = stage_on_bar(shown(2800, 3200), (400, 44), (1200, 900)).unwrap();
        assert_eq!(x + (1200 - 400) / 2 + 400, 3200);
        assert_eq!(y + 900 - 44 / 2, 2130);
    }

    #[test]
    fn the_panel_rises_from_the_top_of_the_bar_with_a_gap() {
        let bar = DockState { bar: Some(Rect::new(0, 2100, 3840, 2160)), ..shown(2800, 3200) };
        let space = panel_space(bar, 44, 1.5).unwrap();
        assert_eq!(space.lift, (2100 + 2160 + 44) / 2 - 2100 + 12);
        assert_eq!((space.room_left, space.room_right), (3000 - 12, 3840 - 3000 - 12));
        assert!(panel_space(DockState { status: DockStatus::Fullscreen, ..bar }, 44, 1.0).is_none());
    }

    #[test]
    fn the_panel_moves_inward_near_the_edges_of_the_taskbar() {
        assert_eq!(panel_shift(600.0, 1000.0, 1000.0), 0.0);
        assert_eq!(panel_shift(600.0, 1000.0, 200.0), -100.0);
        assert_eq!(panel_shift(600.0, 100.0, 1000.0), 200.0);
        assert_eq!(panel_shift(600.0, 100.0, 300.0), 100.0);
    }

    #[test]
    fn falls_back_when_the_bar_is_hidden_full_or_on_a_side() {
        let island = (400, 44);
        let stage = (1200, 900);
        assert!(stage_on_bar(DockState { status: DockStatus::BarHidden, ..shown(0, 400) }, island, stage).is_none());
        assert!(stage_on_bar(DockState { status: DockStatus::NoRoom, rect: None, edge: Some(BarEdge::Bottom), light: false, bar: None }, island, stage).is_none());
        assert!(stage_on_bar(DockState { edge: Some(BarEdge::Left), ..shown(0, 400) }, island, stage).is_none());
    }

    #[test]
    fn a_taskbar_position_keeps_its_flag_when_the_island_changes_monitor() {
        let previous = IslandPosition { taskbar: true, ..IslandPosition::at(10, 20) };
        assert!(keep_flag(Some(previous), IslandPosition::at(500, 600)).taskbar);
        let dragged = IslandPosition { taskbar: true, along: Some(0.3), ..IslandPosition::at(10, 20) };
        assert_eq!(keep_flag(Some(dragged), IslandPosition::at(500, 600)).along, Some(0.3));
        assert!(!keep_flag(None, IslandPosition::at(500, 600)).taskbar);
        let stored: IslandPosition = serde_json::from_str(r#"{"x":1,"y":2,"edge":"bottom","taskbar":true}"#).unwrap();
        assert!(stored.taskbar);
        assert_eq!(serde_json::to_string(&IslandPosition::at(1, 2)).unwrap(), r#"{"x":1,"y":2}"#);
    }
}
