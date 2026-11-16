use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Listener};

pub(crate) const REQUEST_EVENT: &str = "builtin-diagnostics-request";
pub(crate) const REPORT_EVENT: &str = "builtin-diagnostics-report";
const HOST_TIMEOUT: Duration = Duration::from_secs(2);
const WINDOW_WAIT: Duration = Duration::from_millis(800);

static NEXT: AtomicU64 = AtomicU64::new(1);

fn host_usage() -> Value {
    let Some(supervisor) = super::supervisor() else {
        return json!({ "running": false });
    };
    match supervisor.call("status", Value::Null, HOST_TIMEOUT) {
        Ok(Value::Array(plugins)) => {
            let plugins: Vec<Value> = plugins
                .iter()
                .map(|plugin| json!({ "id": plugin.get("id"), "state": plugin.get("state"), "usage": plugin.get("usage") }))
                .collect();
            json!({ "running": true, "plugins": plugins })
        }
        Ok(other) => json!({ "running": true, "error": format!("the host answered status with {other}") }),
        Err(error) => json!({ "running": true, "error": error.to_string() }),
    }
}

fn matching_report(payload: &str, id: u64) -> Option<Value> {
    let report: Value = serde_json::from_str(payload).ok()?;
    (report.get("id").and_then(Value::as_u64) == Some(id)).then_some(report)
}

fn window_reports(app: &AppHandle) -> Vec<Value> {
    let id = NEXT.fetch_add(1, Ordering::Relaxed);
    let (sender, receiver) = mpsc::channel();
    let listener = app.listen_any(REPORT_EVENT, move |event| {
        if let Some(report) = matching_report(event.payload(), id) {
            let _ = sender.send(report);
        }
    });
    let mut reports = Vec::new();
    if app.emit(REQUEST_EVENT, json!({ "id": id })).is_ok() {
        let deadline = Instant::now() + WINDOW_WAIT;
        while let Some(left) = deadline.checked_duration_since(Instant::now()) {
            match receiver.recv_timeout(left) {
                Ok(report) => reports.push(report),
                Err(_) => break,
            }
        }
    }
    app.unlisten(listener);
    reports
}

pub(crate) fn collect(app: &AppHandle) -> Value {
    json!({
        "pid": std::process::id(),
        "rust": super::builtins::get_builtin_plugins(),
        "host": host_usage(),
        "windows": window_reports(app),
    })
}

#[cfg(test)]
mod tests {
    use super::matching_report;

    #[test]
    fn only_the_report_for_this_request_counts() {
        assert!(matching_report(r#"{"id":7,"window":"main"}"#, 7).is_some());
        assert!(matching_report(r#"{"id":8,"window":"main"}"#, 7).is_none());
        assert!(matching_report("not json", 7).is_none());
    }
}
