use std::sync::Arc;

use tauri::AppHandle;

use crate::plugin_kernel::builtins::{self, Background};

use super::{engine, hotkey, session, PLUGIN_ID};

pub(super) const SHORTCUTS: &str = "shortcuts";

struct Shortcuts(AppHandle);

impl Background for Shortcuts {
    fn start(&self) -> Result<(), String> {
        hotkey::start()
    }

    fn stop(&self) {
        hotkey::stop();
        let _ = session::stop(&self.0, false);
        engine::unload();
    }

    fn running(&self) -> bool {
        hotkey::running()
    }
}

pub(super) fn register(app: &AppHandle) {
    if let Err(error) = builtins::register(PLUGIN_ID, SHORTCUTS, Arc::new(Shortcuts(app.clone()))) {
        eprintln!("[plugins-v3] {error}");
    }
}
