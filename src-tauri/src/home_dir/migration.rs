use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::rename_migration::data_dirs::copy_tree;

pub(crate) const STATE_FILE: &str = "home-migration.json";
pub(crate) const TODO_DIR: &str = "todo";
const DATA_MARKERS: [&str; 3] = ["todos.json", "settings.json", "plugins"];

#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub(crate) struct State {
    pub from: Option<String>,
    pub at: u64,
    pub hooks: bool,
    pub todos: bool,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|elapsed| elapsed.as_millis() as u64).unwrap_or(0)
}

pub(crate) fn has_island_data(dir: &Path) -> bool {
    DATA_MARKERS.iter().any(|name| dir.join(name).exists())
}

fn write_state(dir: &Path, state: &State) -> io::Result<()> {
    let text = serde_json::to_string_pretty(state).map_err(io::Error::other)?;
    fs::write(dir.join(STATE_FILE), text)
}

fn staging(home: &Path) -> PathBuf {
    let mut name = home.file_name().map(|name| name.to_os_string()).unwrap_or_default();
    name.push(".migrating");
    home.with_file_name(name)
}

fn remove_dir_if_present(dir: &Path) -> io::Result<()> {
    match fs::remove_dir_all(dir) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
        _ => Ok(()),
    }
}

fn is_empty_dir(dir: &Path) -> bool {
    fs::read_dir(dir).map(|mut entries| entries.next().is_none()).unwrap_or(false)
}

pub(crate) fn before_start(app_data: &Path, home: &Path) -> io::Result<()> {
    if home == app_data || home.join(STATE_FILE).exists() {
        return Ok(());
    }
    if has_island_data(home) || !has_island_data(app_data) {
        fs::create_dir_all(home)?;
        let fresh = !has_island_data(app_data);
        return write_state(home, &State { at: now_ms(), hooks: fresh, todos: fresh, ..State::default() });
    }
    let state = State { from: Some(app_data.display().to_string()), at: now_ms(), ..State::default() };
    if home.exists() && !is_empty_dir(home) {
        copy_tree(app_data, home)?;
        let _ = fs::remove_file(home.join(super::POINTER_FILE));
        return write_state(home, &state);
    }
    let staged = staging(home);
    let result = (|| {
        remove_dir_if_present(&staged)?;
        copy_tree(app_data, &staged)?;
        let _ = fs::remove_file(staged.join(super::POINTER_FILE));
        write_state(&staged, &state)?;
        if home.exists() {
            fs::remove_dir(home)?;
        }
        if let Some(parent) = home.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::rename(&staged, home)
    })();
    if result.is_err() {
        let _ = remove_dir_if_present(&staged);
    }
    result
}

pub(crate) fn legacy_todo_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE").map(|profile| PathBuf::from(profile).join("Documents").join("FocuSD"))
}

pub(crate) fn copy_markdown(from: &Path, to: &Path) -> io::Result<usize> {
    if !from.is_dir() {
        return Ok(0);
    }
    fs::create_dir_all(to)?;
    let mut copied = 0;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let path = entry.path();
        let is_markdown = path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("md"));
        let target = to.join(entry.file_name());
        if entry.file_type()?.is_file() && is_markdown && !target.exists() {
            fs::copy(&path, &target)?;
            copied += 1;
        }
    }
    Ok(copied)
}

pub(crate) fn after_start(app: tauri::AppHandle) {
    let Some(home) = super::current().map(Path::to_path_buf) else {
        return;
    };
    let path = home.join(STATE_FILE);
    let Some(mut state) = fs::read_to_string(&path).ok().and_then(|text| serde_json::from_str::<State>(&text).ok()) else {
        return;
    };
    if state.hooks && state.todos {
        return;
    }
    let _ = std::thread::Builder::new().name("home-migration".into()).spawn(move || {
        if !state.hooks {
            match crate::agent_status::reinstall_hooks_after_rename(&app) {
                Ok(_) => state.hooks = true,
                Err(error) => eprintln!("could not point the agent hooks at {}: {error}", home.display()),
            }
        }
        if !state.todos {
            match legacy_todo_dir().map(|from| copy_markdown(&from, &home.join(TODO_DIR))) {
                Some(Err(error)) => eprintln!("could not copy the daily todo Markdown: {error}"),
                _ => state.todos = true,
            }
        }
        let _ = write_state(&home, &state);
    });
}

