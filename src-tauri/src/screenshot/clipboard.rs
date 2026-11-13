use std::{path::Path, thread, time::Duration};

use clipboard_win::{formats, options::NoClear, raw};

use super::output::{dib, Picture};
use crate::win32;

const OPEN_ATTEMPTS: usize = 10;
const PASTE_DELAY: Duration = Duration::from_millis(220);

pub(super) fn put_on_clipboard(picture: &Picture, png: &[u8], file: Option<&Path>) -> Result<(), String> {
    let dib = dib(picture);
    let _open = clipboard_win::Clipboard::new_attempts(OPEN_ATTEMPTS).map_err(|error| format!("Failed to open the clipboard: {error}"))?;
    let failed = |error: clipboard_win::ErrorCode| format!("Failed to copy the screenshot: {error}");
    raw::empty().map_err(failed)?;
    raw::set_without_clear(formats::CF_DIB, &dib).map_err(failed)?;
    if let Some(format) = raw::register_format("PNG") {
        raw::set_without_clear(format.get(), png).map_err(failed)?;
    }
    if let Some(path) = file {
        raw::set_file_list_with(&[path.to_string_lossy()], NoClear).map_err(failed)?;
    }
    Ok(())
}

pub(super) fn paste_path(path: &Path) -> Result<(), String> {
    {
        let _open = clipboard_win::Clipboard::new_attempts(OPEN_ATTEMPTS).map_err(|error| format!("Failed to open the clipboard: {error}"))?;
        let failed = |error: clipboard_win::ErrorCode| format!("Failed to copy the screenshot: {error}");
        raw::empty().map_err(failed)?;
        raw::set_file_list_with(&[path.to_string_lossy()], NoClear).map_err(failed)?;
        raw::set_string_with(&format!("\"{}\"", path.display()), NoClear).map_err(failed)?;
    }
    thread::sleep(PASTE_DELAY);
    win32::input::send_paste_shortcut();
    Ok(())
}

pub(super) fn copy_text(text: &str) -> Result<(), String> {
    let _open = clipboard_win::Clipboard::new_attempts(OPEN_ATTEMPTS).map_err(|error| format!("Failed to open the clipboard: {error}"))?;
    raw::set_string(text).map_err(|error| format!("Failed to copy the text: {error}"))
}

