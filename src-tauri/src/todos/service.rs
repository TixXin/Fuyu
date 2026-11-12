use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    sync::{Condvar, Mutex, MutexGuard, OnceLock, PoisonError},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

use super::{
    calls::{self, todos_reason, CallError},
    migration::{self, LocalTodoKeys, TodosSnapshot, FILE_NAME},
    model::{ScheduledTodo, TodoArchive, TodoItem, TodosData, TodosFile},
    store::{self, LoadError},
};
use crate::{island, plugin_host};

const CHANGED_EVENT: &str = "todos-changed";

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(crate) struct OutsideChanges {
    pub todos: u64,
    pub scheduled: u64,
    pub daily_note: u64,
    pub active_todo_id: u64,
}

impl OutsideChanges {
    fn record(&mut self, fields: &[&str], revision: u64) {
        for field in fields {
            match *field {
                "todos" => self.todos = revision,
                "scheduled" => self.scheduled = revision,
                "dailyNote" => self.daily_note = revision,
                "activeTodoId" => self.active_todo_id = revision,
                _ => {}
            }
        }
    }
}

pub(crate) fn changed_fields(old: &TodosData, new: &TodosData) -> Vec<&'static str> {
    [
        ("date", old.date != new.date),
        ("todos", old.todos != new.todos),
        ("scheduled", old.scheduled != new.scheduled),
        ("archives", old.archives != new.archives),
        ("dailyNote", old.daily_note != new.daily_note),
        ("activeTodoId", old.active_todo_id != new.active_todo_id),
    ]
    .into_iter()
    .filter_map(|(field, changed)| changed.then_some(field))
    .collect()
}

struct Loaded {
    file: TodosFile,
    outside: OutsideChanges,
}

enum Source {
    Pending,
    File(Box<Loaded>),
    Local,
}

struct TodosHost {
    app: AppHandle,
    dir: PathBuf,
    app_version: String,
    source: Mutex<Source>,
    decided: Condvar,
}

static HOST: OnceLock<TodosHost> = OnceLock::new();

pub(crate) fn init(app: &AppHandle) -> Result<(), String> {
    let dir = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let host = TodosHost {
        app: app.clone(),
        dir,
        app_version: app.package_info().version.to_string(),
        source: Mutex::new(Source::Pending),
        decided: Condvar::new(),
    };
    HOST.set(host).map_err(|_| "The todo store was initialized twice.".to_string())
}

fn host() -> Result<&'static TodosHost, String> {
    HOST.get().ok_or_else(|| "The todo store is not initialized.".to_string())
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

pub(crate) fn wait_until_decided(timeout: Duration) -> bool {
    let Ok(host) = host() else { return false };
    let deadline = Instant::now() + timeout;
    let mut source = lock(&host.source);
    while matches!(*source, Source::Pending) {
        let left = deadline.saturating_duration_since(Instant::now());
        if left.is_zero() {
            return false;
        }
        source = host.decided.wait_timeout(source, left).unwrap_or_else(PoisonError::into_inner).0;
    }
    matches!(*source, Source::File(_))
}

pub(crate) fn migrate(keys: LocalTodoKeys, normalized: TodosData) -> Result<TodosSnapshot, String> {
    let host = host()?;
    let mut source = lock(&host.source);
    if let Source::File(loaded) = &*source {
        return Ok(snapshot(&loaded.file, None));
    }
    let result = migrate_with_retry(host, &keys, normalized);
    let answer = match result {
        Ok((file, notice)) => {
            let answer = Ok(snapshot(&file, notice));
            *source = Source::File(Box::new(Loaded { file, outside: OutsideChanges::default() }));
            answer
        }
        Err(error) => {
            *source = Source::Local;
            Err(error)
        }
    };
    host.decided.notify_all();
    answer
}

fn migrate_with_retry(host: &TodosHost, keys: &LocalTodoKeys, normalized: TodosData) -> Result<(TodosFile, Option<&'static str>), String> {
    for _ in 0..3 {
        if !matches!(store::load(&host.dir.join(FILE_NAME)), Err(LoadError::Unreadable(_))) {
            break;
        }
        thread::sleep(Duration::from_millis(300));
    }
    migration::migrate(&host.dir, keys, normalized, &host.app_version)
}

fn snapshot(file: &TodosFile, notice: Option<&'static str>) -> TodosSnapshot {
    TodosSnapshot { revision: file.revision, data: file.data.clone(), notice }
}

