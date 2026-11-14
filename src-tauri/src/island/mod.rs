pub(crate) mod banner_hit;
#[cfg_attr(target_os = "macos", path = "focus_macos.rs")]
#[cfg_attr(not(any(windows, target_os = "macos")), path = "focus_unsupported.rs")]
pub(crate) mod focus;
#[cfg_attr(not(windows), path = "follow_unsupported.rs")]
mod follow;
mod edge;
mod geometry;
pub(crate) mod notch;
mod side;
#[cfg_attr(not(windows), path = "glass_unsupported.rs")]
mod glass;
#[cfg_attr(not(windows), path = "modifier_unsupported.rs")]
pub(crate) mod modifier;
#[cfg_attr(not(windows), path = "outside_click_unsupported.rs")]
pub(crate) mod outside_click;
#[cfg_attr(target_os = "macos", path = "passthrough_macos.rs")]
pub(crate) mod passthrough;
pub(crate) mod screen;
mod state;
pub(crate) mod top_edge;

#[cfg(test)]
mod tests;

use serde::Deserialize;
use std::{
    sync::{atomic::Ordering, PoisonError},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

use geometry::{
    monitor_for_island_position, out_at_top_after, DEFAULT_EXPANDED_ISLAND_HEIGHT, EXPANDED_ISLAND_HEIGHT_RANGE,
    max_expanded_width, MAX_ADJUSTED_COLLAPSED_WIDTH, MAX_CORNER_RADIUS, MIN_ADJUSTED_COLLAPSED_WIDTH,
    MIN_COLLAPSED_ISLAND_WIDTH, MIN_CORNER_RADIUS,
    MIN_EXPANDED_ISLAND_HEIGHT, POSITION_ANIMATION_GENERATION,
};
use glass::apply_glass_material;
#[cfg(windows)]
use crate::win32;
use state::{mutate_window_state, read_window_state, window_state, CornerShape, IslandMode, MonitorFollow};

pub(crate) use geometry::apply_stage_geometry;
pub(crate) use follow::start_monitor_follow_loop;
#[cfg(debug_assertions)]
pub(crate) use notch::set_dev_notch;
pub(crate) use notch::start_notch_watch;
pub(crate) use passthrough::start_cursor_passthrough_loop;
pub(crate) use state::{record_dragged_position, IslandPosition, IslandWindowState};

pub(crate) const WINDOW_LABEL: &str = "main";
const ISLAND_REVEAL_REQUESTED_EVENT: &str = "island-reveal-requested";
const ISLAND_POSITION_CHANGED_EVENT: &str = "island-position-changed";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IslandLayout {
    collapsed_scale: f64,
    expanded_scale: f64,
    margin_y: f64,
    #[serde(default)]
    under_menu_bar: bool,
    #[serde(default)]
    fit_notch: bool,
}

#[tauri::command]
pub fn set_island_layout(app: AppHandle, layout: IslandLayout) -> Result<(), String> {
    let window = main_window(&app)?;
    let state = mutate_window_state(|state| {
        state.collapsed_scale = layout.collapsed_scale.clamp(0.75, 1.4);
        state.expanded_scale = layout.expanded_scale.clamp(0.75, 1.4);
        state.margin_y = layout.margin_y.clamp(0.0, 160.0);
        state.under_menu_bar = layout.under_menu_bar;
        state.fit_notch = layout.fit_notch;
        *state
    });
    apply_stage_geometry(&window, state, false)
}

#[tauri::command]
#[expect(
    clippy::too_many_arguments,
    reason = "each argument is a named field of the set_island_interaction IPC contract"
)]
pub fn set_island_interaction(
    app: AppHandle,
    mode: String,
    collapsed_scale: f64,
    expanded_scale: f64,
    margin_y: Option<f64>,
    expanded_height: Option<f64>,
    collapsed_width: Option<f64>,
    expanded_width: Option<f64>,
    custom_position: Option<IslandPosition>,
    is_tucked: Option<bool>,
    animate_position: Option<bool>,
    glass_enabled: Option<bool>,
    glass_intensity: Option<f64>,
    glass_tint: Option<String>,
    corner_radius: Option<f64>,
    corner_shape: Option<String>,
    monitor_follow: Option<String>,
) -> Result<String, String> {
    let _ = (glass_intensity, glass_tint);
    let window = main_window(&app)?;
    let mode = IslandMode::from_value(&mode)?;
    let previous_state = read_window_state();
    let restored_custom_position = previous_state.custom_position.or_else(|| {
        custom_position.filter(|position| {
            monitor_for_island_position(&window, *position)
                .ok()
                .flatten()
                .is_some()
        })
    });
    let state = mutate_window_state(|state| {
        let (was_tucked, was_expanded) = (state.is_tucked, matches!(state.mode, IslandMode::Expanded));
        state.mode = mode;
        state.is_tucked = is_tucked.unwrap_or(false);
        state.out_at_top = out_at_top_after(state.out_at_top, was_tucked, was_expanded, state.is_tucked, mode);
        state.collapsed_scale = collapsed_scale.clamp(0.75, 1.4);
        state.expanded_scale = expanded_scale.clamp(0.75, 1.4);
        if let Some(margin_y) = margin_y {
            state.margin_y = margin_y.clamp(0.0, 160.0);
        }
        if let Some(expanded_height) = expanded_height {
            state.expanded_height = expanded_height.clamp(
                MIN_EXPANDED_ISLAND_HEIGHT,
                DEFAULT_EXPANDED_ISLAND_HEIGHT + EXPANDED_ISLAND_HEIGHT_RANGE,
            );
        }
        if let Some(expanded_width) = expanded_width {
            state.expanded_width =
                expanded_width.clamp(MIN_COLLAPSED_ISLAND_WIDTH, max_expanded_width(state.expanded_scale));
        }
        if let Some(collapsed_width) = collapsed_width {
            state.collapsed_width =
                collapsed_width.clamp(MIN_ADJUSTED_COLLAPSED_WIDTH, MAX_ADJUSTED_COLLAPSED_WIDTH);
        }
        if state.custom_position.is_none() {
            state.custom_position = restored_custom_position;
        }
        state.glass_enabled = glass_enabled.unwrap_or(false);
        if let Some(corner_radius) = corner_radius {
            state.corner_radius = corner_radius.clamp(MIN_CORNER_RADIUS, MAX_CORNER_RADIUS);
        }
        if let Some(corner_shape) = corner_shape.as_deref().and_then(CornerShape::from_value) {
            state.corner_shape = corner_shape;
        }
        if let Some(monitor_follow) = monitor_follow.as_deref().and_then(MonitorFollow::from_value) {
            state.monitor_follow = monitor_follow;
        }
        *state
    });
    apply_stage_geometry(
        &window,
        state,
        animate_position.unwrap_or(true)
            && (previous_state.is_tucked != state.is_tucked || previous_state.out_at_top != state.out_at_top),
    )?;
    apply_glass_material(&window, state)
}

