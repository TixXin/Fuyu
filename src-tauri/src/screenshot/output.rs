//! Where a screenshot goes. Step 1: the clipboard. The clipboard history picks the image up like
//! any other copy.

use std::{borrow::Cow, thread, time::Duration};

use arboard::{Clipboard, ImageData};

/// Another program may hold the clipboard for a moment; try a few times.
const ATTEMPTS: u32 = 4;
const RETRY_DELAY: Duration = Duration::from_millis(60);

pub(super) fn copy_image(width: u32, height: u32, rgba: Vec<u8>) -> Result<(), String> {
    let image = ImageData { width: width as usize, height: height as usize, bytes: Cow::Owned(rgba) };
    let mut last_error = String::new();
    for attempt in 0..ATTEMPTS {
        if attempt > 0 {
            thread::sleep(RETRY_DELAY);
        }
        match Clipboard::new().and_then(|mut clipboard| clipboard.set_image(image.clone())) {
            Ok(()) => return Ok(()),
            Err(error) => last_error = error.to_string(),
        }
    }
    Err(format!("Failed to copy the screenshot: {last_error}"))
}
