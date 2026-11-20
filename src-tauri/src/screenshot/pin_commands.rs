use tauri::{AppHandle, WebviewWindow};

use super::{output::Picture, pin, pin_edit::PinTurn, pin_store};

#[tauri::command]
pub async fn screenshot_pin_turn(app: AppHandle, window: WebviewWindow, turn: PinTurn) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || pin::turn(&app, &window, turn))
        .await
        .map_err(|error| format!("Failed to turn the pin: {error}"))?
}

#[tauri::command]
pub fn screenshot_pin_collapse(app: AppHandle, window: WebviewWindow, collapsed: bool) -> Result<(), String> {
    pin::collapse(&app, &window, collapsed)
}

#[tauri::command]
pub fn screenshot_pin_reserve(window: WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    pin::reserve(&window, (width, height))
}

#[tauri::command]
pub async fn screenshot_pin_replace(app: AppHandle, window: WebviewWindow, request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(body) = request.body() else {
        return Err("The pin pixels must come as raw bytes.".to_string());
    };
    let number = |name: &str| request.headers().get(name).and_then(|value| value.to_str().ok()).and_then(|value| value.parse::<u32>().ok());
    let (width, height) = number("x-width").zip(number("x-height")).ok_or_else(|| "The pin size is missing.".to_string())?;
    if !super::pixels_fit(body.len(), width, height) {
        return Err("The pin pixels do not match the size.".to_string());
    }
    pin::replace(&app, &window, Picture { width, height, rgba: body.clone() })
}

#[tauri::command]
pub fn screenshot_pin_opacity(app: AppHandle, window: WebviewWindow, opacity: f64) {
    pin::set_opacity(&app, window.label(), opacity);
}

#[tauri::command]
pub async fn screenshot_pin_text(window: WebviewWindow) -> Result<String, String> {
    let picture = pin::picture(window.label()).ok_or_else(|| "This pin is closed.".to_string())?;
    tauri::async_runtime::spawn_blocking(move || crate::platform::ocr::recognize(picture.width, picture.height, &picture.rgba))
        .await
        .map_err(|error| format!("Failed to read the text: {error}"))
        .map(Option::unwrap_or_default)
}

#[tauri::command]
pub fn screenshot_pins_remember(app: AppHandle, enabled: bool) {
    pin_store::set_enabled(&app, enabled);
}
