use std::sync::Arc;

use tauri::AppHandle;

use crate::plugin_kernel::builtins::{self, Background};

use super::{events, PLUGIN_ID};

pub(super) const SESSION: &str = "session";

struct Session(AppHandle);

impl Background for Session {
    fn start(&self) -> Result<(), String> {
        events::start(&self.0)
    }

    fn stop(&self) {
        events::stop();
    }

    fn running(&self) -> bool {
        events::running()
    }
}

pub(super) fn register(app: &AppHandle) {
    if let Err(error) = builtins::register(PLUGIN_ID, SESSION, Arc::new(Session(app.clone()))) {
        eprintln!("[plugins-v3] {error}");
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_media_session_is_the_background_listed_for_music() {
        let catalog = crate::plugin_kernel::builtins::catalog();
        let music = catalog.iter().find(|plugin| plugin.id == super::PLUGIN_ID).expect("music is a built-in plugin");
        assert_eq!(music.background.as_deref(), Some(&[super::SESSION.to_owned()][..]));
    }
}
