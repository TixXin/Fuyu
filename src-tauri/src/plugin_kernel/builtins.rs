use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Path, PathBuf},
    sync::{Arc, Condvar, Mutex, OnceLock, PoisonError},
    time::Duration,
};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::{AppHandle, Emitter};

use super::builtins_file;
use crate::user_error::UserError;

pub(crate) const CHANGED_EVENT: &str = "builtin-plugins-changed";
const CATALOG: &str = include_str!("../../../src/features/builtins.json");
const CATALOG_FORMAT: u32 = 1;
const DIR: &str = "plugins-v3";
const FILE: &str = "plugins.yml";
const READY_WAIT: Duration = Duration::from_secs(10);

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
    fn configure(&self, _config: &Map<String, Value>) {}
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
    config: Map<String, Value>,
}

pub(crate) struct Reconfigure {
    config: Map<String, Value>,
    backgrounds: Vec<Arc<dyn Background>>,
}

impl std::fmt::Debug for Reconfigure {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "configure {} background with {:?}", self.backgrounds.len(), self.config)
    }
}

impl Reconfigure {
    pub(crate) fn run(self) {
        for background in self.backgrounds {
            background.configure(&self.config);
        }
    }
}

pub(crate) struct Table {
    catalog: Vec<Builtin>,
    disabled: BTreeSet<String>,
    config: BTreeMap<String, Map<String, Value>>,
    registered: Vec<Registered>,
}

impl Table {
    pub(crate) fn new(catalog: Vec<Builtin>, disabled: BTreeSet<String>) -> Self {
        let disabled = disabled.into_iter().filter(|id| catalog.iter().any(|plugin| &plugin.id == id && plugin.kind != Kind::Essential)).collect();
        Self { catalog, disabled, config: BTreeMap::new(), registered: Vec::new() }
    }

    pub(crate) fn with_config(mut self, config: BTreeMap<String, Map<String, Value>>) -> Self {
        self.config = config.into_iter().filter(|(id, values)| !values.is_empty() && self.catalog.iter().any(|plugin| &plugin.id == id)).collect();
        self
    }

    pub(crate) fn config(&self, id: &str) -> Map<String, Value> {
        self.config.get(id).cloned().unwrap_or_default()
    }

    pub(crate) fn set_config(&mut self, id: &str, key: &str, value: Option<Value>) -> Result<Option<Reconfigure>, UserError> {
        self.find(id)?;
        if !builtins_file::valid_key(key) {
            return Err(UserError::new("pluginsV3.builtinConfigKey", format!("{key} cannot be a config key of {id}.")).arg("id", id).arg("key", key));
        }
        if let Some(value) = &value {
            builtins_file::format_scalar(value).map_err(|detail| UserError::new("pluginsV3.builtinConfigValue", format!("The config value for {key} of {id} must be true, false, a number or a string.")).arg("id", id).arg("key", key).detail(detail))?;
        }
        let values = self.config.entry(id.to_owned()).or_default();
        let changed = match value {
            Some(value) => values.insert(key.to_owned(), value.clone()).as_ref() != Some(&value),
            None => values.remove(key).is_some(),
        };
        if values.is_empty() {
            self.config.remove(id);
        }
        if !changed {
            return Ok(None);
        }
        let backgrounds = self.registered.iter().filter(|item| item.plugin == id).map(|item| item.background.clone()).collect();
        Ok(Some(Reconfigure { config: self.config(id), backgrounds }))
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
                BuiltinPlugin { id: plugin.id.clone(), kind: plugin.kind, enabled: self.enabled(&plugin.id), background, config: self.config(&plugin.id) }
            })
            .collect()
    }
}

fn read_text(file: &Path) -> String {
    match std::fs::read_to_string(file) {
        Ok(text) => {
            if builtins_file::shape(&text) == builtins_file::Shape::Other {
                eprintln!("[plugins-v3] {} is not a plain list of entries; every built-in plugin stays on with its default config", file.display());
            }
            text
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => {
            eprintln!("[plugins-v3] could not read {}: {error}; every built-in plugin stays on with its default config", file.display());
            String::new()
        }
    }
}

pub(crate) fn read_disabled(file: &Path) -> BTreeSet<String> {
    builtins_file::disabled_ids(&read_text(file))
}

pub(crate) fn read_config(file: &Path) -> BTreeMap<String, Map<String, Value>> {
    builtins_file::configs(&read_text(file))
}

fn rewrite(file: &Path, failed: impl Fn(String) -> UserError, edit: impl FnOnce(&str) -> Result<String, String>) -> Result<(), UserError> {
    let text = match std::fs::read_to_string(file) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(failed(format!("{}: {error}", file.display()))),
    };
    let next = edit(&text).map_err(&failed)?;
    if next == text {
        return Ok(());
    }
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir).map_err(|error| failed(format!("{}: {error}", dir.display())))?;
    }
    crate::fs_write::replace_file(file, next.as_bytes()).map_err(|error| failed(format!("{}: {error}", file.display())))
}

