use plugin_base::{host_service, ServeError};
use serde_json::{Map, Value};
use std::time::Duration;

use super::service;

const READY_TIMEOUT: Duration = Duration::from_secs(10);

fn params<const N: usize>(fields: [(&str, Option<Value>); N]) -> Value {
    Value::Object(fields.into_iter().filter_map(|(name, value)| Some((name.to_string(), value?))).collect::<Map<_, _>>())
}

pub(crate) fn error_code(status: u16) -> &'static str {
    match status {
        400 => "bad-params",
        404 => "not-found",
        503 => "inactive",
        _ => "failed",
    }
}

fn run(service_method: &str, method: &str, params: Value) -> Result<Value, ServeError> {
    service::wait_until_decided(READY_TIMEOUT);
    match service::call(method, &params) {
        Some(Ok(result)) => Ok(result),
        Some(Err((status, message))) => Err(ServeError::new(error_code(status), format!("{service_method}: {message}"))),
        None => Err(ServeError::new("unavailable", format!("{service_method}: the todos are kept by the island window right now"))),
    }
}

#[host_service("todos.list")]
fn list_for_host(date: Option<Value>) -> Result<Value, ServeError> {
    run("todos.list", "todos.list", params([("date", date)]))
}

#[host_service("todos.days")]
fn days_for_host(from: Option<Value>, to: Option<Value>) -> Result<Value, ServeError> {
    run("todos.days", "todos.days", params([("from", from), ("to", to)]))
}

#[host_service("todos.add")]
fn add_for_host(title: Option<Value>, date: Option<Value>, project: Option<Value>) -> Result<Value, ServeError> {
    run("todos.add", "todos.add", params([("title", title), ("date", date), ("project", project)]))
}

#[host_service("todos.update")]
fn update_for_host(id: Option<Value>, title: Option<Value>, completed: Option<Value>, add_focus_minutes: Option<Value>) -> Result<Value, ServeError> {
    run("todos.update", "todos.update", params([("id", id), ("title", title), ("completed", completed), ("addFocusMinutes", add_focus_minutes)]))
}

#[host_service("todos.remove")]
fn remove_for_host(id: Option<Value>) -> Result<Value, ServeError> {
    run("todos.remove", "todos.remove", params([("id", id)]))
}

#[host_service("todos.note")]
fn note_for_host(date: Option<Value>) -> Result<Value, ServeError> {
    run("todos.note", "note.get", params([("date", date)]))
}

#[host_service("todos.setNote")]
fn set_note_for_host(note: Option<Value>, append: Option<Value>) -> Result<Value, ServeError> {
    run("todos.setNote", "note.set", params([("note", note), ("append", append)]))
}
