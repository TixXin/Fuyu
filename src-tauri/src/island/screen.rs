use tauri::{Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};
#[cfg(not(target_os = "macos"))]
use tauri::Position;
#[cfg(target_os = "macos")]
use tauri::{LogicalPosition, Position};

#[cfg(not(target_os = "macos"))]
pub(crate) fn monitor_origin(monitor: &Monitor) -> PhysicalPosition<i32> {
    *monitor.position()
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn monitor_size(monitor: &Monitor) -> PhysicalSize<u32> {
    *monitor.size()
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn monitor_work_top(monitor: &Monitor) -> i32 {
    monitor.work_area().position.y
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn monitor_work_rect(monitor: &Monitor) -> (i32, i32, i32, i32) {
    let area = monitor.work_area();
    (area.position.x, area.position.y, area.size.width as i32, area.size.height as i32)
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn monitor_scale(monitor: &Monitor) -> f64 {
    monitor.scale_factor()
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn window_position(window: &WebviewWindow) -> Result<PhysicalPosition<i32>, String> {
    window.outer_position().map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn window_scale(window: &WebviewWindow) -> Result<f64, String> {
    window.scale_factor().map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn set_window_position(window: &WebviewWindow, position: PhysicalPosition<i32>) -> Result<(), String> {
    window.set_position(Position::Physical(position)).map_err(|error| error.to_string())
}

#[cfg(windows)]
pub(crate) fn cursor_position() -> Option<(f64, f64)> {
    crate::win32::window::cursor_position().map(|cursor| (f64::from(cursor.x), f64::from(cursor.y)))
}

#[cfg(target_os = "macos")]
fn in_points(position: PhysicalPosition<i32>, scale: f64) -> PhysicalPosition<i32> {
    let logical = position.to_logical::<f64>(scale);
    PhysicalPosition::new(logical.x.round() as i32, logical.y.round() as i32)
}

#[cfg(target_os = "macos")]
fn size_in_points(size: PhysicalSize<u32>, scale: f64) -> PhysicalSize<u32> {
    let logical = size.to_logical::<f64>(scale);
    PhysicalSize::new(logical.width.round() as u32, logical.height.round() as u32)
}

#[cfg(target_os = "macos")]
pub(crate) fn monitor_origin(monitor: &Monitor) -> PhysicalPosition<i32> {
    in_points(*monitor.position(), monitor.scale_factor())
}

#[cfg(target_os = "macos")]
pub(crate) fn monitor_size(monitor: &Monitor) -> PhysicalSize<u32> {
    size_in_points(*monitor.size(), monitor.scale_factor())
}

#[cfg(target_os = "macos")]
pub(crate) fn monitor_work_top(monitor: &Monitor) -> i32 {
    in_points(monitor.work_area().position, monitor.scale_factor()).y
}

#[cfg(target_os = "macos")]
pub(crate) fn monitor_work_rect(monitor: &Monitor) -> (i32, i32, i32, i32) {
    let area = monitor.work_area();
    let position = in_points(area.position, monitor.scale_factor());
    let size = size_in_points(area.size, monitor.scale_factor());
    (position.x, position.y, size.width as i32, size.height as i32)
}

#[cfg(target_os = "macos")]
pub(crate) fn monitor_scale(_monitor: &Monitor) -> f64 {
    1.0
}

#[cfg(target_os = "macos")]
pub(crate) fn window_position(window: &WebviewWindow) -> Result<PhysicalPosition<i32>, String> {
    let position = window.outer_position().map_err(|error| error.to_string())?;
    Ok(in_points(position, window.scale_factor().map_err(|error| error.to_string())?))
}

#[cfg(target_os = "macos")]
pub(crate) fn window_size(window: &WebviewWindow) -> Result<PhysicalSize<u32>, String> {
    let size = window.outer_size().map_err(|error| error.to_string())?;
    Ok(size_in_points(size, window.scale_factor().map_err(|error| error.to_string())?))
}

#[cfg(target_os = "macos")]
pub(crate) fn window_scale(_window: &WebviewWindow) -> Result<f64, String> {
    Ok(1.0)
}

#[cfg(target_os = "macos")]
pub(crate) fn set_window_position(window: &WebviewWindow, position: PhysicalPosition<i32>) -> Result<(), String> {
    let logical = LogicalPosition::new(f64::from(position.x), f64::from(position.y));
    window.set_position(Position::Logical(logical)).map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
pub(crate) fn cursor_position() -> Option<(f64, f64)> {
    Some(crate::macos::input::cursor_point())
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::{in_points, size_in_points};
    use tauri::{PhysicalPosition, PhysicalSize};

    #[test]
    fn each_display_converts_back_to_points_with_its_own_scale() {
        assert_eq!(in_points(PhysicalPosition::new(0, 66), 2.0), PhysicalPosition::new(0, 33));
        assert_eq!(in_points(PhysicalPosition::new(1710, 0), 1.0), PhysicalPosition::new(1710, 0));
        assert_eq!(in_points(PhysicalPosition::new(-3840, -2160), 2.0), PhysicalPosition::new(-1920, -1080));
        assert_eq!(size_in_points(PhysicalSize::new(3420, 2214), 2.0), PhysicalSize::new(1710, 1107));
    }
}
