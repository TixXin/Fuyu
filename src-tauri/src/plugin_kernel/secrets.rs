use keyring::{Entry, Error as KeyringError};
use plugin_base::{host_service, ServeError};
use serde::Serialize;
use serde_json::{Map, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
};

const INDEX_FILE: &str = "plugin-secrets.json";
const SERVICE_PREFIX: &str = "com.tixxin.fuyu.plugin.";
const MAX_NAMES: usize = 32;
const MAX_NAME_LENGTH: usize = 64;
const MAX_PLUGIN_LENGTH: usize = 214;
const MAX_VALUE_LENGTH: usize = 8192;

static INDEX_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
pub(crate) struct PluginSecretNames {
    names: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
pub(crate) struct PluginSecretValue {
    value: Option<String>,
}

pub(super) trait Vault {
    fn get(&self, service: &str, name: &str) -> Result<Option<String>, String>;
    fn set(&self, service: &str, name: &str, value: &str) -> Result<(), String>;
    fn delete(&self, service: &str, name: &str) -> Result<(), String>;
}

struct SystemVault;

impl Vault for SystemVault {
    fn get(&self, service: &str, name: &str) -> Result<Option<String>, String> {
        match Entry::new(service, name).map_err(|error| error.to_string())?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(KeyringError::NoEntry) => Ok(None),
            Err(error) => Err(error.to_string()),
        }
    }

    fn set(&self, service: &str, name: &str, value: &str) -> Result<(), String> {
        Entry::new(service, name).and_then(|entry| entry.set_password(value)).map_err(|error| error.to_string())
    }

    fn delete(&self, service: &str, name: &str) -> Result<(), String> {
        match Entry::new(service, name).map_err(|error| error.to_string())?.delete_credential() {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        }
    }
}

fn store_failed(method: &str, why: String) -> ServeError {
    ServeError::new("failed", format!("{method}: the system credential store refused: {why}"))
}

fn check_plugin(method: &str, plugin: &str) -> Result<(), ServeError> {
    let fits = (1..=MAX_PLUGIN_LENGTH).contains(&plugin.len())
        && plugin.chars().all(|c| c.is_ascii_alphanumeric() || "@/._~-".contains(c))
        && !plugin.starts_with(['.', '/'])
        && !plugin.contains("..");
    if fits {
        Ok(())
    } else {
        Err(ServeError::bad_params(method, "plugin is not a plugin id"))
    }
}

fn check_name(method: &str, name: &str) -> Result<(), ServeError> {
    let mut chars = name.chars();
    let fits = name.len() <= MAX_NAME_LENGTH
        && chars.next().is_some_and(|c| c.is_ascii_alphanumeric())
        && chars.all(|c| c.is_ascii_alphanumeric() || "._-".contains(c));
    if fits {
        Ok(())
    } else {
        Err(ServeError::bad_params(method, format!("name must be 1-{MAX_NAME_LENGTH} letters, digits, '.', '_' or '-', starting with a letter or digit")))
    }
}

pub(super) fn service_of(plugin: &str) -> String {
    crate::dev_lane::service(&format!("{SERVICE_PREFIX}{plugin}"))
}

fn lock() -> MutexGuard<'static, ()> {
    INDEX_LOCK.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn read_index(home: &Path) -> Map<String, Value> {
    fs::read_to_string(home.join(INDEX_FILE))
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|value| match value {
            Value::Object(map) => Some(map),
            _ => None,
        })
        .unwrap_or_default()
}

fn names_in(index: &Map<String, Value>, plugin: &str) -> Vec<String> {
    let mut names: Vec<String> = index.get(plugin).and_then(Value::as_array).into_iter().flatten().filter_map(Value::as_str).map(str::to_owned).collect();
    names.sort();
    names.dedup();
    names
}

fn write_index(method: &str, home: &Path, mut index: Map<String, Value>, plugin: &str, names: &[String]) -> Result<(), ServeError> {
    if names.is_empty() {
        index.remove(plugin);
    } else {
        index.insert(plugin.to_string(), Value::from(names.to_vec()));
    }
    let text = serde_json::to_string_pretty(&Value::Object(index)).map_err(|error| ServeError::new("failed", format!("{method}: {error}")))?;
    fs::create_dir_all(home).map_err(|error| ServeError::new("failed", format!("{method}: could not create {}: {error}", home.display())))?;
    crate::fs_write::replace_file(&home.join(INDEX_FILE), format!("{text}\n").as_bytes()).map_err(|error| ServeError::new("failed", format!("{method}: could not write {INDEX_FILE}: {error}")))
}

