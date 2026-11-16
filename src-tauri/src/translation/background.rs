use std::sync::{atomic::Ordering, Arc};

use tauri::{AppHandle, Manager, WebviewWindowBuilder};

use crate::plugin_kernel::builtins::{self, Background};

use super::{hotkey, HAS_POSITIONED_WINDOW, PLUGIN_ID, WINDOW_LABEL};

pub(super) const SHORTCUTS: &str = "shortcuts";
pub(super) const WINDOW: &str = "window";

struct Shortcuts(AppHandle);

impl Background for Shortcuts {
    fn start(&self) -> Result<(), String> {
        hotkey::start(&self.0)
    }

    fn stop(&self) {
        hotkey::stop();
    }

    fn running(&self) -> bool {
        hotkey::running()
    }
}

struct Window(AppHandle);

impl Background for Window {
    fn start(&self) -> Result<(), String> {
        if self.0.get_webview_window(WINDOW_LABEL).is_some() {
            return Ok(());
        }
        let config = self
            .0
            .config()
            .app
            .windows
            .iter()
            .find(|window| window.label == WINDOW_LABEL)
            .ok_or_else(|| "The translation window config was not found.".to_string())?
            .clone();
        let window = WebviewWindowBuilder::from_config(&self.0, &config)
            .map_err(|error| error.to_string())?
            .visible(false)
            .build()
            .map_err(|error| format!("Could not create the translation window: {error}"))?;
        HAS_POSITIONED_WINDOW.store(false, Ordering::Relaxed);
        as_panel(&self.0, window);
        Ok(())
    }

    fn stop(&self) {
        if let Some(window) = self.0.get_webview_window(WINDOW_LABEL) {
            close(&self.0, window);
        }
    }

    fn running(&self) -> bool {
        self.0.get_webview_window(WINDOW_LABEL).is_some()
    }
}

#[cfg(target_os = "macos")]
fn as_panel(app: &AppHandle, window: tauri::WebviewWindow) {
    let queued = app.run_on_main_thread(move || {
        if let Err(error) = crate::macos::island_panel::make_popup_panel(&window) {
            eprintln!("failed to make the translation window a panel: {error}");
        }
    });
    if let Err(error) = queued {
        eprintln!("failed to make the translation window a panel: {error}");
    }
}

#[cfg(not(target_os = "macos"))]
fn as_panel(_: &AppHandle, _: tauri::WebviewWindow) {}

fn destroy(window: &tauri::WebviewWindow) {
    if let Err(error) = window.destroy() {
        eprintln!("could not close the translation window: {error}");
    }
}

#[cfg(target_os = "macos")]
fn close(app: &AppHandle, window: tauri::WebviewWindow) {
    let handle = app.clone();
    let queued = app.run_on_main_thread(move || {
        crate::macos::island_panel::forget_panel(&handle, WINDOW_LABEL);
        destroy(&window);
    });
    if let Err(error) = queued {
        eprintln!("could not close the translation window: {error}");
    }
}

#[cfg(not(target_os = "macos"))]
fn close(_: &AppHandle, window: tauri::WebviewWindow) {
    destroy(&window);
}

pub(super) fn register(app: &AppHandle) {
    let items: [(&str, Arc<dyn Background>); 2] = [(SHORTCUTS, Arc::new(Shortcuts(app.clone()))), (WINDOW, Arc::new(Window(app.clone())))];
    for (name, background) in items {
        if let Err(error) = builtins::register(PLUGIN_ID, name, background) {
            eprintln!("[plugins-v3] {error}");
        }
    }
}
