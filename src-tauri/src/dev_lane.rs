//! Lane previews (`pnpm dev:lane`, scripts/dev-lane.mjs): a debug build run from
//! an agent's lane next to the user's own island. It gets its own identifier,
//! so its data folder, WebView storage and single-instance lock are separate,
//! and it leaves alone what is shared by the whole Windows account: the
//! focusd:// link handler, launch at startup, and the AI agents' status hooks.
//! Release builds ignore the environment variable.

const ENV: &str = "FOCUSD_DEV_LANE";
/// Set by `pnpm dev:lane:center` (`--center`): the preview sits where the real island does.
const CENTER_ENV: &str = "FOCUSD_DEV_LANE_CENTER";

/// The lane number when this debug build runs as a lane preview.
pub(crate) fn lane() -> Option<u32> {
    if !cfg!(debug_assertions) {
        return None;
    }
    std::env::var(ENV).ok()?.parse().ok().filter(|lane| (1..=999).contains(lane))
}

/// The app identifier of lane `lane`'s preview, e.g. `com.tixxin.fuyu.lane-2`.
pub(crate) fn identifier(lane: u32) -> String {
    format!("com.tixxin.fuyu.lane-{lane}")
}

/// Whether a preview asked to sit at the top centre, like the real island.
fn centred_preview() -> bool {
    std::env::var(CENTER_ENV).is_ok_and(|value| value == "1")
}

/// The island's default left edge on a monitor: centred, or for a preview
/// centred on the left quarter so it does not sit on top of the user's island
/// (unless it was started with `--center`).
pub(crate) fn stage_x(monitor_x: i32, monitor_width: i32, window_width: i32) -> i32 {
    left_edge(lane().is_some() && !centred_preview(), monitor_x, monitor_width, window_width)
}

fn left_edge(beside: bool, monitor_x: i32, monitor_width: i32, window_width: i32) -> i32 {
    if beside {
        monitor_x + (monitor_width / 4 - window_width / 2).max(0)
    } else {
        monitor_x + (monitor_width - window_width) / 2
    }
}

/// Refuses an action that would change the user's own setup from a preview.
pub(crate) fn refuse_in_preview(action: &str) -> Result<(), String> {
    match lane() {
        Some(lane) => Err(format!("This is the preview of lane {lane}; it does not {action}. Use your own island for that.")),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::{identifier, left_edge, stage_x};

    #[test]
    fn the_island_is_centred_on_its_monitor_outside_a_preview() {
        // Tests run without FOCUSD_DEV_LANE: the user's own placement.
        assert_eq!(stage_x(0, 2560, 760), 900);
        assert_eq!(stage_x(-1920, 1920, 760), -1920 + 580);
        assert_eq!(stage_x(0, 2561, 760), 900, "the same rounding as before");
    }

    #[test]
    fn a_preview_sits_on_the_left_quarter_unless_centred() {
        assert_eq!(left_edge(true, 0, 2560, 760), 260);
        assert_eq!(left_edge(true, 0, 1000, 760), 0, "never off the monitor's left edge");
        assert_eq!(left_edge(false, 0, 2560, 760), 900);
    }

    #[test]
    fn each_lane_gets_its_own_identifier() {
        assert_eq!(identifier(2), "com.tixxin.fuyu.lane-2");
        assert_ne!(identifier(2), identifier(12));
    }
}
