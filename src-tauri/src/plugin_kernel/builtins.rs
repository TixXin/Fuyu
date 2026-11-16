use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock, PoisonError},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use super::builtins_file;
use crate::user_error::UserError;

pub(crate) const CHANGED_EVENT: &str = "builtin-plugins-changed";
const CATALOG: &str = include_str!("../../../src/features/builtins.json");
const CATALOG_FORMAT: u32 = 1;
const FILE: &str = "plugins.yml";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Kind {
    Essential,
    #[default]
    Builtin,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub(crate) struct Builtin {
    pub(crate) id: String,
    #[serde(default)]
    pub(crate) kind: Kind,
    #[serde(default)]
    pub(crate) background: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct CatalogFile {
    format: u32,
    plugins: Vec<Builtin>,
}

pub(crate) fn parse_catalog(text: &str) -> Result<Vec<Builtin>, String> {
    let file: CatalogFile = serde_json::from_str(text).map_err(|error| format!("the built-in plugin list is not valid: {error}"))?;
    if file.format != CATALOG_FORMAT {
        return Err(format!("the built-in plugin list has format {}, Fuyu reads {CATALOG_FORMAT}", file.format));
    }
    let mut seen = BTreeSet::new();
    for plugin in &file.plugins {
        if !seen.insert(plugin.id.as_str()) {
            return Err(format!("the built-in plugin list names {} twice", plugin.id));
        }
    }
    Ok(file.plugins)
}

pub(crate) fn catalog() -> Vec<Builtin> {
    parse_catalog(CATALOG).unwrap_or_else(|error| {
        eprintln!("[plugins-v3] {error}");
        Vec::new()
    })
}

pub(crate) trait Background: Send + Sync {
    fn start(&self) -> Result<(), String>;
    fn stop(&self);
    fn running(&self) -> bool;
}

struct Registered {
    plugin: String,
    name: String,
    background: Arc<dyn Background>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum Step {
    Start,
    Stop,
}

pub(crate) struct Action {
    step: Step,
    plugin: String,
    name: String,
    background: Arc<dyn Background>,
}

impl std::fmt::Debug for Action {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{:?} {} of {}", self.step, self.name, self.plugin)
    }
}

impl Action {
    pub(crate) fn run(self) {
        match self.step {
            Step::Start => {
                if let Err(error) = self.background.start() {
                    eprintln!("[plugins-v3] could not start {} of the built-in plugin {}: {error}", self.name, self.plugin);
                }
            }
            Step::Stop => self.background.stop(),
        }
    }
}

pub(crate) fn run_all(actions: Vec<Action>) {
    for action in actions {
        action.run();
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackgroundStatus {
    name: String,
    registered: bool,
    running: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BuiltinPlugin {
    id: String,
    kind: Kind,
    enabled: bool,
    background: Vec<BackgroundStatus>,
}

pub(crate) struct Table {
    catalog: Vec<Builtin>,
    disabled: BTreeSet<String>,
    registered: Vec<Registered>,
}

impl Table {
    pub(crate) fn new(catalog: Vec<Builtin>, disabled: BTreeSet<String>) -> Self {
        let disabled = disabled.into_iter().filter(|id| catalog.iter().any(|plugin| &plugin.id == id && plugin.kind != Kind::Essential)).collect();
        Self { catalog, disabled, registered: Vec::new() }
    }

    fn find(&self, id: &str) -> Result<&Builtin, UserError> {
        self.catalog.iter().find(|plugin| plugin.id == id).ok_or_else(|| UserError::new("pluginsV3.builtinUnknown", format!("There is no built-in plugin {id}.")).arg("id", id))
    }

    pub(crate) fn enabled(&self, id: &str) -> bool {
        self.catalog.iter().any(|plugin| plugin.id == id) && !self.disabled.contains(id)
    }

    pub(crate) fn register(&mut self, plugin: &str, name: &str, background: Arc<dyn Background>) -> Result<Option<Action>, String> {
        let builtin = self.find(plugin).map_err(|_| format!("{name} names the built-in plugin {plugin}, which is not in builtins.json"))?;
        if let Some(declared) = &builtin.background {
            if !declared.iter().any(|item| item == name) {
                return Err(format!("{name} is not in the background list of {plugin} in builtins.json"));
            }
        }
        if self.registered.iter().any(|item| item.plugin == plugin && item.name == name) {
            return Err(format!("{name} of {plugin} is registered twice"));
        }
        self.registered.push(Registered { plugin: plugin.to_owned(), name: name.to_owned(), background: background.clone() });
        Ok(self.enabled(plugin).then(|| Action { step: Step::Start, plugin: plugin.to_owned(), name: name.to_owned(), background }))
    }

    pub(crate) fn set_enabled(&mut self, id: &str, enabled: bool) -> Result<Vec<Action>, UserError> {
        let builtin = self.find(id)?;
        if builtin.kind == Kind::Essential && !enabled {
            return Err(UserError::new("pluginsV3.builtinEssential", format!("{id} is essential to Fuyu and cannot be switched off.")).arg("id", id));
        }
        let changed = if enabled { self.disabled.remove(id) } else { self.disabled.insert(id.to_owned()) };
        if !changed {
            return Ok(Vec::new());
        }
        let step = if enabled { Step::Start } else { Step::Stop };
        Ok(self
            .registered
            .iter()
            .filter(|item| item.plugin == id)
            .map(|item| Action { step, plugin: item.plugin.clone(), name: item.name.clone(), background: item.background.clone() })
            .collect())
    }

    pub(crate) fn disabled(&self) -> &BTreeSet<String> {
        &self.disabled
    }

    pub(crate) fn list(&self) -> Vec<BuiltinPlugin> {
        self.catalog
            .iter()
            .map(|plugin| {
                let mine: Vec<&Registered> = self.registered.iter().filter(|item| item.plugin == plugin.id).collect();
                let mut background: Vec<BackgroundStatus> = mine.iter().map(|item| BackgroundStatus { name: item.name.clone(), registered: true, running: item.background.running() }).collect();
                for name in plugin.background.iter().flatten() {
                    if !mine.iter().any(|item| &item.name == name) {
                        background.push(BackgroundStatus { name: name.clone(), registered: false, running: false });
                    }
                }
                BuiltinPlugin { id: plugin.id.clone(), kind: plugin.kind, enabled: self.enabled(&plugin.id), background }
            })
            .collect()
    }
}

pub(crate) fn read_disabled(file: &Path) -> BTreeSet<String> {
    match std::fs::read_to_string(file) {
        Ok(text) => {
            if builtins_file::shape(&text) == builtins_file::Shape::Other {
                eprintln!("[plugins-v3] {} is not a plain list of entries; every built-in plugin stays on", file.display());
            }
            builtins_file::disabled_ids(&text)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => BTreeSet::new(),
        Err(error) => {
            eprintln!("[plugins-v3] could not read {}: {error}; every built-in plugin stays on", file.display());
            BTreeSet::new()
        }
    }
}

pub(crate) fn write_switch(file: &Path, id: &str, enabled: bool) -> Result<(), UserError> {
    let failed = |detail: String| UserError::new("pluginsV3.builtinSave", format!("Could not save the switch for {id}.")).arg("id", id).detail(detail);
    let text = match std::fs::read_to_string(file) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(failed(format!("{}: {error}", file.display()))),
    };
    let next = builtins_file::set_disabled(&text, id, !enabled).map_err(failed)?;
    if next == text {
        return Ok(());
    }
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir).map_err(|error| failed(format!("{}: {error}", dir.display())))?;
    }
    crate::fs_write::replace_file(file, next.as_bytes()).map_err(|error| failed(format!("{}: {error}", file.display())))
}

struct Switches {
    table: Table,
    file: Option<PathBuf>,
    ready: bool,
}

static SWITCHES: OnceLock<Mutex<Switches>> = OnceLock::new();
static APP: OnceLock<AppHandle> = OnceLock::new();

fn switches() -> &'static Mutex<Switches> {
    SWITCHES.get_or_init(|| Mutex::new(Switches { table: Table::new(catalog(), BTreeSet::new()), file: None, ready: false }))
}

fn config_file(app: &AppHandle) -> Option<PathBuf> {
    match crate::home_dir::fuyu_home(tauri::Manager::path(app)) {
        Ok(home) => Some(home.join("plugins-v3").join(FILE)),
        Err(error) => {
            eprintln!("[plugins-v3] could not find the data folder, so built-in plugin switches are not saved: {error}");
            None
        }
    }
}

pub(crate) fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
    let file = config_file(app);
    let disabled = file.as_deref().map(read_disabled).unwrap_or_default();
    let actions = {
        let mut slot = switches().lock().unwrap_or_else(PoisonError::into_inner);
        let mut table = Table::new(catalog(), disabled);
        let mut actions = Vec::new();
        for item in std::mem::take(&mut slot.table.registered) {
            if let Ok(Some(action)) = table.register(&item.plugin, &item.name, item.background) {
                actions.push(action);
            }
        }
        *slot = Switches { table, file, ready: true };
        actions
    };
    run_all(actions);
}

pub(crate) fn register(plugin: &str, name: &str, background: Arc<dyn Background>) -> Result<(), String> {
    let action = {
        let mut slot = switches().lock().unwrap_or_else(PoisonError::into_inner);
        let action = slot.table.register(plugin, name, background)?;
        action.filter(|_| slot.ready)
    };
    if let Some(action) = action {
        action.run();
    }
    Ok(())
}

pub(crate) fn is_enabled(id: &str) -> bool {
    switches().lock().unwrap_or_else(PoisonError::into_inner).table.enabled(id)
}

fn list() -> Vec<BuiltinPlugin> {
    switches().lock().unwrap_or_else(PoisonError::into_inner).table.list()
}

#[tauri::command]
pub(crate) fn get_builtin_plugins() -> Vec<BuiltinPlugin> {
    list()
}

#[tauri::command]
pub(crate) async fn set_builtin_plugin_enabled(id: String, enabled: bool) -> Result<Vec<BuiltinPlugin>, UserError> {
    let actions = {
        let mut slot = switches().lock().unwrap_or_else(PoisonError::into_inner);
        let was = slot.table.disabled().clone();
        let actions = slot.table.set_enabled(&id, enabled)?;
        if slot.table.disabled() != &was {
            if let Some(file) = slot.file.clone() {
                if let Err(error) = write_switch(&file, &id, enabled) {
                    let _ = slot.table.set_enabled(&id, !enabled);
                    return Err(error);
                }
            }
        }
        actions
    };
    run_all(actions);
    let plugins = list();
    if let Some(app) = APP.get() {
        let _ = app.emit(CHANGED_EVENT, &plugins);
    }
    Ok(plugins)
}

#[cfg(test)]
#[path = "builtins_tests.rs"]
mod tests;
