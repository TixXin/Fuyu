mod calls;
mod history;
mod host;
#[cfg_attr(target_os = "macos", path = "hotkey_macos.rs")]
mod hotkey;
mod migration;
mod model;
mod service;
mod shortcut;
mod stamps;
mod store;
#[cfg(test)]
mod tests;

pub use migration::{LocalTodoKeys, TodosSnapshot};
pub use model::TodosData;
pub use service::{AppliedTodosChange, TodosChange};
pub(crate) use service::{call, for_sync, replace_from_sync, wait_until_decided};
#[cfg(windows)]
pub(crate) use shortcut::coexist_refresh;

pub(crate) fn init(app: &tauri::AppHandle) -> Result<(), String> {
    shortcut::init(app);
    service::init(app)
}

#[tauri::command]
pub(crate) fn get_todo_shortcut_problem() -> Option<&'static str> {
    shortcut::problem()
}

#[tauri::command]
pub async fn migrate_todos(app: tauri::AppHandle, keys: LocalTodoKeys, normalized: TodosData) -> Result<TodosSnapshot, String> {
    service::init(&app)?;
    tauri::async_runtime::spawn_blocking(move || service::migrate(keys, normalized))
        .await
        .map_err(|error| format!("The migration task failed: {error}"))?
}

#[tauri::command]
pub fn get_todos_state(app: tauri::AppHandle) -> Result<TodosSnapshot, String> {
    service::init(&app)?;
    service::current()
}

#[tauri::command]
pub async fn apply_todos_change(app: tauri::AppHandle, change: TodosChange) -> Result<AppliedTodosChange, String> {
    service::init(&app)?;
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
            crate::todos::get_todo_shortcut_problem,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