#[cfg(test)]
mod tests {
    use super::{before_start, copy_markdown, State, STATE_FILE};
    use std::fs;

    fn temp(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("fuyu-home-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn state(dir: &std::path::Path) -> State {
        serde_json::from_str(&fs::read_to_string(dir.join(STATE_FILE)).unwrap()).unwrap()
    }

    #[test]
    fn the_app_data_folder_is_copied_into_a_new_home_and_kept() {
        let root = temp("copy");
        let app_data = root.join("app");
        let home = root.join(".fuyu");
        fs::create_dir_all(app_data.join("plugins").join("a")).unwrap();
        fs::write(app_data.join("todos.json"), "{}").unwrap();
        fs::write(app_data.join("plugins").join("a").join("x.txt"), "x").unwrap();
        fs::write(app_data.join("home.json"), "{}").unwrap();
        fs::create_dir_all(app_data.join("lyrics-cache")).unwrap();

        before_start(&app_data, &home).unwrap();

        assert_eq!(fs::read_to_string(home.join("todos.json")).unwrap(), "{}");
        assert!(home.join("plugins").join("a").join("x.txt").exists());
        assert!(!home.join("home.json").exists());
        assert!(!home.join("lyrics-cache").exists());
        assert!(app_data.join("todos.json").exists());
        let copied = state(&home);
        assert!(copied.from.is_some() && !copied.hooks && !copied.todos);
        assert!(!root.join(".fuyu.migrating").exists());

        fs::write(app_data.join("todos.json"), "changed").unwrap();
        before_start(&app_data, &home).unwrap();
        assert_eq!(fs::read_to_string(home.join("todos.json")).unwrap(), "{}");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn a_home_that_has_data_already_is_used_as_it_is() {
        let root = temp("adopt");
        let app_data = root.join("app");
        let home = root.join("sync");
        fs::create_dir_all(&app_data).unwrap();
        fs::create_dir_all(&home).unwrap();
        fs::write(app_data.join("todos.json"), "old").unwrap();
        fs::write(home.join("settings.json"), "synced").unwrap();

        before_start(&app_data, &home).unwrap();

        assert!(!home.join("todos.json").exists());
        let adopted = state(&home);
        assert!(adopted.from.is_none() && !adopted.hooks && !adopted.todos);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn a_new_install_starts_with_an_empty_home() {
        let root = temp("new");
        let home = root.join(".fuyu");
        before_start(&root.join("missing"), &home).unwrap();
        let fresh = state(&home);
        assert!(fresh.hooks && fresh.todos);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn only_markdown_that_is_not_there_yet_is_copied() {
        let root = temp("md");
        let from = root.join("FocuSD");
        let to = root.join("todo");
        fs::create_dir_all(&from).unwrap();
        fs::create_dir_all(&to).unwrap();
        fs::write(from.join("2026-11-01.md"), "a").unwrap();
        fs::write(from.join("2026-11-02.md"), "b").unwrap();
        fs::write(from.join("notes.txt"), "c").unwrap();
        fs::write(to.join("2026-11-02.md"), "kept").unwrap();

        assert_eq!(copy_markdown(&from, &to).unwrap(), 1);
        assert_eq!(fs::read_to_string(to.join("2026-11-02.md")).unwrap(), "kept");
        assert!(!to.join("notes.txt").exists());
        assert_eq!(copy_markdown(&root.join("missing"), &to).unwrap(), 0);
        let _ = fs::remove_dir_all(&root);
    }
}
