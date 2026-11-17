use std::time::Duration;
use tauri::WebviewWindow;

pub(super) const FOLLOW_INTERVAL: Duration = Duration::from_millis(300);

#[derive(Default)]
pub(super) struct MonitorFollower;

impl MonitorFollower {
    pub(super) fn poll(&mut self, _window: &WebviewWindow) {}

    pub(super) fn reset(&mut self) {}
}
