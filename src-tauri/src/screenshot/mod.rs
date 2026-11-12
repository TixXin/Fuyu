mod hotkeys;
mod output;
mod pin;
mod session;
mod targets;
#[cfg(test)]
mod tests;

use tauri::{AppHandle, Emitter, WebviewWindow};

pub(crate) use output::is_screenshot_file;
pub(crate) use pin::{forget as forget_pin, WINDOW_PREFIX as PIN_PREFIX};
pub(crate) use session::WINDOW_PREFIX;
const TEXT_EVENT: &str = "screenshot-text";
const TAKEN_EVENT: &str = "screenshot-taken";

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Taken {
    path: String,
    thumbnail: Option<String>,
    saved: bool,
}

fn announce(app: &AppHandle, picture: &Picture, path: &std::path::Path, saved: bool) {
    let taken = Taken { path: path.display().to_string(), thumbnail: output::thumbnail(picture), saved };
    let _ = app.emit_to(crate::island::WINDOW_LABEL, TAKEN_EVENT, taken);
}
use output::Picture;
use session::{OverlaySession, PixelRect};
use targets::LocalTarget;

pub(crate) fn init(app: &AppHandle) {
    hotkeys::start(app);
    output::prune_at_start(app);
}

pub(crate) fn cancel(app: &AppHandle) {
    session::end(app);
}

#[tauri::command]
pub async fn screenshot_configure(app: AppHandle, enabled: bool) {
    hotkeys::set_enabled(enabled);
    if enabled {
        session::prepare(&app);
    }
}

#[tauri::command]
pub fn screenshot_session(window: WebviewWindow) -> Option<OverlaySession> {
    session::current(window.label())
}

#[tauri::command]
pub async fn screenshot_frame(window: WebviewWindow) -> Result<tauri::ipc::Response, String> {
    session::frame(window.label())
        .map(tauri::ipc::Response::new)
        .ok_or_else(|| "No screenshot is open.".to_string())
}

#[tauri::command]
pub fn screenshot_targets(window: WebviewWindow) -> Vec<LocalTarget> {
    session::targets_for(window.label())
}

#[tauri::command]
pub fn screenshot_overlay_ready(window: WebviewWindow, session: u64) {
    session::overlay_ready(&window, session);
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Action {
    Copy,
    Save,
    Pin,
    Text,
    Translate,
}

impl Action {
    pub(crate) fn parse(text: &str) -> Option<Self> {
        match text {
            "copy" => Some(Self::Copy),
            "save" => Some(Self::Save),
            "pin" => Some(Self::Pin),
            "text" => Some(Self::Text),
            "translate" => Some(Self::Translate),
            _ => None,
        }
    }
}

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
            if let Some(path) = output::copy(&app, &picture).inspect_err(|error| eprintln!("{error}"))? {
                announce(&app, &picture, &path, false);
            }
            Ok(None)
        }
        Action::Save => {
            let folder = header("x-folder").and_then(percent_decode);
            let name = header("x-folder-name").and_then(percent_decode).unwrap_or_default();
            let path = output::save(&picture, folder.as_deref(), &name)?;
            session::end(&app);
            announce(&app, &picture, &path, true);
            Ok(Some(path.display().to_string()))
        }
        Action::Pin => {
            let origin = session::origin(window.label()).ok_or_else(|| "No screenshot is open.".to_string())?;
            let at = (origin.0.saturating_add_unsigned(left), origin.1.saturating_add_unsigned(top));
            let scale = window.scale_factor().unwrap_or(1.0);
            pin::open(&app, picture, at, scale, session::id());
            Ok(None)
        }
        Action::Text | Action::Translate => {
            session::end(&app);
            let text = read_text(picture).await;
            if action == Action::Translate {
                crate::translation::translate_text_from_elsewhere(&app, text);
            } else {
                if !text.is_empty() {
                    output::copy_text(&text)?;
                }
                let _ = app.emit(TEXT_EVENT, text);
            }
            Ok(None)
        }
    }
}

