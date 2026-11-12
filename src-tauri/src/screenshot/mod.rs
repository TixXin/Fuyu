//! Built-in screenshots (C41; plan in docs/architecture/screenshot-plan.md): the shortcuts, the
//! frozen picture of every monitor, the overlay windows where a region is chosen, and where the
//! chosen picture goes: the clipboard, a file, or a pin on the screen.

mod hotkeys;
mod output;
mod pin;
mod session;
mod targets;
#[cfg(test)]
mod tests;

use tauri::{AppHandle, WebviewWindow};

pub(crate) use output::is_screenshot_file;
pub(crate) use pin::{forget as forget_pin, WINDOW_PREFIX as PIN_PREFIX};
pub(crate) use session::WINDOW_PREFIX;
use output::Picture;
use session::{OverlaySession, PixelRect};
use targets::LocalTarget;

pub(crate) fn init(app: &AppHandle) {
    hotkeys::start(app);
    output::prune_at_start(app);
}

/// Closing an overlay (Alt+F4) cancels the screenshot instead.
pub(crate) fn cancel(app: &AppHandle) {
    session::end(app);
}

/// Turns the module on or off: its shortcuts, and the overlay windows kept ready while on.
#[tauri::command]
pub async fn screenshot_configure(app: AppHandle, enabled: bool) {
    hotkeys::set_enabled(enabled);
    if enabled {
        session::prepare(&app);
    }
}

/// The open screenshot as the calling overlay shows it, for an overlay that loaded late.
#[tauri::command]
pub fn screenshot_session(window: WebviewWindow) -> Option<OverlaySession> {
    session::current(window.label())
}

/// The calling overlay's monitor picture: RGBA, rows top to bottom, size from the session.
#[tauri::command]
pub async fn screenshot_frame(window: WebviewWindow) -> Result<tauri::ipc::Response, String> {
    session::frame(window.label())
        .map(tauri::ipc::Response::new)
        .ok_or_else(|| "No screenshot is open.".to_string())
}

/// What the calling overlay can snap to: windows, then controls once they are read.
#[tauri::command]
pub fn screenshot_targets(window: WebviewWindow) -> Vec<LocalTarget> {
    session::targets_for(window.label())
}

/// The calling overlay has drawn screenshot `session`'s picture and can be shown.
#[tauri::command]
pub fn screenshot_overlay_ready(window: WebviewWindow, session: u64) {
    session::overlay_ready(&window, session);
}

/// What to do with the chosen picture (mirrored by `ScreenshotAction` in api.ts).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Action {
    Copy,
    Save,
    Pin,
}

impl Action {
    pub(crate) fn parse(text: &str) -> Option<Self> {
        match text {
            "copy" => Some(Self::Copy),
            "save" => Some(Self::Save),
            "pin" => Some(Self::Pin),
            _ => None,
        }
    }
}

/// Takes the chosen picture to the clipboard, a file or a pin, and closes the screenshot. The
/// headers say what and where: `x-action`, the selection in the monitor's picture (`x-left`,
/// `x-top`, `x-width`, `x-height`), and for saving `x-folder` and `x-folder-name`, percent-encoded.
/// The selection is cut from the frozen picture here. With annotations the body is the part they
/// cover, raw RGBA rows (not JSON), laid over it at `x-patch-left`, `x-patch-top` (in the
/// selection), `x-patch-width` × `x-patch-height`: only that much crosses from the page, since a
/// whole 4K selection through the WebView made copying stall. Gives the saved file's path.
///
/// Copying and pinning close the overlays first, so the screen is back at once while the picture
/// is encoded; a failed save keeps the screenshot open, to try again.
#[tauri::command]
pub async fn screenshot_finish(app: AppHandle, window: WebviewWindow, request: tauri::ipc::Request<'_>) -> Result<Option<String>, String> {
    let tauri::ipc::InvokeBody::Raw(body) = request.body() else {
        return Err("The screenshot pixels must come as raw bytes.".to_string());
    };
    let header = |name: &str| request.headers().get(name).and_then(|value| value.to_str().ok());
    let number = |name: &str| header(name).and_then(|value| value.parse::<u32>().ok());
    let action = header("x-action").and_then(Action::parse).ok_or_else(|| "Unknown screenshot action.".to_string())?;
    let (width, height) = number("x-width").zip(number("x-height")).ok_or_else(|| "The screenshot size is missing.".to_string())?;
    let (left, top) = (number("x-left").unwrap_or(0), number("x-top").unwrap_or(0));
    let (width, height, rgba) = session::selection(window.label(), PixelRect { x: left, y: top, width, height }).ok_or_else(|| "Nothing is selected.".to_string())?;
    let mut picture = Picture { width, height, rgba };
    if !body.is_empty() {
        let patch = PixelRect {
            x: number("x-patch-left").unwrap_or(0),
            y: number("x-patch-top").unwrap_or(0),
            width: number("x-patch-width").unwrap_or(0),
            height: number("x-patch-height").unwrap_or(0),
        };
        if !output::lay_over(&mut picture, patch, body) {
            return Err("The annotated pixels do not fit the selection.".to_string());
        }
    }
    match action {
        Action::Copy => {
            session::end(&app);
            output::copy(&app, &picture).inspect_err(|error| eprintln!("{error}"))?;
            Ok(None)
        }
        Action::Save => {
            let folder = header("x-folder").and_then(percent_decode);
            let name = header("x-folder-name").and_then(percent_decode).unwrap_or_default();
            let path = output::save(&picture, folder.as_deref(), &name)?;
            session::end(&app);
            Ok(Some(path.display().to_string()))
        }
        Action::Pin => {
            let origin = session::origin(window.label()).ok_or_else(|| "No screenshot is open.".to_string())?;
            session::end(&app);
            pin::open(&app, picture, (origin.0.saturating_add_unsigned(left), origin.1.saturating_add_unsigned(top)))?;
            Ok(None)
        }
    }
}

