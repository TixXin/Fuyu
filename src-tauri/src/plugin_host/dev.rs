use serde::Serialize;
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, VecDeque},
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use super::{
    app_version, builtin, dev_recent,
    grants::stop_plugin,
    host, lock,
    manifest::{parse_manifest, read_manifest_text, PluginManifest, MANIFEST_FILE_NAME},
    registry::rescan,
    runtime::TraceEntry,
};

#[cfg(windows)]
pub(super) const EXPERIMENTAL_APIS: &[&str] = &["windows"];
#[cfg(not(windows))]
pub(super) const EXPERIMENTAL_APIS: &[&str] = &[];

struct DevState {
    enabled: bool,
    plugins: BTreeMap<String, PathBuf>,
}

static DEV: Mutex<DevState> = Mutex::new(DevState { enabled: false, plugins: BTreeMap::new() });

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DevSnapshot {
    enabled: bool,
    plugins: Vec<DevPlugin>,
    recent: Vec<DevPlugin>,
    restores: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DevPlugin {
    id: String,
    path: String,
}

type DevResult<T> = Result<T, (u16, String)>;

pub(super) fn is_dev(id: &str) -> bool {
    lock(&DEV).plugins.contains_key(id)
}

pub(super) fn plugins() -> Vec<(String, PathBuf)> {
    lock(&DEV).plugins.iter().map(|(id, path)| (id.clone(), path.clone())).collect()
}

pub(super) fn read_manifest(dir: &Path, app_version: &str) -> Result<PluginManifest, String> {
    let text = read_manifest_text(dir)
        .map_err(|error| format!("Could not read {MANIFEST_FILE_NAME} in {}: {error}", dir.display()))?;
    let id = serde_json::from_str::<Value>(&text)
        .ok()
        .and_then(|value| value.get("id").and_then(Value::as_str).map(str::to_string))
        .ok_or_else(|| format!("{MANIFEST_FILE_NAME} has no \"id\"."))?;
    parse_manifest(&text, &id, app_version)
}

pub(super) fn check_installed(manifest: PluginManifest) -> Result<PluginManifest, String> {
    if manifest.experimental_apis.is_empty() {
        Ok(manifest)
    } else {
        Err("This plugin uses experimental APIs (experimentalApis), which only work in development mode.".into())
    }
}

pub(super) fn granted_experimental(listed: &[String]) -> Vec<String> {
    listed.iter().filter(|name| EXPERIMENTAL_APIS.contains(&name.as_str())).cloned().collect()
}

fn require_enabled() -> DevResult<()> {
    if lock(&DEV).enabled {
        Ok(())
    } else {
        Err((403, "Development mode is off: turn it on in Settings > Plugins > Developer.".into()))
    }
}

fn require_loaded(id: &str) -> DevResult<()> {
    require_enabled()?;
    if is_dev(id) {
        Ok(())
    } else {
        Err((404, format!("No development plugin \"{id}\" is loaded.")))
    }
}

fn internal(error: String) -> (u16, String) {
    (500, error)
}

pub(super) fn snapshot() -> DevSnapshot {
    let remembered = dev_recent::read();
    let state = lock(&DEV);
    DevSnapshot {
        enabled: state.enabled,
        plugins: state.plugins.iter().map(|(id, path)| DevPlugin { id: id.clone(), path: path.display().to_string() }).collect(),
        recent: remembered
            .plugins
            .into_iter()
            .filter(|plugin| !state.plugins.contains_key(&plugin.id))
            .map(|plugin| DevPlugin { id: plugin.id, path: plugin.path })
            .collect(),
        restores: cfg!(debug_assertions),
    }
}

pub(super) fn set_enabled(enabled: bool) -> Result<(), String> {
    let unloaded: Vec<String> = {
        let mut state = lock(&DEV);
        state.enabled = enabled;
        if enabled {
            Vec::new()
        } else {
            std::mem::take(&mut state.plugins).into_keys().collect()
        }
    };
    if enabled && cfg!(debug_assertions) {
        restore();
    }
    if unloaded.is_empty() {
        return Ok(());
    }
    for id in &unloaded {
        stop_plugin(id)?;
    }
    rescan()
}

const PLUGINS_ENV: &str = "FUYU_DEV_PLUGINS";

pub(super) fn start_in_debug_build() {
    if !cfg!(debug_assertions) {
        return;
    }
    let listed = std::env::var(PLUGINS_ENV).unwrap_or_default();
    let repo = Path::new(env!("CARGO_MANIFEST_DIR")).parent().map(Path::to_path_buf).unwrap_or_default();
    let folders = listed_folders(&listed, &repo);
    let _ = std::thread::Builder::new().name("plugin-dev-start".into()).spawn(move || {
        if let Err(error) = set_enabled(true) {
            eprintln!("could not turn on development mode: {error}");
            return;
        }
        for folder in folders {
            let path = folder.display().to_string();
            if let Err((_, error)) = load(&path) {
                eprintln!("{PLUGINS_ENV}: could not load {path}: {error}");
            }
        }
    });
}

pub(super) fn listed_folders(listed: &str, repo: &Path) -> Vec<PathBuf> {
    listed
        .split(';')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(|part| {
            let path = PathBuf::from(part);
            if path.is_absolute() { path } else { repo.join(path) }
        })
        .collect()
}

fn restore() {
    for path in dev_recent::read().to_restore() {
        if let Err((_, error)) = load(&path) {
            eprintln!("could not load the development plugin in {path} again: {error}");
        }
    }
}

pub(super) fn forget(path: &str) {
    dev_recent::change(|remembered| {
        remembered.forget(path);
    });
}

pub(super) fn load(path: &str) -> DevResult<String> {
    require_enabled()?;
    let host = host().map_err(internal)?;
    let dir = fs::canonicalize(path).map_err(|error| (400, format!("{path}: {error}")))?;
    let dir = PathBuf::from(dir.display().to_string().trim_start_matches(r"\\?\"));
    let manifest = read_manifest(&dir, &app_version(&host.app)).map_err(|error| (400, error))?;
    if builtin::is_builtin(&manifest.id) {
        return Err((400, "This id belongs to a plugin built into Fuyu.".into()));
    }
    let id = manifest.id;
    let shown = dir.display().to_string();
    lock(&DEV).plugins.insert(id.clone(), dir);
    dev_recent::change(|remembered| remembered.loaded(&id, &shown));
    stop_plugin(&id).map_err(internal)?;
    lock(&host.runtimes).remove(&id);
    rescan().map_err(internal)?;
    Ok(id)
}

pub(super) fn reload(id: &str) -> DevResult<()> {
    require_loaded(id)?;
    stop_plugin(id).map_err(internal)?;
    rescan().map_err(internal)
}

pub(super) fn unload(id: &str) -> DevResult<bool> {
    require_enabled()?;
    let removed = lock(&DEV).plugins.remove(id).is_some();
    dev_recent::change(|remembered| remembered.unloaded(id));
    if removed {
        stop_plugin(id).map_err(internal)?;
        rescan().map_err(internal)?;
    }
    Ok(removed)
}

pub(super) fn log_since(id: &str, after: u64) -> DevResult<Value> {
    require_loaded(id)?;
    let host = host().map_err(internal)?;
    let runtimes = lock(&host.runtimes);
    let Some(info) = runtimes.get(id) else {
        return Ok(json!({ "lines": [], "next": after, "status": "stopped", "error": null }));
    };
    let lines = lines_after(&info.log, info.log_seq, after);
    Ok(json!({ "lines": lines, "next": info.log_seq, "status": info.status, "error": info.error }))
}

pub(super) fn lines_after(log: &VecDeque<String>, log_seq: u64, after: u64) -> Vec<Value> {
    let first = (log_seq + 1).saturating_sub(log.len() as u64);
    log.iter()
        .zip(first..)
        .filter(|(_, seq)| *seq > after)
        .map(|(text, seq)| json!({ "seq": seq, "text": text }))
        .collect()
}

pub(super) fn trace(id: &str) -> Result<Vec<TraceEntry>, String> {
    let host = host()?;
    Ok(lock(&host.runtimes).get(id).map(|info| info.trace.iter().cloned().collect()).unwrap_or_default())
}

pub(super) fn send_event(id: &str, name: &str, payload: Value) -> Result<(), String> {
    if !is_dev(id) {
        return Err("Events can only be sent to development plugins.".into());
    }
    let host = host()?;
    let supervisors = lock(&host.supervisors);
    let supervisor = supervisors.get(id).ok_or("The plugin is not running.")?;
    supervisor.notify("event", json!({ "name": name, "payload": payload }))
}

pub(crate) fn answer_local_api(method: &str, params: &Value) -> DevResult<Value> {
    let text = |key: &str| params.get(key).and_then(Value::as_str).unwrap_or_default().to_string();
    match method {
        "dev.load" => {
            let path = text("path");
            if path.is_empty() {
                return Err((400, "Expected { path }: the plugin's folder.".into()));
            }
            let id = load(&path)?;
            Ok(json!({ "id": id, "path": lock(&DEV).plugins.get(&id).map(|dir| dir.display().to_string()) }))
        }
        "dev.reload" => reload(&text("id")).map(|()| json!({ "id": text("id") })),
        "dev.unload" => unload(&text("id")).map(|removed| json!({ "removed": removed })),
        "dev.log" => log_since(&text("id"), params.get("after").and_then(Value::as_u64).unwrap_or(0)),
        _ => Err((404, "Unknown path.".into())),
    }
}

fn plain<T>(result: DevResult<T>) -> Result<T, String> {
    result.map_err(|(_, message)| message)
}

async fn blocking<T: Send + 'static>(change: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<DevSnapshot, String> {
    tauri::async_runtime::spawn_blocking(change)
        .await
        .map_err(|error| format!("The development task failed: {error}"))??;
    Ok(snapshot())
}

#[tauri::command]
pub fn get_plugin_dev_state() -> DevSnapshot {
    snapshot()
}

#[tauri::command]
pub async fn set_plugin_dev_mode(enabled: bool) -> Result<DevSnapshot, String> {
    blocking(move || set_enabled(enabled)).await
}

#[tauri::command]
pub async fn load_dev_plugin(path: String) -> Result<DevSnapshot, String> {
    blocking(move || plain(load(&path))).await
}

#[tauri::command]
pub async fn reload_dev_plugin(id: String) -> Result<DevSnapshot, String> {
    blocking(move || plain(reload(&id))).await
}

#[tauri::command]
pub async fn unload_dev_plugin(id: String) -> Result<DevSnapshot, String> {
    blocking(move || plain(unload(&id))).await
}

#[tauri::command]
pub async fn forget_dev_plugin(path: String) -> Result<DevSnapshot, String> {
    blocking(move || {
        forget(&path);
        Ok(())
    })
    .await
}

#[tauri::command]
pub fn get_plugin_rpc_trace(id: String) -> Result<Vec<TraceEntry>, String> {
    trace(&id)
}

#[tauri::command]
pub fn send_plugin_dev_event(id: String, name: String, payload: Value) -> Result<(), String> {
    send_event(&id, &name, payload)
}
