use tauri::{LogicalSize, Monitor, PhysicalPosition, Size, WebviewWindow};

use crate::island::screen;

const WIDTH: f64 = 480.0;

fn contains(monitor: &Monitor, (x, y): (f64, f64)) -> bool {
    let origin = screen::monitor_origin(monitor);
    let size = screen::monitor_size(monitor);
    x >= f64::from(origin.x) && x < f64::from(origin.x) + f64::from(size.width) && y >= f64::from(origin.y) && y < f64::from(origin.y) + f64::from(size.height)
}

pub(super) fn centered(origin: (i32, i32), size: (u32, u32)) -> ((f64, f64), PhysicalPosition<i32>) {
    let height = (f64::from(size.1) - 32.0).clamp(380.0, 640.0);
    let x = origin.0 + ((f64::from(size.0) - WIDTH) / 2.0).round() as i32;
    let y = origin.1 + ((f64::from(size.1) - height) / 2.0).round() as i32;
    ((WIDTH, height), PhysicalPosition::new(x, y))
}

pub(super) fn place(window: &WebviewWindow) -> Result<(), String> {
    let cursor = screen::cursor_position();
    let monitors = window.available_monitors().map_err(|error| error.to_string())?;
    let monitor = monitors
        .into_iter()
        .find(|monitor| cursor.is_some_and(|point| contains(monitor, point)))
        .or(window.primary_monitor().map_err(|error| error.to_string())?)
        .ok_or_else(|| "No monitor is available for translation.".to_string())?;
    let origin = screen::monitor_origin(&monitor);
    let size = screen::monitor_size(&monitor);
    let ((width, height), position) = centered((origin.x, origin.y), (size.width, size.height));
    window.set_size(Size::Logical(LogicalSize::new(width, height))).map_err(|error| error.to_string())?;
    screen::set_window_position(window, position)
}

#[cfg(test)]
mod tests {
    use super::centered;
    use tauri::PhysicalPosition;

    #[test]
    fn the_window_sits_in_the_middle_of_the_display_with_the_cursor() {
        assert_eq!(centered((0, 0), (1710, 1107)), ((480.0, 640.0), PhysicalPosition::new(615, 234)));
        assert_eq!(centered((1710, -200), (1280, 400)), ((480.0, 380.0), PhysicalPosition::new(2110, -190)));
    }
}
