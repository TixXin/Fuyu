use std::{thread, time::Duration};

use super::output::Picture;
use super::stitch::{Step, Stitcher};
use crate::win32;

const SETTLE: Duration = Duration::from_millis(220);
const STEP_WAIT: Duration = Duration::from_millis(320);
const WHEEL: i32 = -240;
const MAX_STEPS: usize = 60;
pub(super) const MAX_HEIGHT: u32 = 20_000;

pub(super) fn capture(x: i32, y: i32, width: u32, height: u32) -> Option<Picture> {
    thread::sleep(SETTLE);
    let first = win32::screen_capture::capture(x, y, width, height)?;
    let mut stitcher = Stitcher::new(width, height, first);
    let pointer = win32::window::cursor_position().map(|point| (point.x, point.y));
    let centre = (x + (width / 2) as i32, y + (height / 2) as i32);
    let mut still = 0;
    for _ in 0..MAX_STEPS {
        if win32::input::is_escape_down() || stitcher.height() >= MAX_HEIGHT {
            break;
        }
        win32::input::move_cursor(centre.0, centre.1);
        win32::input::send_wheel(WHEEL);
        thread::sleep(STEP_WAIT);
        if win32::input::is_escape_down() {
            break;
        }
        let Some(frame) = win32::screen_capture::capture(x, y, width, height) else {
            break;
        };
        match stitcher.push(frame) {
            Step::Added(_) => still = 0,
            Step::Unchanged => {
                still += 1;
                if still >= 2 {
                    break;
                }
            }
            Step::Lost => break,
        }
    }
    if let Some((px, py)) = pointer {
        win32::input::move_cursor(px, py);
    }
    let (width, height, mut rgba) = stitcher.finish();
    let height = height.min(MAX_HEIGHT);
    rgba.truncate(width as usize * height as usize * 4);
    Some(Picture { width, height, rgba })
}
