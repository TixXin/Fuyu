//! The island's data folder, asked for in one place (#50, D30). For now it is Tauri's app data
//! folder (the roaming `com.tixxin.fuyu` folder, or the lane preview's own); D30.3 moves it to a
//! home folder (`FUYU_HOME`, default `~/.fuyu`) by changing only this function.

use std::path::PathBuf;
use tauri::{path::PathResolver, Runtime};

/// Where the island keeps its files: todos, clipboard history, plugins, agent status and the rest.
/// Takes `app.path()`, so it works the same from an `AppHandle`, a reference to one or a window.
pub(crate) fn fuyu_home<R: Runtime>(paths: &PathResolver<R>) -> tauri::Result<PathBuf> {
    paths.app_data_dir()
}
