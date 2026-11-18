use serde::Serialize;
use std::sync::{Mutex, PoisonError};
use tauri::{Emitter, Monitor, WebviewWindow};

use super::state::{mutate_window_state, read_window_state, IslandWindowState};

static DEV_NOTCH: Mutex<Option<Notch>> = Mutex::new(None);

pub(crate) const ISLAND_NOTCH_CHANGED_EVENT: &str = "island-notch-changed";
pub(crate) const ISLAND_AUTO_FORM_CHANGED_EVENT: &str = "island-auto-form-changed";
pub(super) const MIN_NOTCH_WING: f64 = 56.0;
pub(super) const TUCKED_NOTCH_INSET: f64 = 2.0;
pub(super) const NOTCH_DROP_HEIGHT: f64 = 38.0;
const SIMULATED_NOTCH_WIDTH: f64 = 240.0;
const SIMULATED_NOTCH_HEIGHT: f64 = 32.0;
const SIMULATED_NOTCH_GAP_SHARE: f64 = 0.3;
const SIMULATED_NOTCH_TUCKED_VISIBLE: f64 = 6.0;
const NOTCH_BOTTOM_RADIUS: f64 = 14.0;
const TUCKED_NOTCH_BOTTOM_RADIUS: f64 = 10.0;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub(crate) struct Notch {
    pub(crate) width: f64,
    pub(crate) height: f64,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub(crate) simulated: bool,
}

impl Notch {
    pub(super) fn real(width: f64, height: f64) -> Self {
        Self { width, height, simulated: false }
    }

    pub(super) fn simulated(collapsed_scale: f64) -> Self {
        Self {
            width: SIMULATED_NOTCH_WIDTH * SIMULATED_NOTCH_GAP_SHARE * collapsed_scale,
            height: SIMULATED_NOTCH_HEIGHT * collapsed_scale,
            simulated: true,
        }
    }

    pub(super) fn slides_to_tuck(self) -> bool {
        self.simulated
    }

    pub(super) fn tucked_depth(self) -> f64 {
        (self.height - SIMULATED_NOTCH_TUCKED_VISIBLE).max(0.0)
    }

    pub(super) fn bottom_radius(self, tucked: bool) -> f64 {
        if tucked && !self.simulated {
            TUCKED_NOTCH_BOTTOM_RADIUS
        } else {
            NOTCH_BOTTOM_RADIUS
        }
    }
}

pub(super) fn wants_notch(state: IslandWindowState) -> bool {
    state.fit_notch
        && !state.under_menu_bar
        && state.custom_position.is_none()
        && state.margin_y <= 0.0
        && state.side().is_none()
}

pub(super) fn collapsed_size(collapsed_width: f64, scale: f64, notch: Notch, tucked: bool, drop: bool) -> (f64, f64) {
    let scale = scale.max(0.01);
    let height = notch.height / scale;
    if tucked && !notch.simulated {
        return (((notch.width - 2.0 * TUCKED_NOTCH_INSET) / scale).max(1.0), height);
    }
    let height = if drop && !tucked { height + NOTCH_DROP_HEIGHT } else { height };
    (collapsed_width.max(notch.width / scale + 2.0 * MIN_NOTCH_WING), height)
}

#[tauri::command]
pub fn set_island_notch_drop(drop: bool) {
    mutate_window_state(|state| {
        state.notch_drop = drop;
        *state
    });
}

#[cfg(target_os = "macos")]
fn notch_for(window: &WebviewWindow, monitor: &Monitor) -> Option<Notch> {
    let origin = super::screen::monitor_origin(monitor);
    let size = super::screen::monitor_size(monitor);
    let notches = crate::macos::notch::read_notches(window);
    crate::macos::notch::notch_on(&notches, f64::from(origin.x), f64::from(origin.y), f64::from(size.width))
        .map(|notch| Notch::real(notch.width, notch.height))
}

