use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

use super::host;

pub(super) const FILE_NAME: &str = "dev-plugins.json";
const MAX_REMEMBERED: usize = 10;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Remembered {
    #[serde(default)]
    pub plugins: Vec<RememberedPlugin>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RememberedPlugin {
    pub id: String,
    pub path: String,
    #[serde(default)]
    pub active: bool,
}

impl Remembered {
    pub fn loaded(&mut self, id: &str, path: &str) {
        self.plugins.retain(|plugin| plugin.id != id && plugin.path != path);
        self.plugins.insert(0, RememberedPlugin { id: id.to_string(), path: path.to_string(), active: true });
        self.plugins.truncate(MAX_REMEMBERED);
    }

    pub fn unloaded(&mut self, id: &str) {
        for plugin in self.plugins.iter_mut().filter(|plugin| plugin.id == id) {
            plugin.active = false;
        }
    }

    pub fn forget(&mut self, path: &str) -> bool {
        let before = self.plugins.len();
        self.plugins.retain(|plugin| plugin.path != path);
        self.plugins.len() != before
    }

    pub fn to_restore(&self) -> Vec<String> {
        self.plugins.iter().rev().filter(|plugin| plugin.active).map(|plugin| plugin.path.clone()).collect()
    }
}

fn file() -> Result<PathBuf, String> {
    Ok(host()?.state_path.with_file_name(FILE_NAME))
}

pub(super) fn read() -> Remembered {
    file()
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

pub(super) fn change(edit: impl FnOnce(&mut Remembered)) {
    let mut remembered = read();
    let before = remembered.clone();
    edit(&mut remembered);
    if remembered == before {
        return;
    }
    let written = file().and_then(|path| {
        let text = serde_json::to_vec_pretty(&remembered).map_err(|error| error.to_string())?;
        crate::fs_write::replace_file(&path, &text).map_err(|error| format!("Could not write {}: {error}", path.display()))
    });
    if let Err(error) = written {
        eprintln!("could not remember the development plugins: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::Remembered;

    #[test]
    fn the_newest_load_comes_first_and_a_folder_or_id_is_listed_once() {
        let mut remembered = Remembered::default();
        remembered.loaded("a", "C:/a");
        remembered.loaded("b", "C:/b");
        remembered.loaded("a", "C:/a2");
        let listed: Vec<(&str, &str)> = remembered.plugins.iter().map(|plugin| (plugin.id.as_str(), plugin.path.as_str())).collect();
        assert_eq!(listed, [("a", "C:/a2"), ("b", "C:/b")]);
        for index in 0..20 {
            remembered.loaded(&format!("p{index}"), &format!("C:/p{index}"));
        }
        assert_eq!(remembered.plugins.len(), 10);
    }

    #[test]
    fn only_plugins_still_loaded_are_restored_oldest_first() {
        let mut remembered = Remembered::default();
        remembered.loaded("a", "C:/a");
        remembered.loaded("b", "C:/b");
        remembered.loaded("c", "C:/c");
        remembered.unloaded("b");
        assert_eq!(remembered.to_restore(), ["C:/a", "C:/c"]);
        assert!(remembered.forget("C:/a"));
        assert!(!remembered.forget("C:/a"));
        assert_eq!(remembered.to_restore(), ["C:/c"]);
        assert_eq!(remembered.plugins.len(), 2, "an unloaded plugin stays in the list to load again");
    }
}
