use std::{fs, path::Path};

use serde_json::json;

use super::queue::ApprovalRequest;

const DIR: &str = "agent-notifications";
const MARK: &str = "-approval-";

fn file_name(agent: &str, id: u64) -> String {
    format!("{agent}{MARK}{id}.json")
}

pub(super) fn note(app_dir: &Path, request: &ApprovalRequest) {
    if !request.agent.lacks_waiting_event() || request.remote_host.is_some() {
        return;
    }
    let dir = app_dir.join(DIR);
    if fs::create_dir_all(&dir).is_err() {
        return;
    }
    let body = json!({ "hook_event_name": "PermissionRequest", "session_id": request.session_id });
    let _ = crate::fs_write::replace_file(&dir.join(file_name(request.agent.id(), request.id)), body.to_string().as_bytes());
}

pub(super) fn clear(app_dir: &Path, id: u64) {
    let suffix = format!("{MARK}{id}.json");
    for entry in fs::read_dir(app_dir.join(DIR)).into_iter().flatten().flatten() {
        if entry.file_name().to_string_lossy().ends_with(&suffix) {
            let _ = fs::remove_file(entry.path());
        }
    }
}