#[cfg(not(target_os = "macos"))]
fn notch_for(_window: &WebviewWindow, _monitor: &Monitor) -> Option<Notch> {
    None
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum AutoForm {
    Notch,
    Top,
}

pub(super) fn resolve_auto_form(state: IslandWindowState, screen_has_notch: bool) -> IslandWindowState {
    if !state.auto_form {
        return state;
    }
    if screen_has_notch {
        IslandWindowState { fit_notch: true, under_menu_bar: false, margin_y: 0.0, ..state }
    } else {
        IslandWindowState { fit_notch: false, ..state }
    }
}

fn shown_auto_form(state: IslandWindowState) -> Option<AutoForm> {
    state.auto_form.then_some(if state.fit_notch { AutoForm::Notch } else { AutoForm::Top })
}

fn screen_notch(window: &WebviewWindow, monitor: &Monitor) -> Option<Notch> {
    dev_notch().or_else(|| notch_for(window, monitor))
}

pub(super) fn resolve(window: &WebviewWindow, monitor: &Monitor, state: IslandWindowState) -> IslandWindowState {
    if !state.auto_form {
        return state;
    }
    resolve_auto_form(state, screen_notch(window, monitor).is_some())
}

pub(super) fn under_menu_bar(window: &WebviewWindow, monitor: &Monitor, state: IslandWindowState) -> bool {
    let state = resolve(window, monitor, state);
    state.under_menu_bar || (!state.fit_notch && screen_notch(window, monitor).is_some())
}

fn dev_notch() -> Option<Notch> {
    *DEV_NOTCH.lock().unwrap_or_else(PoisonError::into_inner)
}

#[cfg(debug_assertions)]
pub(crate) fn set_dev_notch(app: &tauri::AppHandle, size: Option<(f64, f64)>) -> Result<(), String> {
    *DEV_NOTCH.lock().unwrap_or_else(PoisonError::into_inner) = size.map(|(width, height)| Notch::real(width, height));
    let window = super::main_window(app)?;
    super::apply_stage_geometry(&window, read_window_state(), false)
}

pub(super) fn settle(window: &WebviewWindow, monitor: &Monitor, state: IslandWindowState) -> Option<Notch> {
    let notch = if wants_notch(state) {
        screen_notch(window, monitor).or(Some(Notch::simulated(state.collapsed_scale)))
    } else {
        None
    };
    let auto_form = shown_auto_form(state);
    let previous = read_window_state();
    if previous.notch != notch || previous.shown_auto_form != auto_form {
        mutate_window_state(|state| {
            state.notch = notch;
            state.shown_auto_form = auto_form;
            *state
        });
    }
    if previous.notch != notch {
        super::glass::refresh_glass(window);
        let _ = window.emit(ISLAND_NOTCH_CHANGED_EVENT, notch);
    }
    if previous.shown_auto_form != auto_form {
        let _ = window.emit(ISLAND_AUTO_FORM_CHANGED_EVENT, auto_form);
    }
    notch
}

#[tauri::command]
pub fn get_island_auto_form() -> Option<AutoForm> {
    read_window_state().shown_auto_form
}

#[tauri::command]
pub fn get_island_notch() -> Option<Notch> {
    read_window_state().notch
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOTCH: Notch = Notch { width: 200.0, height: 32.0, simulated: false };

    #[test]
    fn collapsed_island_is_at_least_notch_plus_two_wings() {
        let (width, height) = collapsed_size(220.0, 1.0, NOTCH, false, false);
        assert_eq!(width, 200.0 + 2.0 * MIN_NOTCH_WING);
        assert_eq!(height, 32.0);
        assert_eq!(collapsed_size(500.0, 1.0, NOTCH, false, false).0, 500.0);
    }

    #[test]
    fn sizes_are_in_unscaled_layer_units() {
        let (width, height) = collapsed_size(220.0, 0.8, NOTCH, false, false);
        assert!((width - (250.0 + 2.0 * MIN_NOTCH_WING)).abs() < 1e-9);
        assert!((height - 40.0).abs() < 1e-9);
    }

    #[test]
    fn a_message_drops_one_row_below_the_notch() {
        assert_eq!(collapsed_size(220.0, 1.0, NOTCH, false, true).1, 32.0 + NOTCH_DROP_HEIGHT);
    }

    #[test]
    fn tucked_island_hides_just_inside_the_notch() {
        let (width, height) = collapsed_size(340.0, 1.0, NOTCH, true, true);
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

    #[test]
    fn auto_form_fits_the_notch_only_on_a_screen_with_one() {
        let auto = IslandWindowState { auto_form: true, under_menu_bar: true, margin_y: 12.0, ..IslandWindowState::default() };
        let on_notch = resolve_auto_form(auto, true);
        assert!(on_notch.fit_notch && !on_notch.under_menu_bar && on_notch.margin_y == 0.0);
        assert!(wants_notch(on_notch));
        assert_eq!(shown_auto_form(on_notch), Some(AutoForm::Notch));
        let elsewhere = resolve_auto_form(IslandWindowState { fit_notch: true, ..auto }, false);
        assert!(!elsewhere.fit_notch && elsewhere.under_menu_bar && elsewhere.margin_y == 12.0);
        assert_eq!(shown_auto_form(elsewhere), Some(AutoForm::Top));
    }

    #[test]
    fn chosen_forms_are_left_alone() {
        let top = IslandWindowState { under_menu_bar: true, ..IslandWindowState::default() };
        let resolved = resolve_auto_form(top, true);
        assert!(!resolved.fit_notch && resolved.under_menu_bar);
        assert_eq!(shown_auto_form(resolved), None);
        let notch = IslandWindowState { fit_notch: true, ..IslandWindowState::default() };
        assert!(resolve_auto_form(notch, false).fit_notch);
    }

    #[test]
    fn simulated_notch_is_240_by_32_with_a_30_percent_gap_and_scales() {
        let notch = Notch::simulated(1.0);
        assert!((notch.width - 72.0).abs() < 1e-9);
        assert_eq!(notch.height, 32.0);
        assert!(notch.slides_to_tuck());
        let scaled = Notch::simulated(1.25);
        assert!((scaled.height - 40.0).abs() < 1e-9);
        assert!((scaled.tucked_depth() - 34.0).abs() < 1e-9);
        assert_eq!(scaled.bottom_radius(true), NOTCH_BOTTOM_RADIUS);
    }

    #[test]
    fn tucked_simulated_notch_keeps_its_width_and_drops_no_row() {
        let (width, height) = collapsed_size(240.0, 1.0, Notch::simulated(1.0), true, true);
        assert_eq!(width, 240.0);
        assert_eq!(height, 32.0);
    }
}