pub(super) fn list_in(home: &Path, plugin: &str) -> Result<PluginSecretNames, ServeError> {
    check_plugin("pluginKernel.secretList", plugin)?;
    let _guard = lock();
    Ok(PluginSecretNames { names: names_in(&read_index(home), plugin) })
}

pub(super) fn get_in(vault: &dyn Vault, plugin: &str, name: &str) -> Result<PluginSecretValue, ServeError> {
    const METHOD: &str = "pluginKernel.secretGet";
    check_plugin(METHOD, plugin)?;
    check_name(METHOD, name)?;
    let value = vault.get(&service_of(plugin), name).map_err(|why| store_failed(METHOD, why))?;
    Ok(PluginSecretValue { value })
}

pub(super) fn set_in(home: &Path, vault: &dyn Vault, plugin: &str, name: &str, value: &str) -> Result<PluginSecretNames, ServeError> {
    const METHOD: &str = "pluginKernel.secretSet";
    check_plugin(METHOD, plugin)?;
    check_name(METHOD, name)?;
    if value.is_empty() || value.chars().count() > MAX_VALUE_LENGTH {
        return Err(ServeError::bad_params(METHOD, format!("value must be 1-{MAX_VALUE_LENGTH} characters")));
    }
    let _guard = lock();
    let index = read_index(home);
    let mut names = names_in(&index, plugin);
    if !names.iter().any(|known| known == name) {
        if names.len() >= MAX_NAMES {
            return Err(ServeError::new("too-many", format!("{METHOD}: a plugin keeps at most {MAX_NAMES} secrets")));
        }
        names.push(name.to_string());
        names.sort();
    }
    vault.set(&service_of(plugin), name, value).map_err(|why| store_failed(METHOD, why))?;
    write_index(METHOD, home, index, plugin, &names)?;
    Ok(PluginSecretNames { names })
}

pub(super) fn remove_in(home: &Path, vault: &dyn Vault, plugin: &str, name: &str) -> Result<PluginSecretNames, ServeError> {
    const METHOD: &str = "pluginKernel.secretRemove";
    check_plugin(METHOD, plugin)?;
    check_name(METHOD, name)?;
    let _guard = lock();
    vault.delete(&service_of(plugin), name).map_err(|why| store_failed(METHOD, why))?;
    let index = read_index(home);
    let names: Vec<String> = names_in(&index, plugin).into_iter().filter(|known| known != name).collect();
    write_index(METHOD, home, index, plugin, &names)?;
    Ok(PluginSecretNames { names })
}

pub(super) fn clear_in(home: &Path, vault: &dyn Vault, plugin: &str) -> Result<PluginSecretNames, ServeError> {
    const METHOD: &str = "pluginKernel.secretClear";
    check_plugin(METHOD, plugin)?;
    let _guard = lock();
    let index = read_index(home);
    let service = service_of(plugin);
    let mut kept = Vec::new();
    let mut failure = None;
    for name in names_in(&index, plugin) {
        if let Err(why) = vault.delete(&service, &name) {
            failure.get_or_insert(why);
            kept.push(name);
        }
    }
    write_index(METHOD, home, index, plugin, &kept)?;
    match failure {
        Some(why) => Err(store_failed(METHOD, why)),
        None => Ok(PluginSecretNames::default()),
    }
}

fn home() -> Result<PathBuf, ServeError> {
    super::PLUGINS_DIR
        .get()
        .and_then(|dir| dir.parent())
        .map(Path::to_path_buf)
        .ok_or_else(|| ServeError::new("unavailable", "the plugin kernel is not running"))
}

#[host_service("pluginKernel.secretList")]
pub(crate) fn secret_list(plugin: String) -> Result<PluginSecretNames, ServeError> {
    list_in(&home()?, &plugin)
}

#[host_service("pluginKernel.secretGet")]
pub(crate) fn secret_get(plugin: String, name: String) -> Result<PluginSecretValue, ServeError> {
    get_in(&SystemVault, &plugin, &name)
}

#[host_service("pluginKernel.secretSet")]
pub(crate) fn secret_set(plugin: String, name: String, value: String) -> Result<PluginSecretNames, ServeError> {
    set_in(&home()?, &SystemVault, &plugin, &name, &value)
}

#[host_service("pluginKernel.secretRemove")]
pub(crate) fn secret_remove(plugin: String, name: String) -> Result<PluginSecretNames, ServeError> {
    remove_in(&home()?, &SystemVault, &plugin, &name)
}

#[host_service("pluginKernel.secretClear")]
pub(crate) fn secret_clear(plugin: String) -> Result<PluginSecretNames, ServeError> {
    clear_in(&home()?, &SystemVault, &plugin)
}

#[cfg(test)]
#[path = "secrets_tests.rs"]
mod tests;