async fn read_text(picture: Picture) -> String {
    tauri::async_runtime::spawn_blocking(move || crate::win32::ocr::recognize(picture.width, picture.height, &picture.rgba))
        .await
        .ok()
        .flatten()
        .unwrap_or_default()
}

pub(crate) fn pixels_fit(len: usize, width: u32, height: u32) -> bool {
    width > 0 && height > 0 && (width as usize).checked_mul(height as usize).and_then(|pixels| pixels.checked_mul(4)) == Some(len)
}

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

#[tauri::command]
pub fn screenshot_pin_info(window: WebviewWindow) -> Option<pin::PinInfo> {
    pin::info(window.label())
}

#[tauri::command]
pub async fn screenshot_pin_image(window: WebviewWindow) -> Result<tauri::ipc::Response, String> {
    let picture = pin::picture(window.label()).ok_or_else(|| "This pin is closed.".to_string())?;
    output::encode_png(&picture).map(tauri::ipc::Response::new)
}

#[tauri::command]
pub fn screenshot_pin_ready(app: AppHandle, window: WebviewWindow) {
    pin::ready(&app, &window);
}

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
    output::copy(&app, &picture).map(|_| ())
}

#[tauri::command]
pub async fn screenshot_pin_save(window: WebviewWindow, folder: Option<String>, folder_name: String) -> Result<String, String> {
    let picture = pin::picture(window.label()).ok_or_else(|| "This pin is closed.".to_string())?;
    output::save(&picture, folder.as_deref(), &folder_name).map(|path| path.display().to_string())
}

#[tauri::command]
pub fn screenshot_pin_close(window: WebviewWindow) {
    pin::close(&window);
}

#[tauri::command]
pub fn screenshot_pins_toggle(app: AppHandle) {
    pin::toggle_all(&app);
}

#[tauri::command]
pub fn screenshot_pins_close_all(app: AppHandle) {
    pin::close_all(&app);
}

fn card_file(path: &str) -> Result<std::path::PathBuf, String> {
    let path = std::path::PathBuf::from(path);
    let png = path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("png"));
    if png && path.is_file() {
        Ok(path)
    } else {
        Err("The screenshot file is gone.".to_string())
    }
}

#[tauri::command]
pub async fn screenshot_drag(window: WebviewWindow, path: String) -> Result<(), String> {
    let path = card_file(&path)?;
    let (sender, receiver) = std::sync::mpsc::channel();
    let target = window.clone();
    window
        .run_on_main_thread(move || {
            let result = target.hwnd().map_err(|error| error.to_string()).and_then(|hwnd| crate::win32::ole::drag_files(hwnd, &[path]));
            let _ = sender.send(result.map(|_| ()));
        })
        .map_err(|error| format!("Failed to start the drag: {error}"))?;
    tauri::async_runtime::spawn_blocking(move || receiver.recv())
        .await
        .map_err(|error| format!("Failed to finish the drag: {error}"))?
        .map_err(|_| "The drag ended unexpectedly.".to_string())?
}

#[tauri::command]
pub async fn screenshot_paste_to_front(path: String) -> Result<(), String> {
    let path = card_file(&path)?;
    tauri::async_runtime::spawn_blocking(move || output::paste_path(&path))
        .await
        .map_err(|error| format!("Failed to paste the screenshot: {error}"))?
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
            crate::screenshot::screenshot_pin_info,
            crate::screenshot::screenshot_pin_image,
            crate::screenshot::screenshot_pin_ready,
            crate::screenshot::screenshot_pin_zoom,
            crate::screenshot::screenshot_pin_click_through,
            crate::screenshot::screenshot_pin_copy,
            crate::screenshot::screenshot_pin_save,
            crate::screenshot::screenshot_pin_close,
            crate::screenshot::screenshot_pins_toggle,
            crate::screenshot::screenshot_pins_close_all,
            crate::screenshot::screenshot_drag,
            crate::screenshot::screenshot_paste_to_front,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
