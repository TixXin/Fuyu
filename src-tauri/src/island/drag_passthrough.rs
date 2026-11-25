use super::state::IslandWindowState;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub(super) struct ExternalDragGuard {
    was_pressed: bool,
    external_drag: bool,
}

impl ExternalDragGuard {
    pub(super) fn poll(
        &mut self,
        button_down: bool,
        raw_inside: bool,
        is_on_banner: bool,
        internal_drag: bool,
    ) -> bool {
        if !button_down {
            self.was_pressed = false;
            self.external_drag = false;
            return false;
        }
        if internal_drag {
            self.was_pressed = true;
            self.external_drag = false;
            return false;
        }
        if !self.was_pressed {
            self.was_pressed = true;
            self.external_drag = !raw_inside && !is_on_banner;
        }
        self.external_drag
    }
}

pub(super) fn external_drag_passthrough(state: IslandWindowState, external_drag: bool) -> bool {
    external_drag && !state.accepts_file_drop && !state.is_dragging
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn external_press_entering_island_passes_through_only_when_file_drop_is_disabled() {
        let mut guard = ExternalDragGuard::default();
        assert!(!guard.poll(false, false, false, false));
        assert!(guard.poll(true, false, false, false));
        assert!(guard.poll(true, true, false, false));

        let mut state = IslandWindowState::default();
        assert!(!state.accepts_file_drop);
        assert!(external_drag_passthrough(state, true));
        assert!(!external_drag_passthrough(state, false));

        state.accepts_file_drop = true;
        assert!(!external_drag_passthrough(state, true));

        state.accepts_file_drop = false;
        state.is_dragging = true;
        assert!(!external_drag_passthrough(state, true));

        assert!(!guard.poll(false, true, false, false));
    }

    #[test]
    fn press_starting_inside_island_or_banner_never_triggers_external_drag_passthrough() {
        let mut guard = ExternalDragGuard::default();
        assert!(!guard.poll(true, true, false, false));
        assert!(!guard.poll(true, false, false, false));
        assert!(!guard.poll(true, true, false, false));
        assert!(!guard.poll(false, true, false, false));

        assert!(!guard.poll(true, false, true, false));
        assert!(!guard.poll(true, true, false, false));
        assert!(!guard.poll(false, true, false, false));

        assert!(guard.poll(true, false, false, false));
        assert!(!guard.poll(true, true, false, true));
        assert!(!guard.poll(true, true, false, false));
    }
}
