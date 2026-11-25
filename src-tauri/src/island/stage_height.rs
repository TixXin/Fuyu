use super::{
    geometry::{STAGE_WINDOW_HEIGHT, STAGE_WINDOW_PADDING_Y},
    state::{Edge, IslandMode, IslandWindowState},
};

const TUCKED_STAGE_MIN_HEIGHT: f64 = 120.0;
const TUCKED_STAGE_PAD: f64 = 48.0;

fn can_shrink_tucked_stage(state: IslandWindowState, has_popup: bool) -> bool {
    matches!(state.mode, IslandMode::Collapsed)
        && state.is_tucked
        && !has_popup
        && state.side().is_none()
        && state.attached_edge != Some(Edge::Bottom)
        && !state.custom_position.is_some_and(super::bottom_edge::is_bottom)
        && !super::taskbar::wanted(state)
        && !state.is_dragging
        && state.resize_reach.1 <= 0.0
}

pub(super) fn stage_height_for_with_popup(state: IslandWindowState, has_popup: bool) -> f64 {
    if can_shrink_tucked_stage(state, has_popup) {
        let collapsed = (state.collapsed_height * state.collapsed_scale).ceil();
        return (collapsed + TUCKED_STAGE_PAD)
            .max(TUCKED_STAGE_MIN_HEIGHT)
            .min(STAGE_WINDOW_HEIGHT);
    }
    let side_column = if state.side().is_some() {
        (state.side_column_height * state.collapsed_scale).ceil() + STAGE_WINDOW_PADDING_Y
    } else {
        0.0
    };
    let expanded = if matches!(state.mode, IslandMode::Expanded) || state.resize_reach.1 > 0.0 {
        (state.expanded_height.max(state.resize_reach.1) * state.expanded_scale).ceil() + STAGE_WINDOW_PADDING_Y
    } else {
        0.0
    };
    STAGE_WINDOW_HEIGHT
        .max(expanded)
        .max(side_column)
        + super::taskbar::panel_room(state)
}

pub(super) fn stage_height_for(state: IslandWindowState) -> f64 {
    stage_height_for_with_popup(state, super::banner_hit::has_active_popup())
}
