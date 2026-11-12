use serde::{Deserialize, Serialize};
use serde_json::Number;

pub(crate) const FILE_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoItem {
    pub id: String,
    pub title: String,
    pub completed: bool,
    pub created_at: Number,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
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
        check_item(&todo.id, &todo.title)?;
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
            check_item(&todo.id, &todo.title)?;
        }
    }
    if data.active_todo_id.as_deref() == Some("") {
        return Err("The active todo id is empty.".into());
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
