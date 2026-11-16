use std::sync::Arc;

use tauri::{AppHandle, Manager};

use crate::plugin_kernel::builtins::{self, Background};

use super::{capture, hotkeys, long, pin, session, PLUGIN_ID};

pub(super) const SHORTCUTS: &str = "shortcuts";
pub(super) const WINDOWS: &str = "windows";

struct Shortcuts;

impl Background for Shortcuts {
    fn start(&self) -> Result<(), String> {
        hotkeys::start()
    }

    fn stop(&self) {
        hotkeys::stop();
    }

    fn running(&self) -> bool {
        hotkeys::running()
    }
}

struct Windows(AppHandle);

fn ours(label: &str) -> bool {
    label.starts_with(session::WINDOW_PREFIX) || label.starts_with(pin::WINDOW_PREFIX)
}

impl Background for Windows {
    fn start(&self) -> Result<(), String> {
        if hotkeys::is_enabled() {
            session::prepare(&self.0);
        }
        Ok(())
    }

    fn stop(&self) {
        let app = &self.0;
        long::end_with(long::Ending::Cancel);
        session::end(app);
        if crate::recording::is_busy() {
            crate::recording::stop_in_background(app);
        }
        pin::close_every(app);
        for (label, window) in app.webview_windows() {
            if label.starts_with(session::WINDOW_PREFIX) {
                capture::close_overlay(app, window);
            }
        }
    }

    fn running(&self) -> bool {
        self.0.webview_windows().keys().any(|label| ours(label))
    }
}

pub(super) fn register(app: &AppHandle) {
    let items: [(&str, Arc<dyn Background>); 2] = [(SHORTCUTS, Arc::new(Shortcuts)), (WINDOWS, Arc::new(Windows(app.clone())))];
    for (name, background) in items {
        if let Err(error) = builtins::register(PLUGIN_ID, name, background) {
            eprintln!("[plugins-v3] {error}");
        }
    }
}
