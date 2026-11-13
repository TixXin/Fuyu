use std::{path::Path, thread, time::Duration};

use super::output::Picture;
use crate::macos::{input, pasteboard};

const PASTE_DELAY: Duration = Duration::from_millis(220);

pub(super) fn put_on_clipboard(_picture: &Picture, png: &[u8], file: Option<&Path>) -> Result<(), String> {
    let file = file.map(|path| path.to_string_lossy().into_owned());
    if pasteboard::write_image(png, file.as_deref()) {
        Ok(())
    } else {
        Err("Failed to copy the screenshot.".to_string())
    }
}

pub(super) fn paste_path(path: &Path) -> Result<(), String> {
    let text = path.to_string_lossy();
    if !pasteboard::write_file_with_text(&text, &format!("\"{text}\"")) {
        return Err("Failed to copy the screenshot.".to_string());
    }
    thread::sleep(PASTE_DELAY);
    input::send_paste_shortcut();
    Ok(())
}

pub(super) fn copy_text(text: &str) -> Result<(), String> {
    if pasteboard::write_text(text) {
        Ok(())
    } else {
        Err("Failed to copy the text.".to_string())
    }
}
