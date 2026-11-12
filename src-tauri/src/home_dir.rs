use std::path::PathBuf;
use tauri::{path::PathResolver, Runtime};

pub(crate) fn fuyu_home<R: Runtime>(paths: &PathResolver<R>) -> tauri::Result<PathBuf> {
    paths.app_data_dir()
}
