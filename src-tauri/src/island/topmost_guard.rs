use std::sync::{Mutex, PoisonError};

use tauri::AppHandle;
use windows::Win32::Foundation::{HWND, RECT};

use crate::win32::{dwm, window, z_order};

const SCAN_LIMIT: usize = 64;
const MAX_STREAK: u32 = 5;

const SHELL_CLASSES: &[&str] = &[
    "Shell_TrayWnd",
    "Shell_SecondaryTrayWnd",
    "Windows.UI.Core.CoreWindow",
    "XamlExplorerHostIslandWindow",
    "MultitaskingViewFrame",
    "TaskSwitcherWnd",
    "ForegroundStaging",
    "NotifyIconOverflowWindow",
    "TopLevelWindowForOverflowXamlIsland",
    "Shell_InputSwitchTopLevelWindow",
    "Xaml_WindowedPopupClass",
    "#32768",
    "tooltips_class32",
    "SysShadow",
    "IME",
    "MSCTFIME UI",
    "Microsoft.IME.UIManager.CandidateWindow.Host",
    "Progman",
    "WorkerW",
];

#[derive(Default)]
struct Streak {
    window: isize,
    count: u32,
}

impl Streak {
    fn allow(&mut self, window: isize) -> bool {
        if self.window == window {
            self.count = self.count.saturating_add(1);
        } else {
            self.window = window;
            self.count = 1;
        }
        self.count <= MAX_STREAK
    }

    fn clear(&mut self) {
        self.window = 0;
        self.count = 0;
    }
}

static STREAK: Mutex<Streak> = Mutex::new(Streak { window: 0, count: 0 });

fn streak<T>(use_it: impl FnOnce(&mut Streak) -> T) -> T {
    use_it(&mut STREAK.lock().unwrap_or_else(PoisonError::into_inner))
}

fn is_shell_class(class: &str) -> bool {
    SHELL_CLASSES.contains(&class)
}

fn overlaps(a: &RECT, b: &RECT) -> bool {
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

fn island_handle(app: &AppHandle) -> Option<HWND> {
    super::main_window(app).ok()?.hwnd().ok()
}

fn covering_window(island: HWND) -> Option<HWND> {
    let area = window::window_rect(island)?;
    let own_process = window::process_id(island);
    let own_class = window::class_name(island);
    z_order::windows_above(island, SCAN_LIMIT).into_iter().find(|&candidate| {
        window::is_visible(candidate)
            && !window::is_minimized(candidate)
            && z_order::is_topmost(candidate)
            && !z_order::is_popup_like(candidate)
            && window::process_id(candidate) != own_process
            && !dwm::is_cloaked(candidate)
            && window::window_rect(candidate).is_some_and(|rect| overlaps(&rect, &area))
            && {
                let class = window::class_name(candidate);
                class != own_class && !is_shell_class(&class)
            }
    })
}

pub(crate) fn check(app: &AppHandle, fullscreen_covers_island: bool) {
    if fullscreen_covers_island || !super::layer::allows_raise() {
        streak(Streak::clear);
        return;
    }
    let Some(island) = island_handle(app) else {
        return;
    };
    if !window::is_visible(island) || window::has_owner(island) {
        streak(Streak::clear);
        return;
    }
    let Some(cover) = covering_window(island) else {
        streak(Streak::clear);
        return;
    };
    if !streak(|streak| streak.allow(cover.0 as isize)) {
        return;
    }
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if !super::layer::allows_raise() {
            return;
        }
        if let Some(island) = island_handle(&handle) {
            if !z_order::set_topmost(island, true) {
                eprintln!("could not put the island back on top of the topmost windows");
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rect(left: i32, top: i32, right: i32, bottom: i32) -> RECT {
        RECT { left, top, right, bottom }
    }

    #[test]
    fn only_windows_that_share_some_area_with_the_island_count_as_covering_it() {
        let island = rect(100, 0, 400, 60);
        assert!(overlaps(&rect(0, 0, 200, 200), &island));
        assert!(overlaps(&rect(150, 10, 160, 20), &island));
        assert!(!overlaps(&rect(400, 0, 500, 60), &island));
        assert!(!overlaps(&rect(100, 60, 400, 120), &island));
    }

    #[test]
    fn the_island_stops_rising_over_a_window_that_keeps_coming_back_on_top() {
        let mut streak = Streak::default();
        for _ in 0..MAX_STREAK {
            assert!(streak.allow(7));
        }
        assert!(!streak.allow(7));
        assert!(streak.allow(8));
        streak.clear();
        assert!(streak.allow(7));
    }

    #[test]
    fn system_shell_surfaces_are_never_pushed_under_the_island() {
        assert!(is_shell_class("Shell_TrayWnd"));
        assert!(is_shell_class("Windows.UI.Core.CoreWindow"));
        assert!(is_shell_class("#32768"));
        assert!(!is_shell_class("ImagePreviewWnd"));
    }
}
