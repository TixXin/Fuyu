use tauri::WebviewWindow;

pub(super) struct DragFollow;

impl DragFollow {
    pub(super) fn start(window: &WebviewWindow) -> Result<Self, String> {
        window.start_dragging().map_err(|error| error.to_string())?;
        Ok(Self)
    }

    pub(super) fn poll(&mut self, _window: &WebviewWindow) {}
}
