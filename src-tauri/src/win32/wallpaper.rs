use std::sync::OnceLock;

use windows::{
    core::{Result, PCWSTR, PWSTR},
    Win32::{
        Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL},
        UI::{
            Shell::{DesktopWallpaper, IDesktopWallpaper},
            WindowsAndMessaging::{WM_DISPLAYCHANGE, WM_SETTINGCHANGE},
        },
    },
};

use super::{
    com::ComApartment,
    message_window::{self, WindowMessages},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MonitorWallpaper {
    pub(crate) path: String,
    pub(crate) left: i32,
    pub(crate) top: i32,
    pub(crate) right: i32,
    pub(crate) bottom: i32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DesktopWallpapers {
    pub(crate) monitors: Vec<MonitorWallpaper>,
    pub(crate) position: i32,
    pub(crate) background: u32,
}

fn take_string(text: PWSTR) -> String {
    if text.is_null() {
        return String::new();
    }
    let value = unsafe { text.to_string() }.unwrap_or_default();
    unsafe { CoTaskMemFree(Some(text.0 as *const _)) };
    value
}

pub(crate) fn desktop_wallpapers() -> Result<DesktopWallpapers> {
    let _com = ComApartment::multithreaded()?;
    let desktop: IDesktopWallpaper = unsafe { CoCreateInstance(&DesktopWallpaper, None, CLSCTX_ALL) }?;
    let count = unsafe { desktop.GetMonitorDevicePathCount() }?;
    let mut monitors = Vec::new();
    for index in 0..count {
        let Ok(id) = (unsafe { desktop.GetMonitorDevicePathAt(index) }) else {
            continue;
        };
        let rect = unsafe { desktop.GetMonitorRECT(PCWSTR(id.0)) };
        let path = unsafe { desktop.GetWallpaper(PCWSTR(id.0)) }.map(take_string);
        take_string(id);
        if let Ok(rect) = rect {
            if rect.right > rect.left && rect.bottom > rect.top {
                monitors.push(MonitorWallpaper {
                    path: path.unwrap_or_default(),
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                });
            }
        }
    }
    let position = unsafe { desktop.GetPosition() }.map(|position| position.0)?;
    let background = unsafe { desktop.GetBackgroundColor() }.map(|color| color.0)?;
    Ok(DesktopWallpapers { monitors, position, background })
}

static ON_CHANGE: OnceLock<fn()> = OnceLock::new();

struct WallpaperWindow;

impl WindowMessages for WallpaperWindow {
    fn handle(_window: HWND, message: u32, _wparam: WPARAM, _lparam: LPARAM) -> Option<LRESULT> {
        if message == WM_SETTINGCHANGE || message == WM_DISPLAYCHANGE {
            if let Some(on_change) = ON_CHANGE.get() {
                on_change();
            }
        }
        None
    }
}

pub(crate) fn watch_changes(on_change: fn()) -> std::result::Result<(), String> {
    ON_CHANGE.set(on_change).map_err(|_| "Wallpaper changes are already watched.".to_string())?;
    std::thread::Builder::new()
        .name("wallpaper-watch".into())
        .spawn(|| {
            const CLASS_NAME: &str = "FuyuWallpaperWatch";
            let Ok(instance) = message_window::module_instance() else {
                return;
            };
            if message_window::register_class::<WallpaperWindow>(instance, CLASS_NAME).is_err() {
                return;
            }
            if message_window::create_tool_popup_window(instance, CLASS_NAME, "").is_ok() {
                message_window::run_message_loop();
            }
        })
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::desktop_wallpapers;

    #[test]
    #[ignore = "needs an interactive desktop with at least one monitor"]
    fn every_attached_monitor_reports_a_rectangle() {
        let wallpapers = std::thread::spawn(desktop_wallpapers).join().unwrap().unwrap();
        assert!(!wallpapers.monitors.is_empty());
        assert!((0..=5).contains(&wallpapers.position));
    }
}
