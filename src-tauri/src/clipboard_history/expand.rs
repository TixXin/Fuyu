use std::sync::Mutex;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Size};

use super::popup_place::{popup_size, WINDOW_LABEL};
use super::service;

const EXPANDED_SIZE: (f64, f64) = (960.0, 680.0);
const SCREEN_MARGIN: f64 = 24.0;

static POSITION_BEFORE: Mutex<Option<(i32, i32)>> = Mutex::new(None);

type Area = (i32, i32, i32, i32);

#[tauri::command]
pub async fn set_clipboard_popup_expanded(app: AppHandle, expanded: bool) -> Result<(), String> {
    let window = app.get_webview_window(WINDOW_LABEL).ok_or_else(|| "The clipboard window is missing.".to_string())?;
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or_else(|| "No screen to place the clipboard window on.".to_string())?;
    let work = monitor.work_area();
    let area = (work.position.x, work.position.y, work.size.width as i32, work.size.height as i32);
    let scale = monitor.scale_factor();
    let current = window.outer_position().ok().map(|position| (position.x, position.y));
    let remembered = POSITION_BEFORE.lock().ok().and_then(|mut slot| if expanded { slot.clone_from(&current); None } else { slot.take() });
    super::preview_window::hide(&app, false);
    let ((x, y), (width, height)) = if expanded {
        expanded_frame(area, scale)
    } else {
        let (width, height) = popup_size(service()?.snapshot()?.settings.popup_layout);
        let size = ((width * scale).round() as i32, (height * scale).round() as i32);
        let start = remembered.or(current).unwrap_or((area.0, area.1));
        (kept_inside(area, start, size), size)
    };
    window
        .set_size(Size::Physical(PhysicalSize::new(width.max(1) as u32, height.max(1) as u32)))
        .map_err(|error| error.to_string())?;
    window.set_position(Position::Physical(PhysicalPosition::new(x, y))).map_err(|error| error.to_string())
}

fn expanded_frame(area: Area, scale: f64) -> ((i32, i32), (i32, i32)) {
    let margin = (SCREEN_MARGIN * scale).round() as i32;
    let width = ((EXPANDED_SIZE.0 * scale).round() as i32).min(area.2 - 2 * margin).max(1);
    let height = ((EXPANDED_SIZE.1 * scale).round() as i32).min(area.3 - 2 * margin).max(1);
    ((area.0 + (area.2 - width) / 2, area.1 + (area.3 - height) / 2), (width, height))
}

fn kept_inside(area: Area, (x, y): (i32, i32), (width, height): (i32, i32)) -> (i32, i32) {
    let x = x.min(area.0 + area.2 - width).max(area.0);
    let y = y.min(area.1 + area.3 - height).max(area.1);
    (x, y)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_expanded_window_is_centered_and_fits_small_screens() {
        assert_eq!(expanded_frame((0, 0, 1920, 1040), 1.0), ((480, 180), (960, 680)));
        assert_eq!(expanded_frame((100, 0, 1920, 1040), 2.0), ((148, 48), (1824, 944)));
        assert_eq!(expanded_frame((0, 0, 800, 600), 1.0), ((24, 24), (752, 552)));
    }

    #[test]
    fn the_shrunk_window_goes_back_inside_the_screen() {
        assert_eq!(kept_inside((0, 0, 1920, 1040), (300, 200), (380, 559)), (300, 200));
        assert_eq!(kept_inside((0, 0, 1920, 1040), (1800, 900), (380, 559)), (1540, 481));
        assert_eq!(kept_inside((-1920, 0, 1920, 1040), (-2000, -5), (380, 559)), (-1920, 0));
    }
}
