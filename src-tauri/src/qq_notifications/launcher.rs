use crate::messenger_activation::{activate_window, is_interactive_window};
use crate::user_error::UserError;
use crate::win32::{self, process, registry};
use std::{
    path::{Path, PathBuf},
    thread,
    time::{Duration, Instant},
};
use windows::Win32::{
    Foundation::HWND,
    System::Registry::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE},
    UI::WindowsAndMessaging::{WM_APP, WM_LBUTTONDBLCLK, WM_LBUTTONDOWN, WM_LBUTTONUP},
};

pub(super) fn qq_executable() -> Result<PathBuf, UserError> {
    for root in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        for key in [
            "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\QQ",
            "Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\QQ",
        ] {
            if let Some(icon) = registry::read_string(root, key, "DisplayIcon") {
                let path = PathBuf::from(registry::display_icon_path(&icon));
                if path.is_absolute()
                    && path.is_file()
                    && path
                        .file_name()
                        .is_some_and(|name| name.to_string_lossy().eq_ignore_ascii_case("QQ.exe"))
                {
                    return Ok(path);
                }
            }
        }
    }
    process::running_executable(&["QQ.exe"])
        .map(PathBuf::from)
        .ok_or_else(|| UserError::new("qq.notInstalled", "QQ installation path was not found. Open QQ first and try again."))
}

pub(super) struct QQWindowSearch<'a> {
    executable: &'a Path,
    pub(super) windows: Vec<QQWindow>,
    tray_windows: Vec<(HWND, u32)>,
    running: bool,
}

pub(super) struct QQWindow {
    pub(super) handle: HWND,
    pub(super) process_id: u32,
    pub(super) visible: bool,
    pub(super) area: i64,
}

pub(super) fn preferred_qq_window(windows: &[QQWindow], foreground: HWND) -> Option<&QQWindow> {
    windows.iter().max_by_key(|window| {
        (
            window.visible && window.handle == foreground,
            window.visible,
            window.area,
        )
    })
}

fn find_qq_window(search: &mut QQWindowSearch<'_>, window: HWND) {
    let process_id = process::window_process_id(window);
    if let Some(path) = process::image_path(process_id) {
        if !path.eq_ignore_ascii_case(&search.executable.to_string_lossy()) {
            return;
        }
        search.running = true;
        let title = win32::window::window_text(window, 32);
        let class = win32::window::class_name(window);
        if class == "Electron_NotifyIconHostWindow" {
            search.tray_windows.push((window, process_id));
            return;
        }
        if title != "QQ" || !["Chrome_WidgetWin_1", "TXGuiFoundation"].contains(&class.as_str()) {
            return;
        }
        if win32::window::has_owner(window) {
            return;
        }
        let Some(normal_position) = win32::window::normal_position(window) else {
            return;
        };
        let width = normal_position.right - normal_position.left;
        let height = normal_position.bottom - normal_position.top;
        if width >= 500 && height >= 300 {
            search.windows.push(QQWindow {
                handle: window,
                process_id,
                visible: win32::window::is_visible(window),
                area: i64::from(width) * i64::from(height),
            });
        }
    }
}

pub(super) fn existing_qq_windows(executable: &Path) -> Result<QQWindowSearch<'_>, UserError> {
    let mut search = QQWindowSearch {
        executable,
        windows: Vec::new(),
        tray_windows: Vec::new(),
        running: false,
    };
    win32::window::for_each_top_level_window(|window| find_qq_window(&mut search, window))
        .map_err(|error| UserError::new("qq.findWindow", "Could not look up running QQ windows.").detail(error))?;
    Ok(search)
}

pub(super) fn activate_existing_qq(executable: &Path) -> Result<(), UserError> {
    let search = existing_qq_windows(executable)?;
    let original = preferred_qq_window(&search.windows, win32::window::foreground_window())
        .ok_or_else(|| {
            if search.running {
                UserError::new("qq.noMainWindow", "QQ is running, but no main window was found; open QQ from the system tray.")
            } else {
                UserError::new("qq.notRunning", "No running QQ window was found; open and sign in to desktop QQ first.")
            }
        })?;
    let expected_process = original.process_id;
    win32::window::allow_set_foreground_window(expected_process);
    let mut trays = search
        .tray_windows
        .iter()
        .filter(|(_, process_id)| *process_id == expected_process);
    let tray = trays
        .next()
        .ok_or_else(|| UserError::new("qq.noTrayEntry", "Could not find QQ's tray entry; double-click the QQ icon in the system tray."))?;
    if trays.next().is_some() {
        return Err(UserError::new("qq.multipleTrays", "QQ has multiple tray entries; open QQ from the system tray."));
    }
    let mut icon_id = None;
    let lookup_deadline = Instant::now() + Duration::from_secs(1);
    for id in 2..=256 {
        if Instant::now() >= lookup_deadline {
            return Err(UserError::new("qq.trayTimeout", "Looking up the QQ tray icon timed out; open QQ from the system tray."));
        }
        if win32::window::notify_icon_exists(tray.0, id) && icon_id.replace(id).is_some() {
            return Err(UserError::new("qq.multipleTrayIcons", "QQ has multiple tray icons; double-click the QQ icon in the system tray."));
        }
    }
    let icon_id = icon_id
        .ok_or_else(|| UserError::new("qq.trayNotReady", "The QQ tray icon is not ready yet; open QQ from the system tray."))?;
    for message in [WM_LBUTTONDOWN, WM_LBUTTONUP, WM_LBUTTONDBLCLK, WM_LBUTTONUP] {
        if !win32::window::send_message_with_timeout(
            tray.0,
            WM_APP + 1,
            icon_id as usize,
            message as isize,
            1_000,
        ) {
            return Err(UserError::new("qq.trayNoResponse", "QQ did not respond to the tray activation request; open it from the system tray."));
        }
    }
    let deadline = Instant::now() + Duration::from_secs(3);
    while Instant::now() < deadline {
        let current = existing_qq_windows(executable)?;
        if let Some(window) =
            preferred_qq_window(&current.windows, win32::window::foreground_window())
        {
            if window.process_id == expected_process && is_interactive_window(window.handle) {
                return activate_window(window.handle, "QQ");
            }
        }
        thread::sleep(Duration::from_millis(50));
    }
    Err(UserError::new("qq.restoreFailed", "QQ did not restore an interactive main window; double-click the QQ icon in the system tray."))
}
