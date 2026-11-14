use windows::{
    core::BOOL,
    Win32::{
        Foundation::{LPARAM, RECT},
        Graphics::Gdi::{EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFO, MONITORINFOEXW},
        UI::{
            HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI},
            WindowsAndMessaging::MONITORINFOF_PRIMARY,
        },
    },
};

use super::Bounds;

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Screen {
    pub id: String,
    pub bounds: Bounds,
    pub work_area: Bounds,
    pub scale: f64,
    pub primary: bool,
}

fn describe(monitor: HMONITOR) -> Option<Screen> {
    let mut info = MONITORINFOEXW { monitorInfo: MONITORINFO { cbSize: std::mem::size_of::<MONITORINFOEXW>() as u32, ..Default::default() }, ..Default::default() };
    if !unsafe { GetMonitorInfoW(monitor, std::ptr::from_mut(&mut info).cast()) }.as_bool() {
        return None;
    }
    let (mut dpi_x, mut dpi_y) = (96u32, 96u32);
    let _ = unsafe { GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut dpi_x, &mut dpi_y) };
    let length = info.szDevice.iter().position(|unit| *unit == 0).unwrap_or(info.szDevice.len());
    Some(Screen {
        id: String::from_utf16_lossy(&info.szDevice[..length]),
        bounds: Bounds::from_rect(info.monitorInfo.rcMonitor),
        work_area: Bounds::from_rect(info.monitorInfo.rcWork),
        scale: f64::from(dpi_x.max(96)) / 96.0,
        primary: info.monitorInfo.dwFlags & MONITORINFOF_PRIMARY != 0,
    })
}

unsafe extern "system" fn visit(monitor: HMONITOR, _: HDC, _: *mut RECT, data: LPARAM) -> BOOL {
    if let Some(found) = unsafe { (data.0 as *mut Vec<Screen>).as_mut() } {
        if let Some(screen) = describe(monitor) {
            found.push(screen);
        }
    }
    BOOL::from(true)
}

pub(crate) fn screens() -> Vec<Screen> {
    let mut found: Vec<Screen> = Vec::new();
    let _ = unsafe { EnumDisplayMonitors(None, None, Some(visit), LPARAM(std::ptr::from_mut(&mut found) as isize)) };
    found
}
