mod calls;
mod history;
mod migration;
mod model;
mod service;
mod store;
#[cfg(test)]
mod tests;

pub use migration::{LocalTodoKeys, TodosSnapshot};
pub use model::TodosData;
pub use service::{AppliedTodosChange, TodosChange};
pub(crate) use service::{call, init, wait_until_decided};

#[tauri::command]
pub async fn migrate_todos(app: tauri::AppHandle, keys: LocalTodoKeys, normalized: TodosData) -> Result<TodosSnapshot, String> {
    service::init(&app)?;
    tauri::async_runtime::spawn_blocking(move || service::migrate(keys, normalized))
        .await
        .map_err(|error| format!("The migration task failed: {error}"))?
}

#[tauri::command]
pub fn get_todos_state() -> Result<TodosSnapshot, String> {
    service::current()
}

#[tauri::command]
pub async fn apply_todos_change(change: TodosChange) -> Result<AppliedTodosChange, String> {
    tauri::async_runtime::spawn_blocking(move || service::apply(&change))
        .await
        .map_err(|error| format!("The save task failed: {error}"))?
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::todos::migrate_todos,
            crate::todos::get_todos_state,
            crate::todos::apply_todos_change,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
