use std::time::{Duration, Instant};
use windows::Win32::Foundation::HWND;

use crate::win32;

const POLL: Duration = Duration::from_millis(500);
const SEARCH: Duration = Duration::from_secs(5);

fn step(removed: bool, visible: bool, minimized: bool) -> Option<bool> {
    match (removed, visible && minimized) {
        (false, true) => Some(false),
        (true, false) if visible => Some(true),
        _ => None,
    }
}

#[derive(Default)]
pub(super) struct Keeper {
    window: Option<isize>,
    removed: bool,
    next: Option<Instant>,
    search: Option<Instant>,
}

fn handle(raw: isize) -> HWND {
    HWND(raw as *mut _)
}

fn alive(window: HWND) -> bool {
    win32::process::window_process_id(window) != 0
}

impl Keeper {
    pub(super) fn tick(&mut self, on: bool, find: impl FnOnce() -> Option<HWND>) {
        if !on {
            self.restore();
            return;
        }
        let now = Instant::now();
        if self.next.is_some_and(|at| now < at) {
            return;
        }
        self.next = Some(now + POLL);
        let window = match self.window.map(handle).filter(|window| alive(*window)) {
            Some(window) => window,
            None => {
                self.removed = false;
                if self.search.is_some_and(|at| now < at) {
                    return;
                }
                self.search = Some(now + SEARCH);
                let Some(window) = find() else {
                    self.window = None;
                    return;
                };
                self.window = Some(window.0 as isize);
                window
            }
        };
        let visible = win32::window::is_visible(window);
        let minimized = win32::window::is_minimized(window);
        if let Some(shown) = step(self.removed, visible, minimized) {
            if win32::taskbar::set_button(window, shown) {
                self.removed = !shown;
            }
        }
    }

    pub(super) fn restore(&mut self) {
        if let Some(window) = self.window.map(handle) {
            if self.removed && alive(window) && win32::window::is_visible(window) {
                win32::taskbar::set_button(window, true);
            }
        }
        self.removed = false;
    }
}

#[cfg(test)]
mod tests {
    use super::step;

    #[test]
    fn minimized_leaves_the_taskbar_and_comes_back_once_restored() {
        assert_eq!(step(false, true, true), Some(false));
        assert_eq!(step(true, true, true), None);
        assert_eq!(step(true, true, false), Some(true));
        assert_eq!(step(false, true, false), None);
        assert_eq!(step(true, false, false), None);
        assert_eq!(step(false, false, false), None);
    }
}
