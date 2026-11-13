use tauri::{LogicalSize, PhysicalPosition, Position, Size, WebviewWindow};

use crate::win32;

pub(super) fn place(window: &WebviewWindow) -> Result<(), String> {
    let monitors = window
        .available_monitors()
        .map_err(|error| error.to_string())?;
    let foreground = win32::window::foreground_window();
    let center = if foreground.0.is_null() {
        None
    } else {
        win32::window::window_rect(foreground)
            .map(|rect| ((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2))
    };
    let monitor = monitors
        .into_iter()
        .find(|monitor| {
            center.is_some_and(|(x, y)| {
                let origin = monitor.position();
                let size = monitor.size();
                x >= origin.x
                    && x < origin.x + size.width as i32
                    && y >= origin.y
                    && y < origin.y + size.height as i32
            })
        })
        .or(window
            .primary_monitor()
            .map_err(|error| error.to_string())?)
        .ok_or_else(|| "No monitor is available for translation.".to_string())?;
    let logical_width = 480.0;
    let logical_height =
        (monitor.size().height as f64 / monitor.scale_factor() - 32.0).clamp(380.0, 640.0);
    window
        .set_size(Size::Logical(LogicalSize::new(
            logical_width,
            logical_height,
        )))
        .map_err(|error| error.to_string())?;
    let width = (logical_width * monitor.scale_factor()).round() as i32;
    let height = (logical_height * monitor.scale_factor()).round() as i32;
    let origin = monitor.position();
    window
        .set_position(Position::Physical(PhysicalPosition::new(
            origin.x + (monitor.size().width as i32 - width) / 2,
            origin.y + (monitor.size().height as i32 - height) / 2,
        )))
        .map_err(|error| error.to_string())
}
