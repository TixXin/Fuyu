use std::sync::{mpsc, Mutex, PoisonError};
use std::time::Duration;

use objc2_foundation::MainThreadMarker;
use tauri::{AppHandle, WebviewWindow};

use super::geometry::{
    island_left_in_stage, island_top_in_stage, STAGE_WINDOW_HEIGHT, STAGE_WINDOW_PADDING_Y,
    STAGE_WINDOW_WIDTH,
};
use super::main_window;
use super::state::{
    is_light_rgb, read_window_state, CornerShape, Edge, IslandGlassFrame, IslandMode,
    IslandWindowState, TuckStyle,
};
use crate::macos::island_glass::{
    sync_window_ptr, GlassCornerShape, GlassEdge, NativeGlassDecision, NativeGlassSpec,
};

const MAIN_THREAD_WAIT: Duration = Duration::from_millis(200);

static LAST_FRAME: Mutex<Option<IslandGlassFrame>> = Mutex::new(None);

fn store_last_frame(frame: Option<IslandGlassFrame>) {
    let mut slot = LAST_FRAME.lock().unwrap_or_else(PoisonError::into_inner);
    *slot = frame;
}

fn read_last_frame() -> Option<IslandGlassFrame> {
    *LAST_FRAME.lock().unwrap_or_else(PoisonError::into_inner)
}

pub(super) fn spec_from_state(
    state: IslandWindowState,
    frame: Option<IslandGlassFrame>,
) -> NativeGlassSpec {
    let stage_height = STAGE_WINDOW_HEIGHT
        .max((state.expanded_height * state.expanded_scale).ceil() + STAGE_WINDOW_PADDING_Y);
    let edge = match state.attached_edge {
        Some(Edge::Top) => Some(GlassEdge::Top),
        Some(Edge::Bottom) => Some(GlassEdge::Bottom),
        Some(Edge::Left) => Some(GlassEdge::Left),
        Some(Edge::Right) => Some(GlassEdge::Right),
        None => None,
    };
    let corner_shape = match state.corner_shape {
        CornerShape::Round => GlassCornerShape::Round,
        CornerShape::Squircle => GlassCornerShape::Squircle,
    };
    let notch_collapsed = matches!(state.mode, IslandMode::Collapsed)
        && state.notch.is_some()
        && !frame.is_some_and(|item| item.active_transition);
    let tucked_hidden =
        state.is_tucked && state.tuck_style == TuckStyle::Hidden && state.notch.is_none();
    let light = is_light_rgb(state.glass_tint_rgb);
    let tint_alpha = ((state.glass_intensity.clamp(0.0, 100.0) * 0.18) * 2.55).round() as u8;
    let tint_rgba = if tint_alpha > 0 {
        let (r, g, b) = state.glass_tint_rgb;
        Some((r, g, b, tint_alpha))
    } else {
        None
    };

    if let Some(item) = frame {
        return NativeGlassSpec {
            enabled: state.glass_enabled && state.glass_native,
            notch_collapsed,
            tucked_hidden,
            stage_height,
            left: item.left,
            top: item.top,
            width: item.width.max(1.0),
            height: item.height.max(1.0),
            top_radius: item.top_radius.max(0.0),
            bottom_radius: item.bottom_radius.max(0.0),
            fillet_radius: if edge.is_some() { item.fillet_radius.max(0.0) } else { 0.0 },
            corner_shape,
            edge,
            light,
            tint_rgba,
        };
    }

    let scale = state.active_scale();
    let (base_width, base_height) = state.base_size();
    let width = (base_width * scale).max(1.0);
    let height = (base_height * scale).max(1.0);
    let left = island_left_in_stage(state.side(), STAGE_WINDOW_WIDTH, width);
    let top = island_top_in_stage(state.attached_edge, stage_height, height);
    let top_radius = state.top_corner_radius() * scale;
    let bottom_radius = state.bottom_corner_radius() * scale;
    let fillet_base = if matches!(state.mode, IslandMode::Collapsed) && state.notch.is_some() {
        6.0
    } else {
        state.top_fillet_radius
    };
    let fillet_radius = if edge.is_some() {
        (fillet_base * scale).round()
    } else {
        0.0
    };

    NativeGlassSpec {
        enabled: state.glass_enabled && state.glass_native,
        notch_collapsed,
        tucked_hidden,
        stage_height,
        left,
        top,
        width,
        height,
        top_radius,
        bottom_radius,
        fillet_radius,
        corner_shape,
        edge,
        light,
        tint_rgba,
    }
}

pub(super) fn ui_state_for(
    state: IslandWindowState,
    decision: NativeGlassDecision,
) -> &'static str {
    if !state.glass_enabled {
        return "disabled";
    }
    if !state.glass_native {
        return "css-fallback";
    }
    decision.state_name()
}

