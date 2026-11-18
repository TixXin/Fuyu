use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};

use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder, WindowEvent};

use crate::plugin_kernel::builtins::{self, Background};

use super::{hotkey, HAS_POSITIONED_WINDOW, PLUGIN_ID, WINDOW_LABEL};

pub(super) const SHORTCUTS: &str = "shortcuts";
pub(super) const WINDOW: &str = "window";

const IDLE_DESTROY_DELAY: Duration = Duration::from_secs(10 * 60);

static IDLE_GENERATION: AtomicU64 = AtomicU64::new(0);

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
        Ok(())
    }

    fn stop(&self) {
        cancel_idle_destroy();
        if let Some(window) = self.0.get_webview_window(WINDOW_LABEL) {
            close(&self.0, window);
        }
    }

    fn running(&self) -> bool {
        self.0.get_webview_window(WINDOW_LABEL).is_some()
    }
}

pub(super) fn ensure_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        return Ok(window);
    }
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == WINDOW_LABEL)
        .ok_or_else(|| "The translation window config was not found.".to_string())?
        .clone();
    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| error.to_string())?
        .visible(false)
        .build()
        .map_err(|error| format!("Could not create the translation window: {error}"))?;
    let handle = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = super::hide_translation_window(handle.clone());
        }
    });
    HAS_POSITIONED_WINDOW.store(false, Ordering::Relaxed);
    as_panel(app, window.clone());
    Ok(window)
}

pub(super) fn cancel_idle_destroy() {
    IDLE_GENERATION.fetch_add(1, Ordering::SeqCst);
}

pub(super) fn schedule_idle_destroy(app: &AppHandle) {
    let generation = IDLE_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(IDLE_DESTROY_DELAY);
        if IDLE_GENERATION.load(Ordering::SeqCst) != generation {
            return;
        }
        if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
            if !window.is_visible().unwrap_or(false) {
                close(&app, window);
            }
        }
    });
}

#[cfg(target_os = "macos")]
fn as_panel(app: &AppHandle, window: WebviewWindow) {
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
fn as_panel(_: &AppHandle, _: WebviewWindow) {}

fn destroy(window: &WebviewWindow) {
    HAS_POSITIONED_WINDOW.store(false, Ordering::Relaxed);
    if let Err(error) = window.destroy() {
        eprintln!("could not close the translation window: {error}");
    }
}

#[cfg(target_os = "macos")]
fn close(app: &AppHandle, window: WebviewWindow) {
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
fn close(_: &AppHandle, window: WebviewWindow) {
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