#[tauri::command]
pub fn start_island_drag(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;
    let current_state = read_window_state();

    if !matches!(current_state.mode, IslandMode::Collapsed) {
        return Ok(());
    }

    drag_island(window, current_state)
}

#[tauri::command]
pub fn start_island_modifier_drag(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;

    if !alt_key_down() {
        return Ok(());
    }
    if modifier::start_resize(&window) {
        return Ok(());
    }

    drag_island(window, read_window_state())
}

#[cfg(windows)]
fn alt_key_down() -> bool {
    win32::input::is_alt_key_down()
}

#[cfg(target_os = "macos")]
fn alt_key_down() -> bool {
    crate::macos::input::is_option_key_down()
}

#[cfg(windows)]
fn left_button_down() -> bool {
    win32::input::is_left_button_down()
}

#[cfg(target_os = "macos")]
fn left_button_down() -> bool {
    crate::macos::input::is_left_button_down()
}

fn drag_island(window: WebviewWindow, current_state: IslandWindowState) -> Result<(), String> {
    if current_state.is_tucked || current_state.is_dragging {
        return Ok(());
    }

    let position = screen::window_position(&window)?;
    POSITION_ANIMATION_GENERATION.fetch_add(1, Ordering::SeqCst);
    mutate_window_state(|state| {
        state.custom_position = Some(IslandPosition::at(position.x, position.y));
        state.out_at_top = false;
        state.is_dragging = true;
        *state
    });
    if current_state.side().is_none() {
        top_edge::set_attached(&window, false);
    }

    if let Err(error) = window.start_dragging() {
        mutate_window_state(|state| {
            state.is_dragging = false;
            state.custom_position = current_state.custom_position;
            *state
        });
        return Err(error.to_string());
    }

    thread::spawn(move || {
        while left_button_down() {
            thread::sleep(Duration::from_millis(8));
        }
        thread::sleep(Duration::from_millis(8));

        let final_position = screen::window_position(&window).ok().map(|position| {
            side::snap_after_drag(&window, IslandPosition::at(position.x, position.y), read_window_state())
        });
        let did_finish_drag = {
            let mut state = window_state().lock().unwrap_or_else(PoisonError::into_inner);
            if !state.is_dragging {
                false
            } else {
                state.is_dragging = false;
                if let Some(position) = final_position {
                    state.custom_position = Some(position);
                }
                true
            }
        };

        if did_finish_drag {
            if let Some(position) = final_position {
                let _ = window.emit(ISLAND_POSITION_CHANGED_EVENT, position);
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn reset_island_position(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;
    let state = mutate_window_state(|state| {
        state.custom_position = None;
        state.is_dragging = false;
        *state
    });

    apply_stage_geometry(&window, state, false)
}

#[tauri::command]
pub fn minimize_island(app: AppHandle) -> Result<(), String> {
    hide_island(&app);
    Ok(())
}

#[tauri::command]
pub fn show_ready_island(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;
    apply_stage_geometry(&window, read_window_state(), false)?;
    focus::show_island_at_startup(&window)?;
    if read_window_state().is_tucked {
        let _ = window.emit(ISLAND_REVEAL_REQUESTED_EVENT, ());
    }
    Ok(())
}

pub(crate) fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(WINDOW_LABEL)
        .ok_or_else(|| "Main island window was not found.".to_string())
}

pub(crate) fn show_island(app: &AppHandle) -> Result<(), String> {
    let window = main_window(app)?;
    apply_stage_geometry(&window, read_window_state(), false)?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    if read_window_state().is_tucked {
        let _ = window.emit(ISLAND_REVEAL_REQUESTED_EVENT, ());
    }
    Ok(())
}

pub(crate) fn hide_island(app: &AppHandle) {
    POSITION_ANIMATION_GENERATION.fetch_add(1, Ordering::SeqCst);
    if let Ok(window) = main_window(app) {
        let _ = window.hide();
    }
}

#[tauri::command]
pub fn get_island_top_attachment() -> bool {
    top_edge::is_attached()
}

#[tauri::command]
pub fn get_island_edge() -> Option<state::Edge> {
    edge::attached()
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::island::set_island_layout,
            crate::island::set_island_interaction,
            crate::island::start_island_drag,
            crate::island::start_island_modifier_drag,
            crate::island::reset_island_position,
            crate::island::get_island_top_attachment,
            crate::island::get_island_edge,
            crate::island::notch::get_island_notch,
            crate::island::notch::set_island_notch_drop,
            crate::island::show_ready_island,
            crate::island::minimize_island,
            crate::island::focus::take_island_hover_focus,
            crate::island::focus::release_island_hover_focus,
            crate::island::focus::island_is_foreground,
            crate::island::passthrough::set_island_cursor_tracking,
            crate::island::modifier::set_island_panel_resizable,
            crate::island::banner_hit::set_island_banner_rect,
            crate::island::outside_click::set_island_outside_click_watch,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