pub(super) fn apply_glass_material(
    window: &WebviewWindow,
    state: IslandWindowState,
    frame: Option<IslandGlassFrame>,
) -> Result<String, String> {
    if frame.is_some() {
        store_last_frame(frame);
    }
    let spec = spec_from_state(state, frame.or_else(read_last_frame));
    let ptr = window.ns_window().map_err(|error| error.to_string())? as usize;
    let decision = match MainThreadMarker::new() {
        Some(mtm) => sync_window_ptr(ptr, &spec, mtm),
        None => {
            let (sender, receiver) = mpsc::sync_channel(1);
            window
                .run_on_main_thread(move || {
                    if let Some(mtm) = MainThreadMarker::new() {
                        let _ = sender.send(sync_window_ptr(ptr, &spec, mtm));
                    }
                })
                .map_err(|error| error.to_string())?;
            receiver
                .recv_timeout(MAIN_THREAD_WAIT)
                .unwrap_or(NativeGlassDecision::CssFallback)
        }
    };
    Ok(ui_state_for(state, decision).to_string())
}

pub(super) fn refresh_glass(window: &WebviewWindow) {
    let state = read_window_state();
    if !state.glass_enabled || !state.glass_native {
        return;
    }
    let spec = spec_from_state(state, None);
    let Ok(raw) = window.ns_window() else {
        return;
    };
    let ptr = raw as usize;
    if let Some(mtm) = MainThreadMarker::new() {
        let _ = sync_window_ptr(ptr, &spec, mtm);
    } else {
        let _ = window.run_on_main_thread(move || {
            if let Some(mtm) = MainThreadMarker::new() {
                let _ = sync_window_ptr(ptr, &spec, mtm);
            }
        });
    }
}

#[tauri::command]
pub fn sync_island_glass_frame(app: AppHandle, frame: IslandGlassFrame) -> Result<(), String> {
    store_last_frame(Some(frame));
    let state = read_window_state();
    if !state.glass_enabled || !state.glass_native {
        return Ok(());
    }
    let window = main_window(&app)?;
    let spec = spec_from_state(state, Some(frame));
    let ptr = window.ns_window().map_err(|error| error.to_string())? as usize;
    if let Some(mtm) = MainThreadMarker::new() {
        let _ = sync_window_ptr(ptr, &spec, mtm);
        return Ok(());
    }
    window
        .run_on_main_thread(move || {
            if let Some(mtm) = MainThreadMarker::new() {
                let _ = sync_window_ptr(ptr, &spec, mtm);
            }
        })
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::island::notch::Notch;

    #[test]
    fn non_native_backdrop_returns_css_fallback_and_keeps_spec_disabled() {
        let state = IslandWindowState {
            glass_enabled: true,
            glass_native: false,
            ..Default::default()
        };
        let spec = spec_from_state(state, None);
        assert!(!spec.enabled);
        assert_eq!(ui_state_for(state, NativeGlassDecision::Disabled), "css-fallback");
    }

    #[test]
    fn notch_collapsed_disables_native_glass_except_during_active_collapse_transition() {
        let state = IslandWindowState {
            glass_enabled: true,
            glass_native: true,
            mode: IslandMode::Collapsed,
            notch: Some(Notch { width: 200.0, height: 32.0, simulated: false }),
            ..Default::default()
        };

        let rest_spec = spec_from_state(state, None);
        assert!(rest_spec.notch_collapsed);
        assert_eq!(ui_state_for(state, NativeGlassDecision::Disabled), "disabled");

        let collapsing_frame = IslandGlassFrame {
            left: 130.0,
            top: 0.0,
            width: 560.0,
            height: 240.0,
            top_radius: 0.0,
            bottom_radius: 26.0,
            fillet_radius: 8.0,
            active_transition: true,
        };
        let collapsing_spec = spec_from_state(state, Some(collapsing_frame));
        assert!(!collapsing_spec.notch_collapsed);
    }

    #[test]
    fn expanded_and_detached_specs_preserve_edges_and_live_frame() {
        let state = IslandWindowState {
            glass_enabled: true,
            glass_native: true,
            mode: IslandMode::Expanded,
            attached_edge: None,
            ..Default::default()
        };
        let frame = IslandGlassFrame {
            left: 160.0,
            top: 12.0,
            width: 500.0,
            height: 290.0,
            top_radius: 28.0,
            bottom_radius: 28.0,
            fillet_radius: 8.0,
            active_transition: false,
        };
        let spec = spec_from_state(state, Some(frame));
        assert!(spec.enabled);
        assert_eq!(spec.edge, None);
        assert_eq!(spec.fillet_radius, 0.0);
        assert_eq!(spec.top_radius, 28.0);
        assert_eq!(ui_state_for(state, NativeGlassDecision::GlassEffectView), "active");
        assert_eq!(ui_state_for(state, NativeGlassDecision::CssFallback), "css-fallback");
    }
}
