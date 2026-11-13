use tauri::{Emitter, WebviewWindow};

use super::state::{mutate_window_state, read_window_state, Edge};
use super::top_edge::TOP_ATTACHMENT_CHANGED_EVENT;

pub(crate) const EDGE_CHANGED_EVENT: &str = "island-edge-changed";

pub(crate) fn attached() -> Option<Edge> {
    read_window_state().attached_edge
}

pub(crate) fn set_attached(window: &WebviewWindow, edge: Option<Edge>) {
    let mut previous = None;
    mutate_window_state(|state| {
        previous = state.attached_edge;
        state.attached_edge = edge;
        *state
    });

    if previous == edge {
        return;
    }
    let _ = window.emit(EDGE_CHANGED_EVENT, edge);
    let is_top = edge == Some(Edge::Top);
    if (previous == Some(Edge::Top)) != is_top {
        let _ = window.emit(TOP_ATTACHMENT_CHANGED_EVENT, is_top);
    }
}
