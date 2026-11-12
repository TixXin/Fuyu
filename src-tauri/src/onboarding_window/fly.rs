//! The guide's last act: the window slides over the real island while its page shrinks into an
//! island shape (OnboardingWindow.css), then closes.

use std::{thread, time::Duration};
use tauri::{AppHandle, Manager, PhysicalPosition};

const FRAME: Duration = Duration::from_millis(16);
/// Longest flight the page may ask for, so a bad value cannot keep the window around.
const MAX_DURATION_MS: u32 = 2_000;

/// Starts the flight and returns at once; the window closes when it lands. Without an island to
/// fly to (hidden in the tray, say) the window just closes at the end.
pub fn fly_to_island(app: &AppHandle, duration_ms: u32) -> Result<(), String> {
    let window = app
        .get_webview_window(super::WINDOW_LABEL)
        .ok_or_else(|| "Onboarding window was not found.".to_string())?;
    let start = window.outer_position().map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let target = app
        .get_webview_window(crate::island::WINDOW_LABEL)
        .filter(|island| island.is_visible().unwrap_or(false))
        .and_then(|island| Some((island.outer_position().ok()?, island.outer_size().ok()?)))
        .map(|(position, island_size)| {
            // The window's top centre on the island window's top centre, where the island hangs.
            let x = position.x + (island_size.width as i32 - size.width as i32) / 2;
            PhysicalPosition::new(x, position.y)
        });
    let frames = (duration_ms.min(MAX_DURATION_MS) / FRAME.as_millis() as u32).max(1);

    thread::spawn(move || {
        if let Some(target) = target {
            for frame in 1..=frames {
                let progress = f64::from(frame) / f64::from(frames);
                let _ = window.set_position(PhysicalPosition::new(
                    eased(start.x, target.x, progress),
                    eased(start.y, target.y, progress),
                ));
                thread::sleep(FRAME);
            }
        } else {
            thread::sleep(FRAME * frames);
        }
        let _ = window.close();
    });
    Ok(())
}

/// The point `progress` (0 to 1) of the way from `from` to `to`, slow at both ends.
fn eased(from: i32, to: i32, progress: f64) -> i32 {
    let progress = progress.clamp(0.0, 1.0);
    let curve = if progress < 0.5 {
        4.0 * progress.powi(3)
    } else {
        1.0 - (-2.0 * progress + 2.0).powi(3) / 2.0
    };
    from + ((f64::from(to) - f64::from(from)) * curve).round() as i32
}

#[cfg(test)]
mod tests {
    use super::eased;

    #[test]
    fn the_flight_starts_and_ends_where_asked() {
        assert_eq!(eased(100, 900, 0.0), 100);
        assert_eq!(eased(100, 900, 1.0), 900);
        assert_eq!(eased(100, 900, 0.5), 500);
        assert_eq!(eased(400, -200, 1.0), -200);
    }

    #[test]
    fn the_flight_is_slow_at_both_ends() {
        let early = eased(0, 1000, 0.1);
        let late = eased(0, 1000, 0.9);
        assert!(early < 100, "{early}");
        assert!(late > 900, "{late}");
    }

    #[test]
    fn progress_outside_the_flight_is_clamped() {
        assert_eq!(eased(0, 10, -1.0), 0);
        assert_eq!(eased(0, 10, 2.0), 10);
    }
}
