use std::{
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex, PoisonError,
    },
    thread,
    time::Duration,
};

use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder};

use crate::plugin_kernel::builtins::{self, Background};

use super::{listener, popup, preview_window, privacy, sequence, service, workers, PLUGIN_ID};

pub(super) const LISTENER: &str = "listener";
pub(super) const WINDOWS: &str = "windows";

const LABELS: [&str; 2] = [popup::WINDOW_LABEL, preview_window::WINDOW_LABEL];
const PREWARM_DELAY: Duration = Duration::from_secs(2);
const PREVIEW_IDLE_DELAY: Duration = Duration::from_secs(5 * 60);
const PREVIEW_POPUP_CLOSED_DELAY: Duration = Duration::from_secs(5);

static WINDOWS_ACTIVE: AtomicBool = AtomicBool::new(false);
static WINDOWS_GENERATION: AtomicU64 = AtomicU64::new(0);
static PREVIEW_IDLE_GENERATION: AtomicU64 = AtomicU64::new(0);
static BUILD_LOCK: Mutex<()> = Mutex::new(());

pub(super) fn mirror(enabled: bool) {
    let Ok(service) = service() else {
        return;
    };
    {
        let Ok(mut state) = service.state.lock() else {
            return;
        };
        if state.settings.enabled == enabled {
            return;
        }
        state.settings.enabled = enabled;
        if let Err(error) = service.persist_locked(&state) {
            eprintln!("failed to save the clipboard switch: {error}");
        }
    }
    service.emit_changed();
}

struct Listener;

impl Background for Listener {
    fn start(&self) -> Result<(), String> {
        if super::is_loaded() {
            mirror(true);
        }
        workers::start_capture()?;
        listener::start()?;
        privacy::start_secret_sweeper()?;
        workers::notify_clipboard_changed();
        Ok(())
    }

    fn stop(&self) {
        if super::is_loaded() {
            mirror(false);
        }
        sequence::stop();
        listener::stop();
        privacy::stop_secret_sweeper();
        workers::stop_capture();
        super::flush();
    }

    fn running(&self) -> bool {
        listener::running() || workers::capture_running() || privacy::sweeper_running()
    }
}

struct Windows(AppHandle);

impl Background for Windows {
    fn start(&self) -> Result<(), String> {
        WINDOWS_ACTIVE.store(true, Ordering::Release);
        let generation = WINDOWS_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
        let app = self.0.clone();
        let _ = thread::Builder::new().name("clipboard-prewarm".into()).spawn(move || {
            thread::sleep(PREWARM_DELAY);
            if !WINDOWS_ACTIVE.load(Ordering::Acquire) || WINDOWS_GENERATION.load(Ordering::SeqCst) != generation {
                return;
            }
            if let Err(error) = ensure_popup_window(&app) {
                eprintln!("failed to prewarm the clipboard window: {error}");
            }
        });
        Ok(())
    }

    fn stop(&self) {
        WINDOWS_ACTIVE.store(false, Ordering::Release);
        WINDOWS_GENERATION.fetch_add(1, Ordering::SeqCst);
        cancel_preview_destroy();
        preview_window::forget();
        for label in LABELS {
            if let Some(window) = self.0.get_webview_window(label) {
                close(&self.0, label, window);
            }
        }
    }

    fn running(&self) -> bool {
        WINDOWS_ACTIVE.load(Ordering::Acquire)
            || LABELS.iter().any(|label| self.0.get_webview_window(label).is_some())
    }
}

pub(super) fn ensure_popup_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    ensure_window(app, popup::WINDOW_LABEL)
}

pub(super) fn ensure_preview_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    cancel_preview_destroy();
    ensure_window(app, preview_window::WINDOW_LABEL)
}

pub(super) fn cancel_preview_destroy() {
    PREVIEW_IDLE_GENERATION.fetch_add(1, Ordering::SeqCst);
}

pub(super) fn schedule_preview_idle_destroy(app: &AppHandle) {
    schedule_preview_destroy(app, PREVIEW_IDLE_DELAY);
}

pub(super) fn schedule_preview_close_after_popup(app: &AppHandle) {
    schedule_preview_destroy(app, PREVIEW_POPUP_CLOSED_DELAY);
}

