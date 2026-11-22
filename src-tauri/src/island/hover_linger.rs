use super::geometry::IslandOnScreen;
use super::state::{IslandMode, IslandWindowState};

#[derive(Debug, Clone, Copy, PartialEq)]
struct Sample {
    inside: bool,
    panel: IslandOnScreen,
}

#[derive(Debug, Default)]
pub(super) struct HoverLinger {
    last: Option<Sample>,
    held: Option<IslandOnScreen>,
}

fn contains(rect: IslandOnScreen, (x, y): (f64, f64)) -> bool {
    x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height
}

impl HoverLinger {
    pub(super) fn poll(
        &mut self,
        state: IslandWindowState,
        raw_inside: bool,
        panel: Option<IslandOnScreen>,
        cursor: Option<(f64, f64)>,
    ) -> bool {
        let lingers = matches!(state.mode, IslandMode::Expanded) && !state.is_tucked && !state.pointer_passthrough();
        let (Some(panel), Some(cursor)) = (panel.filter(|_| lingers), cursor) else {
            *self = Self::default();
            return raw_inside;
        };
        let inside = if raw_inside {
            self.held = None;
            true
        } else if let Some(held) = self.held {
            let still = contains(held, cursor);
            if !still {
                self.held = None;
            }
            still
        } else if let Some(last) = self.last.filter(|last| last.inside && last.panel != panel && contains(last.panel, cursor)) {
            self.held = Some(last.panel);
            true
        } else {
            false
        };
        self.last = Some(Sample { inside, panel });
        inside
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn expanded() -> IslandWindowState {
        IslandWindowState { mode: IslandMode::Expanded, ..IslandWindowState::default() }
    }

    fn panel(left: f64, width: f64) -> Option<IslandOnScreen> {
        Some(IslandOnScreen { left, top: 0.0, width, height: 300.0, expanded: true })
    }

    #[test]
    fn a_panel_that_shrinks_away_from_a_still_cursor_keeps_the_hover() {
        let mut linger = HoverLinger::default();
        let cursor = Some((110.0, 20.0));
        assert!(linger.poll(expanded(), true, panel(100.0, 600.0), cursor));
        assert!(linger.poll(expanded(), false, panel(200.0, 400.0), cursor));
        assert!(linger.poll(expanded(), false, panel(200.0, 400.0), cursor));
        assert!(linger.poll(expanded(), false, panel(200.0, 400.0), Some((150.0, 40.0))));
    }

    #[test]
    fn leaving_the_old_bounds_or_entering_the_new_panel_ends_the_hold() {
        let mut linger = HoverLinger::default();
        assert!(linger.poll(expanded(), true, panel(100.0, 600.0), Some((110.0, 20.0))));
        assert!(linger.poll(expanded(), false, panel(200.0, 400.0), Some((110.0, 20.0))));
        assert!(!linger.poll(expanded(), false, panel(200.0, 400.0), Some((90.0, 20.0))));
        assert!(!linger.poll(expanded(), false, panel(200.0, 400.0), Some((110.0, 20.0))));

        assert!(linger.poll(expanded(), true, panel(100.0, 600.0), Some((110.0, 20.0))));
        assert!(linger.poll(expanded(), false, panel(200.0, 400.0), Some((110.0, 20.0))));
        assert!(linger.poll(expanded(), true, panel(200.0, 400.0), Some((250.0, 20.0))));
        assert!(!linger.poll(expanded(), false, panel(200.0, 400.0), Some((110.0, 20.0))));
    }

    #[test]
    fn moving_out_of_an_unchanged_panel_still_leaves() {
        let mut linger = HoverLinger::default();
        assert!(linger.poll(expanded(), true, panel(100.0, 600.0), Some((110.0, 20.0))));
        assert!(!linger.poll(expanded(), false, panel(100.0, 600.0), Some((90.0, 20.0))));
    }

    #[test]
    fn a_shrink_while_the_cursor_was_already_outside_does_not_hold() {
        let mut linger = HoverLinger::default();
        assert!(!linger.poll(expanded(), false, panel(100.0, 600.0), Some((110.0, 400.0))));
        assert!(!linger.poll(expanded(), false, panel(200.0, 400.0), Some((110.0, 20.0))));
    }

    #[test]
    fn collapsing_or_tucking_drops_the_hold() {
        let mut linger = HoverLinger::default();
        assert!(linger.poll(expanded(), true, panel(100.0, 600.0), Some((110.0, 20.0))));
        assert!(linger.poll(expanded(), false, panel(200.0, 400.0), Some((110.0, 20.0))));
        let collapsed = IslandWindowState { mode: IslandMode::Collapsed, ..IslandWindowState::default() };
        assert!(!linger.poll(collapsed, false, panel(200.0, 300.0), Some((110.0, 20.0))));
        assert!(!linger.poll(expanded(), false, panel(200.0, 400.0), Some((110.0, 20.0))));

        assert!(linger.poll(expanded(), true, panel(100.0, 600.0), Some((110.0, 20.0))));
        assert!(linger.poll(expanded(), false, panel(200.0, 400.0), Some((110.0, 20.0))));
        let tucked = IslandWindowState { is_tucked: true, ..expanded() };
        assert!(!linger.poll(tucked, false, panel(200.0, 400.0), Some((110.0, 20.0))));
    }
}
