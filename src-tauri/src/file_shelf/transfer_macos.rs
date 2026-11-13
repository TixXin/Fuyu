use std::{path::PathBuf, sync::mpsc, time::Duration};

use tauri::WebviewWindow;

use crate::macos::{icon, pasteboard};

const LONGEST_DRAG: Duration = Duration::from_secs(600);

pub(super) fn copy(paths: &[String]) -> Result<(), String> {
    if pasteboard::write_files(paths) {
        Ok(())
    } else {
        Err("Failed to copy the files.".to_string())
    }
}

pub(super) async fn drag(window: WebviewWindow, paths: Vec<String>) -> Result<bool, String> {
    let image = paths.first().and_then(|path| icon::file_icon_tiff(path)).ok_or_else(|| "Failed to start the drag.".to_string())?;
    let (sender, receiver) = mpsc::channel::<Result<bool, String>>();
    let target = window.clone();
    window
        .run_on_main_thread(move || {
            let dropped = sender.clone();
            let files = paths.iter().map(PathBuf::from).collect();
            let started = drag::start_drag(
                &target,
                drag::DragItem::Files(files),
                drag::Image::Raw(image),
                move |result, _| {
                    let _ = dropped.send(Ok(matches!(result, drag::DragResult::Dropped)));
                },
                drag::Options::default(),
            );
            if let Err(error) = started {
                let _ = sender.send(Err(format!("Failed to start the drag: {error}")));
            }
        })
        .map_err(|error| format!("Failed to start the drag: {error}"))?;
    tauri::async_runtime::spawn_blocking(move || receiver.recv_timeout(LONGEST_DRAG))
        .await
        .map_err(|error| format!("Failed to finish the drag: {error}"))?
        .map_err(|_| "The drag ended unexpectedly.".to_string())?
}
