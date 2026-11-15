use super::harness::{Harness, ScanRoots};
use super::sessions::AgentSessionSummary;

pub(super) const PROVIDER: &str = "opencode";

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: None,
    status_light: None,
    sessions: Some(sessions),
    remote: None,
};

fn sessions(_roots: &ScanRoots, _now: i64, _window_ms: i64) -> Vec<AgentSessionSummary> {
    Vec::new()
}