pub(crate) fn write_switch(file: &Path, id: &str, enabled: bool) -> Result<(), UserError> {
    let failed = |detail: String| UserError::new("pluginsV3.builtinSave", format!("Could not save the switch for {id}.")).arg("id", id).detail(detail);
    rewrite(file, failed, |text| builtins_file::set_disabled(text, id, !enabled))
}

pub(crate) fn write_config(file: &Path, id: &str, key: &str, value: Option<&Value>) -> Result<(), UserError> {
    let failed = |detail: String| UserError::new("pluginsV3.builtinConfigSave", format!("Could not save the config of {id}.")).arg("id", id).detail(detail);
    rewrite(file, failed, |text| builtins_file::set_config(text, id, key, value))
}

struct Switches {
    table: Table,
    file: Option<PathBuf>,
    ready: bool,
}

static SWITCHES: OnceLock<(Mutex<Switches>, Condvar)> = OnceLock::new();
static APP: OnceLock<AppHandle> = OnceLock::new();

fn switches_gate() -> &'static (Mutex<Switches>, Condvar) {
    SWITCHES.get_or_init(|| (Mutex::new(Switches { table: Table::new(catalog(), BTreeSet::new()), file: None, ready: false }), Condvar::new()))
}

fn switches() -> &'static Mutex<Switches> {
    &switches_gate().0
}

fn fuyu_home(app: &AppHandle) -> Option<PathBuf> {
    match crate::home_dir::fuyu_home(tauri::Manager::path(app)) {
        Ok(home) => Some(home),
        Err(error) => {
            eprintln!("[plugins-v3] could not find the data folder, so built-in plugin switches are not saved: {error}");
            None
        }
    }
}

pub(crate) fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
    let home = fuyu_home(app);
    let file = home.as_deref().map(|home| home.join(DIR).join(FILE));
    if let (Some(home), Some(file)) = (home.as_deref(), file.as_deref()) {
        super::v2_builtins::migrate(home, file);
    }
    let disabled = file.as_deref().map(read_disabled).unwrap_or_default();
    let config = file.as_deref().map(read_config).unwrap_or_default();
    let actions = {
        let mut slot = switches().lock().unwrap_or_else(PoisonError::into_inner);
        let mut table = Table::new(catalog(), disabled).with_config(config);
        let mut actions = Vec::new();
        for item in std::mem::take(&mut slot.table.registered) {
            if let Ok(Some(action)) = table.register(&item.plugin, &item.name, item.background) {
                actions.push(action);
            }
        }
        *slot = Switches { table, file, ready: true };
        switches_gate().1.notify_all();
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

pub(crate) fn config(id: &str) -> Map<String, Value> {
    switches().lock().unwrap_or_else(PoisonError::into_inner).table.config(id)
}

fn wait_until_ready() {
    let (mutex, condvar) = switches_gate();
    let guard = mutex.lock().unwrap_or_else(PoisonError::into_inner);
    if !guard.ready {
        let _ = condvar.wait_timeout_while(guard, READY_WAIT, |slot| !slot.ready);
    }
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
    let _ = tauri::async_runtime::spawn_blocking(wait_until_ready).await;
    let (changed, actions) = {
        let mut slot = switches().lock().unwrap_or_else(PoisonError::into_inner);
        let was = slot.table.disabled().clone();
        let actions = slot.table.set_enabled(&id, enabled)?;
        let changed = slot.table.disabled() != &was;
        if changed {
            if let Some(file) = slot.file.clone() {
                if let Err(error) = write_switch(&file, &id, enabled) {
                    let _ = slot.table.set_enabled(&id, !enabled);
                    return Err(error);
                }
            }
        }
        (changed, actions)
    };
    run_all(actions);
    let plugins = list();
    if changed {
        if let Some(app) = APP.get() {
            let _ = app.emit(CHANGED_EVENT, &plugins);
        }
    }
    Ok(plugins)
}

#[tauri::command]
pub(crate) async fn set_builtin_plugin_config(id: String, key: String, value: Option<Value>) -> Result<Vec<BuiltinPlugin>, UserError> {
    let _ = tauri::async_runtime::spawn_blocking(wait_until_ready).await;
    let reconfigure = {
        let mut slot = switches().lock().unwrap_or_else(PoisonError::into_inner);
        let before = slot.table.config(&id).get(&key).cloned();
        let reconfigure = slot.table.set_config(&id, &key, value.clone())?;
        if reconfigure.is_some() {
            if let Some(file) = slot.file.clone() {
                if let Err(error) = write_config(&file, &id, &key, value.as_ref()) {
                    let _ = slot.table.set_config(&id, &key, before);
                    return Err(error);
                }
            }
        }
        reconfigure
    };
    let changed = reconfigure.is_some();
    if let Some(reconfigure) = reconfigure {
        reconfigure.run();
    }
    let plugins = list();
    if changed {
        if let Some(app) = APP.get() {
            let _ = app.emit(CHANGED_EVENT, &plugins);
        }
    }
    Ok(plugins)
}

#[cfg(test)]
#[path = "builtins_tests.rs"]
mod tests;