pub(crate) fn current() -> Result<TodosSnapshot, String> {
    match &*lock(&host()?.source) {
        Source::File(loaded) => Ok(snapshot(&loaded.file, None)),
        Source::Pending => Err("The todos are not loaded yet.".into()),
        Source::Local => Err("The todos are kept by the island window (todos.json could not be used).".into()),
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodosChange {
    #[serde(default)]
    pub base_revision: Option<u64>,
    pub date: Option<String>,
    pub todos: Option<Vec<TodoItem>>,
    pub scheduled: Option<Vec<ScheduledTodo>>,
    pub archives: Option<Vec<TodoArchive>>,
    pub daily_note: Option<String>,
    #[serde(default, deserialize_with = "present")]
    pub active_todo_id: Option<Option<String>>,
}

fn present<'de, D: Deserializer<'de>, T: Deserialize<'de>>(deserializer: D) -> Result<Option<T>, D::Error> {
    T::deserialize(deserializer).map(Some)
}

pub(crate) fn without_conflicts(change: &TodosChange, outside: &OutsideChanges) -> (TodosChange, Vec<&'static str>) {
    let Some(base) = change.base_revision else {
        return (change.clone(), Vec::new());
    };
    let mut kept = change.clone();
    let mut dropped = Vec::new();
    if kept.todos.is_some() && outside.todos > base {
        kept.todos = None;
        dropped.push("todos");
    }
    if kept.scheduled.is_some() && outside.scheduled > base {
        kept.scheduled = None;
        dropped.push("scheduled");
    }
    if kept.daily_note.is_some() && outside.daily_note > base {
        kept.daily_note = None;
        dropped.push("dailyNote");
    }
    if kept.active_todo_id.is_some() && outside.active_todo_id > base {
        kept.active_todo_id = None;
        dropped.push("activeTodoId");
    }
    (kept, dropped)
}

pub(crate) fn patched(data: &TodosData, change: &TodosChange) -> TodosData {
    let mut next = data.clone();
    if let Some(date) = &change.date {
        next.date = date.clone();
    }
    if let Some(todos) = &change.todos {
        next.todos = todos.clone();
    }
    if let Some(scheduled) = &change.scheduled {
        next.scheduled = scheduled.clone();
    }
    if let Some(archives) = &change.archives {
        next.archives = archives.clone();
    }
    if let Some(note) = &change.daily_note {
        next.daily_note = note.clone();
    }
    if let Some(active) = &change.active_todo_id {
        next.active_todo_id = active.clone();
    }
    next
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppliedTodosChange {
    pub revision: u64,
    pub conflicts: Vec<&'static str>,
    pub data: Option<TodosData>,
}

pub(crate) fn apply(change: &TodosChange) -> Result<AppliedTodosChange, String> {
    let host = host()?;
    let mut source = lock(&host.source);
    let Source::File(loaded) = &mut *source else {
        return Err("The todos are not kept in todos.json right now.".into());
    };
    let (change, conflicts) = without_conflicts(change, &loaded.outside);
    let data = patched(&loaded.file.data, &change);
    if data != loaded.file.data {
        let next = TodosFile { revision: loaded.file.revision + 1, data, ..loaded.file.clone() };
        store::save(&host.dir.join(FILE_NAME), &next)?;
        let old = std::mem::replace(&mut loaded.file, next);
        publish_plugin_events(&old.data, &loaded.file.data);
    }
    let data = (!conflicts.is_empty()).then(|| loaded.file.data.clone());
    Ok(AppliedTodosChange { revision: loaded.file.revision, conflicts, data })
}

pub(crate) fn call(method: &str, params: &Value) -> Option<Result<Value, CallError>> {
    if !calls::is_todo_call(method) {
        return None;
    }
    let host = host().ok()?;
    let mut source = lock(&host.source);
    let Source::File(loaded) = &mut *source else { return None };
    Some(call_loaded(host, loaded, method, params))
}

fn call_loaded(host: &TodosHost, loaded: &mut Loaded, method: &str, params: &Value) -> Result<Value, CallError> {
    let id = if method == "todos.add" { calls::new_todo_id().map_err(|error| (500, error))? } else { String::new() };
    let outcome = calls::run(method, params, &loaded.file.data, &id, now_ms())?;
    let Some(data) = outcome.next.filter(|data| *data != loaded.file.data) else {
        return Ok(outcome.result);
    };
    let next = TodosFile { revision: loaded.file.revision + 1, data, ..loaded.file.clone() };
    store::save(&host.dir.join(FILE_NAME), &next).map_err(|error| (500, error))?;
    let old = std::mem::replace(&mut loaded.file, next);
    let fields = changed_fields(&old.data, &loaded.file.data);
    loaded.outside.record(&fields, loaded.file.revision);
    let reason = todos_reason(&old.data, &loaded.file.data);
    let _ = host.app.emit_to(
        island::WINDOW_LABEL,
        CHANGED_EVENT,
        json!({ "revision": loaded.file.revision, "data": loaded.file.data, "fields": fields, "reason": reason }),
    );
    publish_plugin_events(&old.data, &loaded.file.data);
    Ok(outcome.result)
}

fn publish_plugin_events(old: &TodosData, new: &TodosData) {
    if let Some(reason) = todos_reason(old, new) {
        plugin_host::publish_event("todos.changed", json!({ "date": new.date, "reason": reason }));
    }
    if old.daily_note != new.daily_note || old.date != new.date {
        plugin_host::publish_event("note.changed", json!({ "date": new.date }));
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}