/// Whether `len` bytes are exactly `width` × `height` RGBA pixels, none of them zero.
pub(crate) fn pixels_fit(len: usize, width: u32, height: u32) -> bool {
    width > 0 && height > 0 && (width as usize).checked_mul(height as usize).and_then(|pixels| pixels.checked_mul(4)) == Some(len)
}

/// Undoes `encodeURIComponent`: header values must be ASCII, folder names need not be.
pub(crate) fn percent_decode(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = text.get(index + 1..index + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            index += 3;
        } else {
            out.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(out).ok()
}

#[tauri::command]
pub fn screenshot_cancel(app: AppHandle) {
    session::end(&app);
}

/// The calling pin's picture: RGBA rows, its size in the page's URL.
#[tauri::command]
pub async fn screenshot_pin_image(window: WebviewWindow) -> Result<tauri::ipc::Response, String> {
    pin::picture(window.label())
        .map(|picture| tauri::ipc::Response::new(picture.rgba.clone()))
        .ok_or_else(|| "This pin is closed.".to_string())
}

/// The calling pin has drawn its picture and can be shown.
#[tauri::command]
pub fn screenshot_pin_ready(window: WebviewWindow) {
    pin::ready(&window);
}

/// Zooms the calling pin to `scale` of its picture, keeping (`anchor_x`, `anchor_y`), fractions
/// of the window, in place.
#[tauri::command]
pub fn screenshot_pin_zoom(window: WebviewWindow, scale: f64, anchor_x: f64, anchor_y: f64) -> Result<(), String> {
    pin::zoom(&window, scale, (anchor_x, anchor_y))
}

#[tauri::command]
pub fn screenshot_pin_click_through(window: WebviewWindow, through: bool) -> Result<(), String> {
    pin::click_through(&window, through)
}

#[tauri::command]
pub async fn screenshot_pin_copy(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    let picture = pin::picture(window.label()).ok_or_else(|| "This pin is closed.".to_string())?;
    output::copy(&app, &picture)
}

/// Saves the calling pin's picture like the toolbar's save; gives the file's path.
#[tauri::command]
pub async fn screenshot_pin_save(window: WebviewWindow, folder: Option<String>, folder_name: String) -> Result<String, String> {
    let picture = pin::picture(window.label()).ok_or_else(|| "This pin is closed.".to_string())?;
    output::save(&picture, folder.as_deref(), &folder_name).map(|path| path.display().to_string())
}

#[tauri::command]
pub fn screenshot_pin_close(window: WebviewWindow) {
    pin::close(&window);
}

/// Hides every pin, or shows them all again (T, from a pin or the island).
#[tauri::command]
pub fn screenshot_pins_toggle(app: AppHandle) {
    pin::toggle_all(&app);
}

#[tauri::command]
pub fn screenshot_pins_close_all(app: AppHandle) {
    pin::close_all(&app);
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::screenshot::screenshot_configure,
            crate::screenshot::screenshot_session,
            crate::screenshot::screenshot_frame,
            crate::screenshot::screenshot_targets,
            crate::screenshot::screenshot_overlay_ready,
            crate::screenshot::screenshot_finish,
            crate::screenshot::screenshot_cancel,
            crate::screenshot::screenshot_pin_image,
            crate::screenshot::screenshot_pin_ready,
            crate::screenshot::screenshot_pin_zoom,
            crate::screenshot::screenshot_pin_click_through,
            crate::screenshot::screenshot_pin_copy,
            crate::screenshot::screenshot_pin_save,
            crate::screenshot::screenshot_pin_close,
            crate::screenshot::screenshot_pins_toggle,
            crate::screenshot::screenshot_pins_close_all,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
