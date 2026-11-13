use std::path::Path;

use super::{CopyAs, PopupLayout};

pub(crate) const WINDOW_LABEL: &str = "clipboard";
pub(super) const OPENED_EVENT: &str = "clipboard-popup-opened";
pub(super) const POINTER_GAP: i32 = 12;
pub(super) fn popup_size(layout: PopupLayout) -> (f64, f64) {
    match layout {
        PopupLayout::Standard => (380.0, 500.0),
        PopupLayout::Wide => (640.0, 500.0),
    }
}

const TERMINAL_PROCESSES: &[&str] = &[
    "windowsterminal.exe",
    "openconsole.exe",
    "conhost.exe",
    "wezterm-gui.exe",
    "alacritty.exe",
    "mintty.exe",
    "tabby.exe",
    "hyper.exe",
    "warp.exe",
    "kitty.exe",
    "ghostty.exe",
    "terminal.app",
    "iterm.app",
    "warp.app",
    "ghostty.app",
    "kitty.app",
    "alacritty.app",
    "wezterm.app",
    "tabby.app",
    "hyper.app",
];

pub(super) fn is_terminal_process(path: &str) -> bool {
    let name = Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    TERMINAL_PROCESSES.contains(&name.as_str())
}

pub(super) fn place_by_pointer(pointer: (i32, i32), size: (i32, i32), area: (i32, i32, i32, i32), gap: i32) -> (i32, i32) {
    let (left, top, right, bottom) = area;
    let mut x = pointer.0 + gap;
    let mut y = pointer.1 + gap;
    if x + size.0 > right {
        x = pointer.0 - gap - size.0;
    }
    if y + size.1 > bottom {
        y = pointer.1 - gap - size.1;
    }
    (x.clamp(left, (right - size.0).max(left)), y.clamp(top, (bottom - size.1).max(top)))
}

#[derive(Debug, Clone, Copy, Default)]
pub(super) struct PasteOptions {
    pub(super) plain: bool,
    pub(super) enter: bool,
    pub(super) copy_as: Option<CopyAs>,
}

#[cfg(test)]
mod tests {
    use super::{is_terminal_process, place_by_pointer};

    #[test]
    fn terminals_are_told_by_their_executable() {
        #[cfg(windows)]
        assert!(is_terminal_process(r"C:\Program Files\WindowsApps\Microsoft.WindowsTerminal\WindowsTerminal.exe"));
        assert!(is_terminal_process("/System/Applications/Utilities/Terminal.app"));
        assert!(is_terminal_process("/Applications/iTerm.app"));
        assert!(!is_terminal_process("/Applications/Safari.app"));
        assert!(is_terminal_process("wezterm-gui.exe"));
        #[cfg(windows)]
        assert!(!is_terminal_process(r"C:\Windows\explorer.exe"));
        assert!(!is_terminal_process(""));
    }

    #[test]
    fn the_popup_stays_on_the_work_area() {
        let area = (0, 0, 1920, 1040);
        assert_eq!(place_by_pointer((100, 100), (380, 480), area, 12), (112, 112));
        assert_eq!(place_by_pointer((1900, 1000), (380, 480), area, 12), (1508, 508));
        assert_eq!(place_by_pointer((10, 10), (2000, 480), area, 12), (0, 22));
    }
}
