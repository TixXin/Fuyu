use tauri::WebviewWindow;

use super::service;

#[tauri::command]
pub async fn start_clipboard_drag(window: WebviewWindow, id: String) -> Result<(), String> {
    let paths = service()?.drag_paths(&id)?;
    let (sender, receiver) = std::sync::mpsc::channel::<Result<(), String>>();
    let target = window.clone();
    window
        .run_on_main_thread(move || {
            let _ = sender.send(start(&target, paths));
        })
        .map_err(|error| format!("Failed to start the drag: {error}"))?;
    tauri::async_runtime::spawn_blocking(move || receiver.recv())
        .await
        .map_err(|error| format!("Failed to finish the drag: {error}"))?
        .map_err(|_| "The drag ended unexpectedly.".to_string())?
}

#[cfg(target_os = "macos")]
fn start(window: &WebviewWindow, paths: Vec<String>) -> Result<(), String> {
    let image = paths
        .first()
        .and_then(|path| crate::macos::icon::file_icon_tiff(path))
        .ok_or_else(|| "Failed to start the drag.".to_string())?;
    let files = paths.iter().map(std::path::PathBuf::from).collect();
    drag::start_drag(window, drag::DragItem::Files(files), drag::Image::Raw(image), |_, _| {}, drag::Options::default())
        .map_err(|error| format!("Failed to start the drag: {error}"))
}

#[cfg(windows)]
fn start(window: &WebviewWindow, paths: Vec<String>) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|error| error.to_string())?;
    crate::win32::ole::drag_files(hwnd, &paths).map(|_| ())
}