fn schedule_preview_destroy(app: &AppHandle, delay: Duration) {
    if app.get_webview_window(preview_window::WINDOW_LABEL).is_none() {
        return;
    }
    let generation = PREVIEW_IDLE_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    let _ = thread::Builder::new().name("clipboard-preview-idle".into()).spawn(move || {
        thread::sleep(delay);
        if PREVIEW_IDLE_GENERATION.load(Ordering::SeqCst) != generation || preview_window::editing() {
            return;
        }
        if let Some(window) = app.get_webview_window(preview_window::WINDOW_LABEL) {
            if !window.is_visible().unwrap_or(false) {
                preview_window::forget();
                close(&app, preview_window::WINDOW_LABEL, window);
            }
        }
    });
}

fn ensure_window(app: &AppHandle, label: &'static str) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(label) {
        return Ok(window);
    }
    let _guard = BUILD_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(window) = app.get_webview_window(label) {
        return Ok(window);
    }
    build(app, label)
}

fn build(app: &AppHandle, label: &'static str) -> Result<WebviewWindow, String> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == label)
        .ok_or_else(|| format!("The {label} window config was not found."))?
        .clone();
    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|error| error.to_string())?
        .visible(false)
        .build()
        .map_err(|error| format!("Could not create the {label} window: {error}"))?;
    as_panel(app, label, window.clone());
    Ok(window)
}

#[cfg(target_os = "macos")]
fn as_panel(app: &AppHandle, label: &'static str, window: WebviewWindow) {
    let queued = app.run_on_main_thread(move || {
        let made = if label == preview_window::WINDOW_LABEL {
            crate::macos::island_panel::make_preview_panel(&window)
        } else {
            crate::macos::island_panel::make_popup_panel(&window)
        };
        if let Err(error) = made {
            eprintln!("failed to make the {label} window a panel: {error}");
        }
    });
    if let Err(error) = queued {
        eprintln!("failed to make the {label} window a panel: {error}");
    }
}

#[cfg(not(target_os = "macos"))]
fn as_panel(_: &AppHandle, _: &'static str, _: WebviewWindow) {}

fn destroy(label: &str, window: &WebviewWindow) {
    if let Err(error) = window.destroy() {
        eprintln!("could not close the {label} window: {error}");
    }
}

#[cfg(target_os = "macos")]
fn close(app: &AppHandle, label: &'static str, window: WebviewWindow) {
    let handle = app.clone();
    let queued = app.run_on_main_thread(move || {
        crate::macos::island_panel::forget_panel(&handle, label);
        destroy(label, &window);
    });
    if let Err(error) = queued {
        eprintln!("could not close the {label} window: {error}");
    }
}

#[cfg(not(target_os = "macos"))]
fn close(_: &AppHandle, label: &'static str, window: WebviewWindow) {
    destroy(label, &window);
}

pub(super) fn follow_setting(enabled: bool) {
    if builtins::is_enabled(PLUGIN_ID) == enabled {
        return;
    }
    tauri::async_runtime::spawn(async move {
        if let Err(error) = builtins::set_builtin_plugin_enabled(PLUGIN_ID.to_owned(), enabled).await {
            eprintln!("failed to switch the clipboard plugin from its settings: {error}");
        }
    });
}

pub(super) fn migrate_switch(stored_enabled: bool) {
    if stored_enabled || !builtins::is_enabled(PLUGIN_ID) {
        return;
    }
    if let Err(error) = tauri::async_runtime::block_on(builtins::set_builtin_plugin_enabled(PLUGIN_ID.to_owned(), false)) {
        eprintln!("failed to carry the clipboard switch over to plugins.yml: {error}");
    }
}

pub(super) fn register(app: &AppHandle) {
    let items: [(&str, Arc<dyn Background>); 2] = [(LISTENER, Arc::new(Listener)), (WINDOWS, Arc::new(Windows(app.clone())))];
    for (name, background) in items {
        if let Err(error) = builtins::register(PLUGIN_ID, name, background) {
            eprintln!("[plugins-v3] {error}");
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_listener_and_windows_are_the_background_listed_for_clipboard() {
        let catalog = crate::plugin_kernel::builtins::catalog();
        let clipboard = catalog.iter().find(|plugin| plugin.id == super::PLUGIN_ID).expect("clipboard is a built-in plugin");
        let names = [super::LISTENER.to_owned(), super::WINDOWS.to_owned()];
        assert_eq!(clipboard.background.as_deref(), Some(&names[..]));
    }
}
