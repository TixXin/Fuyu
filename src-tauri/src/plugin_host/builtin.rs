use serde_json::{Map, Value};

use super::manifest::{parse_builtin_manifest, PluginManifest};
use super::settings::InfoItem;

pub(super) const BUILTINS: &[(&str, &str, bool)] = &[];

pub(super) fn manifests(app_version: &str) -> Vec<(&'static str, Result<PluginManifest, String>)> {
    BUILTINS.iter().map(|&(id, text, _)| (id, parse_builtin_manifest(text, id, app_version))).collect()
}

pub(super) fn is_builtin(id: &str) -> bool {
    BUILTINS.iter().any(|&(builtin, _, _)| builtin == id)
}

pub(super) fn has_native_work(builtins: &[(&str, &str, bool)], id: &str) -> Result<bool, String> {
    builtins
        .iter()
        .find(|&&(builtin, _, _)| builtin == id)
        .map(|&(_, _, native)| native)
        .ok_or_else(|| format!("Unknown built-in plugin {id}."))
}

pub(super) fn start(id: &str, _settings: &Map<String, Value>) -> Result<Vec<InfoItem>, String> {
    if !has_native_work(BUILTINS, id)? {
        return Ok(Vec::new());
    }
    Err(format!("Built-in plugin {id} is marked native but has no start."))
}

pub(super) fn stop(id: &str) -> Result<(), String> {
    let _ = has_native_work(BUILTINS, id)?;
    Ok(())
}

pub(super) fn settings_changed(_id: &str, _settings: &Map<String, Value>) -> Result<(), String> {
    Ok(())
}

pub(super) fn run_command(_id: &str, _command: &str) -> Result<Vec<InfoItem>, String> {
    Err("Unknown plugin command.".into())
}
