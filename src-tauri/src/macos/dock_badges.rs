use std::{
    process::Command,
    time::{Duration, Instant},
};

use objc2_app_kit::{NSRunningApplication, NSWorkspace};
use objc2_foundation::NSString;

use super::accessibility::{self, Element};

const DOCK: &str = "com.apple.dock";
const POLL: Duration = Duration::from_secs(3);
const TICK: Duration = Duration::from_secs(1);
const PRIVACY_PAGE: &str = "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Badge {
    NotAllowed,
    NotInDock,
    Label(Option<String>),
}

fn app_path(bundle_id: &str) -> Option<String> {
    let url = NSWorkspace::sharedWorkspace().URLForApplicationWithBundleIdentifier(&NSString::from_str(bundle_id))?;
    Some(url.path()?.to_string())
}

fn same_path(a: &str, b: &str) -> bool {
    a.trim_end_matches('/') == b.trim_end_matches('/')
}

pub(crate) fn badge(bundle_id: &str) -> Badge {
    if !accessibility::is_trusted() {
        return Badge::NotAllowed;
    }
    let Some(path) = app_path(bundle_id) else {
        return Badge::NotInDock;
    };
    let dock = NSRunningApplication::runningApplicationsWithBundleIdentifier(&NSString::from_str(DOCK));
    let Some(dock) = dock.iter().next().and_then(|dock| Element::application(dock.processIdentifier())) else {
        return Badge::NotInDock;
    };
    for list in dock.children() {
        for item in list.children() {
            if item.url_path("AXURL").is_some_and(|url| same_path(&url, &path)) {
                return Badge::Label(item.text("AXStatusLabel").map(|label| label.trim().to_string()).filter(|label| !label.is_empty()));
            }
        }
    }
    Badge::NotInDock
}

pub(crate) fn watch(bundle_id: &str, wait: impl Fn(Duration) -> bool, mut changed: impl FnMut(Badge), mut each_tick: impl FnMut()) {
    let mut last: Option<Badge> = None;
    let mut read_at: Option<Instant> = None;
    loop {
        if read_at.is_none_or(|at| at.elapsed() >= POLL) {
            read_at = Some(Instant::now());
            let reading = badge(bundle_id);
            if last.as_ref() != Some(&reading) {
                last = Some(reading.clone());
                changed(reading);
            }
        }
        each_tick();
        if wait(TICK) {
            return;
        }
    }
}

pub(crate) fn open_app(bundle_id: &str) -> Result<(), String> {
    let status = Command::new("/usr/bin/open").arg("-b").arg(bundle_id).status().map_err(|error| error.to_string())?;
    if status.success() { Ok(()) } else { Err(format!("Could not open {bundle_id}.")) }
}

pub(crate) fn open_accessibility_settings() -> Result<(), String> {
    tauri_plugin_opener::open_url(PRIVACY_PAGE, None::<&str>).map_err(|error| error.to_string())
}

pub(crate) fn unread(label: &str) -> u32 {
    let digits: String = label.chars().filter(char::is_ascii_digit).collect();
    digits.parse().unwrap_or(1).max(1)
}

#[cfg(test)]
mod tests {
    use super::{same_path, unread};

    #[test]
    fn badge_labels_become_unread_counts() {
        assert_eq!(unread("7"), 7);
        assert_eq!(unread("99+"), 99);
        assert_eq!(unread("•"), 1);
        assert!(same_path("/Applications/WeChat.app/", "/Applications/WeChat.app"));
    }
}
