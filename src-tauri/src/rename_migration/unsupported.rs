#[allow(dead_code)]
#[path = "data_dirs.rs"]
pub(crate) mod data_dirs;

pub(crate) const NEW_IDENTIFIER: &str = "com.tixxin.fuyu";

pub(crate) fn before_start() {}

pub(crate) fn after_start(_app: tauri::AppHandle) {}
