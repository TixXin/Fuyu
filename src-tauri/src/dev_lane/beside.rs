use std::{
    sync::{Mutex, PoisonError},
    thread,
    time::Duration,
};

use tauri::WebviewWindow;

const LOOK_EVERY: Duration = Duration::from_secs(3);
const WIDTH_TOLERANCE: f64 = 2.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct Rect {
    pub(super) left: i32,
    pub(super) top: i32,
    pub(super) width: i32,
    pub(super) height: i32,
}

impl Rect {
    fn overlaps(&self, other: &Rect) -> bool {
        self.left < other.left + other.width
            && other.left < self.left + self.width
            && self.top < other.top + other.height
            && other.top < self.top + self.height
    }
}

#[derive(Debug, Clone, PartialEq)]
pub(super) enum Installed {
    Absent,
    Hidden,
    Shown(Vec<Rect>),
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct Stage {
    centred: Rect,
    logical_width: f64,
}

struct Seen {
    stage: Option<Stage>,
    installed: Option<Installed>,
}

static SEEN: Mutex<Seen> = Mutex::new(Seen { stage: None, installed: None });

pub(super) fn steps_aside(installed: &Installed, centred: &Rect) -> bool {
    match installed {
        Installed::Absent => false,
        Installed::Hidden => true,
        Installed::Shown(stages) => stages.iter().any(|stage| stage.overlaps(centred)),
    }
}

pub(super) fn is_stage(width: i32, scale: f64, logical_width: f64) -> bool {
    scale > 0.0 && (f64::from(width) / scale - logical_width).abs() <= WIDTH_TOLERANCE
}

pub(super) fn decide(centred: Rect, scale: f64) -> bool {
    let logical_width = if scale > 0.0 { f64::from(centred.width) / scale } else { f64::from(centred.width) };
    let stage = Stage { centred, logical_width };
    let mut seen = SEEN.lock().unwrap_or_else(PoisonError::into_inner);
    seen.stage = Some(stage);
    let installed = seen.installed.get_or_insert_with(|| look(logical_width)).clone();
    steps_aside(&installed, &centred)
}

pub(super) fn start_watch(window: WebviewWindow) {
    let _ = thread::Builder::new().name("dev-lane-beside".into()).spawn(move || loop {
        thread::sleep(LOOK_EVERY);
        let Some(stage) = SEEN.lock().unwrap_or_else(PoisonError::into_inner).stage else {
            continue;
        };
        let installed = look(stage.logical_width);
        let changed = {
            let mut seen = SEEN.lock().unwrap_or_else(PoisonError::into_inner);
            let before = seen.installed.as_ref().map(|old| steps_aside(old, &stage.centred));
            seen.installed = Some(installed.clone());
            before != Some(steps_aside(&installed, &stage.centred))
        };
        if changed {
            if let Err(error) = crate::island::refit(&window) {
                eprintln!("Failed to move the development island beside the installed one: {error}");
            }
        }
    });
}

fn look(logical_width: f64) -> Installed {
    if !installed_running() {
        return Installed::Absent;
    }
    let Some(pid) = crate::home_dir::installed_island_pid() else {
        return Installed::Hidden;
    };
    let stages: Vec<Rect> = shown_windows(pid)
        .into_iter()
        .filter(|(rect, scale)| is_stage(rect.width, *scale, logical_width))
        .map(|(rect, _)| rect)
        .collect();
    if stages.is_empty() {
        Installed::Hidden
    } else {
        Installed::Shown(stages)
    }
}

#[cfg(target_os = "windows")]
fn installed_running() -> bool {
    crate::win32::sibling_island::mutex_exists(&format!("{}-sim", crate::rename_migration::NEW_IDENTIFIER))
}

#[cfg(target_os = "macos")]
fn installed_running() -> bool {
    let socket = format!("/tmp/{}_si.sock", crate::rename_migration::NEW_IDENTIFIER.replace(['.', '-'], "_"));
    std::path::Path::new(&socket).exists() && crate::home_dir::installed_island_pid().is_some()
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn installed_running() -> bool {
    false
}

#[cfg(target_os = "windows")]
fn shown_windows(pid: u32) -> Vec<(Rect, f64)> {
    crate::win32::sibling_island::shown_windows_of(pid)
        .into_iter()
        .map(|window| (Rect { left: window.left, top: window.top, width: window.width, height: window.height }, window.scale))
        .collect()
}

#[cfg(target_os = "macos")]
fn shown_windows(pid: u32) -> Vec<(Rect, f64)> {
    crate::macos::sibling_island::shown_windows_of(pid)
        .into_iter()
        .map(|area| {
            let rect = Rect { left: area.x.round() as i32, top: area.y.round() as i32, width: area.width.round() as i32, height: area.height.round() as i32 };
            (rect, 1.0)
        })
        .collect()
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn shown_windows(_pid: u32) -> Vec<(Rect, f64)> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::{is_stage, steps_aside, Installed, Rect};

    const CENTRED: Rect = Rect { left: 870, top: 0, width: 820, height: 460 };

    #[test]
    fn with_no_installed_island_the_preview_stays_in_the_middle() {
        assert!(!steps_aside(&Installed::Absent, &CENTRED));
    }

    #[test]
    fn an_installed_island_in_the_same_spot_sends_the_preview_aside() {
        assert!(steps_aside(&Installed::Shown(vec![CENTRED]), &CENTRED));
        let nudged = Rect { left: 1200, top: 30, ..CENTRED };
        assert!(steps_aside(&Installed::Shown(vec![nudged]), &CENTRED));
    }

    #[test]
    fn an_installed_island_elsewhere_leaves_the_middle_free() {
        let other_monitor = Rect { left: -1690, ..CENTRED };
        let lower = Rect { top: 600, ..CENTRED };
        let touching = Rect { left: CENTRED.left + CENTRED.width, ..CENTRED };
        assert!(!steps_aside(&Installed::Shown(vec![other_monitor, lower, touching]), &CENTRED));
    }

    #[test]
    fn an_installed_island_that_runs_unseen_still_sends_the_preview_aside() {
        assert!(steps_aside(&Installed::Hidden, &CENTRED));
    }

    #[test]
    fn only_a_stage_wide_window_counts_as_the_installed_island() {
        assert!(is_stage(820, 1.0, 820.0));
        assert!(is_stage(1230, 1.5, 820.0));
        assert!(is_stage(1641, 2.0, 820.0));
        assert!(!is_stage(1100, 1.0, 820.0));
        assert!(!is_stage(820, 0.0, 820.0));
    }
}
