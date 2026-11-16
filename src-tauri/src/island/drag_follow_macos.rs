use super::screen;
use tauri::{PhysicalPosition, WebviewWindow};

pub(super) struct DragFollow {
    grab: (f64, f64),
    last: PhysicalPosition<i32>,
}

impl DragFollow {
    pub(super) fn start(window: &WebviewWindow) -> Result<Self, String> {
        let position = screen::window_position(window)?;
        let cursor = screen::cursor_position().ok_or_else(|| "Could not read the cursor position.".to_string())?;
        Ok(Self { grab: grab_offset(cursor, position), last: position })
    }

    pub(super) fn poll(&mut self, window: &WebviewWindow) {
        let Some(cursor) = screen::cursor_position() else {
            return;
        };
        let next = follow_cursor(cursor, self.grab);
        if next != self.last && screen::set_window_position(window, next).is_ok() {
            self.last = next;
        }
    }
}

fn grab_offset(cursor: (f64, f64), window: PhysicalPosition<i32>) -> (f64, f64) {
    (cursor.0 - f64::from(window.x), cursor.1 - f64::from(window.y))
}

fn follow_cursor(cursor: (f64, f64), grab: (f64, f64)) -> PhysicalPosition<i32> {
    PhysicalPosition::new((cursor.0 - grab.0).round() as i32, (cursor.1 - grab.1).round() as i32)
}

#[cfg(test)]
mod tests {
    use super::{follow_cursor, grab_offset};
    use tauri::PhysicalPosition;

    #[test]
    fn the_window_keeps_the_point_under_the_cursor_where_it_was_grabbed() {
        let grab = grab_offset((520.5, 40.0), PhysicalPosition::new(300, 0));
        assert_eq!(follow_cursor((520.5, 40.0), grab), PhysicalPosition::new(300, 0));
        assert_eq!(follow_cursor((700.2, 12.0), grab), PhysicalPosition::new(480, -28));
        assert_eq!(follow_cursor((-100.0, 900.0), grab), PhysicalPosition::new(-321, 860));
    }
}
