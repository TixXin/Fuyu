use serde::Serialize;
use std::sync::{Mutex, PoisonError};
use tauri::{Emitter, Monitor, WebviewWindow};

use super::state::{mutate_window_state, read_window_state, IslandWindowState};

static DEV_NOTCH: Mutex<Option<Notch>> = Mutex::new(None);

pub(crate) const ISLAND_NOTCH_CHANGED_EVENT: &str = "island-notch-changed";
pub(super) const MIN_NOTCH_WING: f64 = 72.0;
pub(super) const TUCKED_NOTCH_INSET: f64 = 2.0;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub(crate) struct Notch {
    pub(crate) width: f64,
    pub(crate) height: f64,
}

pub(super) fn wants_notch(state: IslandWindowState) -> bool {
    state.fit_notch
        && !state.under_menu_bar
        && state.custom_position.is_none()
        && state.margin_y <= 0.0
        && state.side().is_none()
}

pub(super) fn collapsed_size(collapsed_width: f64, scale: f64, notch: Notch, tucked: bool) -> (f64, f64) {
    let scale = scale.max(0.01);
    let height = notch.height / scale;
    if tucked {
        return (((notch.width - 2.0 * TUCKED_NOTCH_INSET) / scale).max(1.0), height);
    }
    (collapsed_width.max(notch.width / scale + 2.0 * MIN_NOTCH_WING), height)
}

#[cfg(target_os = "macos")]
fn notch_for(window: &WebviewWindow, monitor: &Monitor) -> Option<Notch> {
    let origin = super::screen::monitor_origin(monitor);
    let size = super::screen::monitor_size(monitor);
    let notches = crate::macos::notch::read_notches(window);
    crate::macos::notch::notch_on(&notches, f64::from(origin.x), f64::from(origin.y), f64::from(size.width))
        .map(|notch| Notch { width: notch.width, height: notch.height })
}

#[cfg(not(target_os = "macos"))]
fn notch_for(_window: &WebviewWindow, _monitor: &Monitor) -> Option<Notch> {
    None
}

fn dev_notch() -> Option<Notch> {
    *DEV_NOTCH.lock().unwrap_or_else(PoisonError::into_inner)
}

#[cfg(debug_assertions)]
pub(crate) fn set_dev_notch(app: &tauri::AppHandle, size: Option<(f64, f64)>) -> Result<(), String> {
    *DEV_NOTCH.lock().unwrap_or_else(PoisonError::into_inner) = size.map(|(width, height)| Notch { width, height });
    let window = super::main_window(app)?;
    super::apply_stage_geometry(&window, read_window_state(), false)
}

pub(super) fn settle(window: &WebviewWindow, monitor: &Monitor, state: IslandWindowState) -> Option<Notch> {
    let notch = if wants_notch(state) { dev_notch().or_else(|| notch_for(window, monitor)) } else { None };
    let previous = read_window_state().notch;
    if previous != notch {
        mutate_window_state(|state| {
            state.notch = notch;
            *state
        });
        let _ = window.emit(ISLAND_NOTCH_CHANGED_EVENT, notch);
    }
    notch
}

#[tauri::command]
pub fn get_island_notch() -> Option<Notch> {
    read_window_state().notch
}

#[cfg(target_os = "macos")]
pub(crate) fn start_notch_watch(window: WebviewWindow) {
    use std::{thread, time::Duration};

    thread::spawn(move || {
        let mut last = crate::macos::notch::read_notches(&window);
        loop {
            thread::sleep(Duration::from_secs(2));
            let notches = crate::macos::notch::read_notches(&window);
            if notches == last {
                continue;
            }
            last = notches;
            if let Err(error) = super::apply_stage_geometry(&window, read_window_state(), false) {
                eprintln!("Failed to refit the island to the notch: {error}");
            }
        }
    });
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn start_notch_watch(_window: WebviewWindow) {}

#[cfg(test)]
mod tests {
    use super::*;

    const NOTCH: Notch = Notch { width: 200.0, height: 32.0 };

    #[test]
    fn collapsed_island_is_at_least_notch_plus_two_wings() {
        let (width, height) = collapsed_size(220.0, 1.0, NOTCH, false);
        assert_eq!(width, 200.0 + 2.0 * MIN_NOTCH_WING);
        assert_eq!(height, 32.0);
        assert_eq!(collapsed_size(500.0, 1.0, NOTCH, false).0, 500.0);
    }

    #[test]
    fn sizes_are_in_unscaled_layer_units() {
        let (width, height) = collapsed_size(220.0, 0.8, NOTCH, false);
        assert!((width - (250.0 + 2.0 * MIN_NOTCH_WING)).abs() < 1e-9);
        assert!((height - 40.0).abs() < 1e-9);
    }

    #[test]
    fn tucked_island_hides_just_inside_the_notch() {
        let (width, height) = collapsed_size(340.0, 1.0, NOTCH, true);
        assert_eq!(width, 200.0 - 2.0 * TUCKED_NOTCH_INSET);
        assert_eq!(height, 32.0);
    }

    #[test]
    fn notch_only_when_centered_flush_and_over_the_menu_bar() {
        let base = IslandWindowState { fit_notch: true, ..IslandWindowState::default() };
        assert!(wants_notch(base));
        assert!(!wants_notch(IslandWindowState { fit_notch: false, ..base }));
        assert!(!wants_notch(IslandWindowState { under_menu_bar: true, ..base }));
        assert!(!wants_notch(IslandWindowState { margin_y: 8.0, ..base }));
        assert!(!wants_notch(IslandWindowState { custom_position: Some(super::super::IslandPosition::at(10, 0)), ..base }));
    }
}
