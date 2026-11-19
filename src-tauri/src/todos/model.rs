use serde::{Deserialize, Serialize};
use serde_json::Number;

use crate::sync::{clock, Hlc, Tombstone};

pub(crate) const FILE_VERSION: u32 = 2;
pub(crate) const MAX_SUBTASKS: usize = 50;
pub(crate) const MAX_NOTE_CHARS: usize = 1000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoSubtask {
    pub id: String,
    pub title: String,
    pub completed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoRecurrence {
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interval: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoItem {
    pub id: String,
    pub title: String,
    pub completed: bool,
    pub created_at: Number,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<Number>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurrence: Option<TodoRecurrence>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub subtasks: Vec<TodoSubtask>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focus_minutes: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focused_at: Option<Number>,
    #[serde(default, deserialize_with = "clock::lenient", skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<Hlc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_id: Option<String>,
}

pub(crate) fn latest_started(todos: &[TodoItem]) -> Option<String> {
    todos
        .iter()
        .filter(|todo| !todo.completed)
        .filter_map(|todo| todo.started_at.as_ref().and_then(Number::as_f64).map(|at| (at, todo)))
        .fold(None, |best: Option<(f64, &TodoItem)>, (at, todo)| match best {
            Some((best_at, _)) if best_at >= at => best,
            _ => Some((at, todo)),
        })
        .map(|(_, todo)| todo.id.clone())
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTodo {
    pub id: String,
    pub title: String,
    pub date: String,
    pub created_at: Number,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurrence: Option<TodoRecurrence>,
    #[serde(default, deserialize_with = "clock::lenient", skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<Hlc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoArchive {
    pub date: String,
    pub todos: Vec<TodoItem>,
    pub daily_note: String,
    pub saved_at: Number,
    pub saved_to_disk: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(default, deserialize_with = "clock::lenient", skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<Hlc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodosData {
    pub date: String,
    pub todos: Vec<TodoItem>,
    pub scheduled: Vec<ScheduledTodo>,
    pub archives: Vec<TodoArchive>,
    pub daily_note: String,
    pub active_todo_id: Option<String>,
    #[serde(default, deserialize_with = "clock::lenient", skip_serializing_if = "Option::is_none")]
    pub daily_note_updated_at: Option<Hlc>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tombstones: Vec<Tombstone>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Migration {
    pub version: u32,
    pub from_app_version: String,
    pub at: u64,
    pub source_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodosFile {
    pub version: u32,
    pub revision: u64,
    #[serde(default)]
    pub migration: Option<Migration>,
    #[serde(flatten)]
    pub data: TodosData,
}

pub(crate) fn validate(data: &TodosData) -> Result<(), String> {
    for todo in &data.todos {
        check_todo(todo)?;
    }
    for todo in &data.scheduled {
        check_item(&todo.id, &todo.title)?;
        if !is_date(&todo.date) {
            return Err(format!("Scheduled todo {} has the date \"{}\".", todo.id, todo.date));
        }
    }
    for archive in &data.archives {
        if archive.date.is_empty() {
            return Err("An archive has no date.".into());
        }
        for todo in &archive.todos {
            check_todo(todo)?;
        }
    }
    if data.active_todo_id.as_deref() == Some("") {
        return Err("The active todo id is empty.".into());
    }
    Ok(())
}

fn check_todo(todo: &TodoItem) -> Result<(), String> {
    check_item(&todo.id, &todo.title)?;
    if todo.subtasks.len() > MAX_SUBTASKS {
        return Err(format!("Todo {} has more than {MAX_SUBTASKS} subtasks.", todo.id));
    }
    for subtask in &todo.subtasks {
        if subtask.id.trim().is_empty() {
            return Err(format!("A subtask of todo {} has no id.", todo.id));
        }
        if subtask.title.trim().is_empty() {
            return Err(format!("Subtask {} of todo {} has an empty title.", subtask.id, todo.id));
        }
    }
    if let Some(note) = &todo.note {
        if note.chars().count() > MAX_NOTE_CHARS {
            return Err(format!("Todo {} has a note longer than {MAX_NOTE_CHARS} characters.", todo.id));
        }
    }
    Ok(())
}

fn check_item(id: &str, title: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("A todo has no id.".into());
    }
    if title.trim().is_empty() || title.trim() != title {
        return Err(format!("Todo {id} has an empty or untrimmed title."));
    }
    Ok(())
}

pub(crate) fn is_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return false;
    }
    let number = |range: std::ops::Range<usize>| value.get(range).filter(|part| part.bytes().all(|b| b.is_ascii_digit())).and_then(|part| part.parse::<u32>().ok());
    let (Some(year), Some(month), Some(day)) = (number(0..4), number(5..7), number(8..10)) else {
        return false;
    };
    let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return false,
    };
    (1..=days).contains(&day)
}
