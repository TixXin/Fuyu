use std::{
    fs,
    path::{Path, PathBuf},
};

use serde_json::json;

pub(super) fn path(home: &Path, lane: u32) -> PathBuf {
    home.join(format!("agent-approval.lane-{lane}.json"))
}

pub(super) fn write(home: &Path, lane: u32, port: u16, token: &str) -> Result<(), String> {
    let file = path(home, lane);
    let text = json!({ "port": port, "token": token, "pid": std::process::id() }).to_string();
    crate::fs_write::replace_file(&file, text.as_bytes()).map_err(|error| format!("Could not write {}: {error}", file.display()))
}

pub(super) fn remove(home: &Path, lane: u32) {
    let _ = fs::remove_file(path(home, lane));
}
