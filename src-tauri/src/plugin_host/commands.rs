use serde::Serialize;
use serde_json::{json, Map, Value};
use std::{fs, time::Duration};

use super::{
    app_version,
    author_signing::KeyCheck,
    builtin,
    grants::{stop_all, stop_plugin, sync_processes, update_state},
    host, lifecycle, lock,
    manifest::LocalizedText,
    market, menus, notify, revocations, sensitive, updates,
    registry::{installed_version, rescan, scan, snapshot, PluginsSnapshot},
    runtime, settings, storage,
    views::{self, PluginViewsSnapshot},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketPlugin {
    #[serde(flatten)]
    entry: market::MarketEntry,
    installed_version: Option<String>,
    incompatible: Option<String>,
    revoked: Option<LocalizedText>,
    signed_by: Option<String>,
    signing_key_changed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketSnapshot {
    index_url: String,
    node_available: bool,
    powershell_available: bool,
    plugins: Vec<MarketPlugin>,
    trusted_publishers: Vec<String>,
    official_publisher: &'static str,
}

const MARKET_REUSE_FOR: Duration = Duration::from_secs(10 * 60);
const MARKET_SHOW_CACHED_FOR: Duration = Duration::from_secs(24 * 60 * 60);

#[tauri::command]
pub async fn get_plugin_market() -> Result<MarketSnapshot, String> {
    let data = market::fetch_market().await?;
    let absorbed = data.clone();
    tauri::async_runtime::spawn_blocking(move || updates::absorb(&absorbed))
        .await
        .map_err(|error| format!("The market task failed: {error}"))??;
    market_snapshot(data)
}

#[tauri::command]
pub fn get_cached_plugin_market() -> Result<Option<MarketSnapshot>, String> {
    market::recent_market(MARKET_SHOW_CACHED_FOR).map(market_snapshot).transpose()
}

fn market_snapshot(data: market::MarketData) -> Result<MarketSnapshot, String> {
    let host = host()?;
    let version = app_version(&host.app);
    let state = lock(&host.state).clone();
    let plugins = data
        .entries
        .iter()
        .map(|entry| {
            let installed_version = installed_version(host, &entry.id);
            let target = data.entry_for(&entry.id, updates::wants_pre_release(&state, &entry.id)).unwrap_or(entry);
            MarketPlugin {
                signing_key_changed: installed_version.is_some() && updates::key_check(&state, target) == Some(KeyCheck::Changed),
                installed_version,
                signed_by: entry.signer().ok().flatten(),
                incompatible: market::incompatibility(entry, &version),
                revoked: revocations::find(&data.revoked, &entry.id, &entry.version).map(|item| item.reason.clone()),
                entry: entry.clone(),
            }
        })
        .collect();
    Ok(MarketSnapshot {
        index_url: market::INDEX_URL.to_string(),
        node_available: runtime::find_node().is_some(),
        powershell_available: runtime::powershell_available(),
        plugins,
        trusted_publishers: lock(&host.state).trusted_publishers.clone(),
        official_publisher: market::OFFICIAL_PUBLISHER,
    })
}

#[tauri::command]
pub async fn install_market_plugin(id: String, accept_key_change: Option<bool>) -> Result<PluginsSnapshot, String> {
    if builtin::is_builtin(&id) {
        return Err("This plugin is built into Fuyu.".into());
    }
    let host = host()?;
    let version = app_version(&host.app);
    let data = match market::recent_market(MARKET_REUSE_FOR) {
        Some(data) => data,
        None => market::fetch_market().await?,
    };
    let pre_release = updates::wants_pre_release(&lock(&host.state), &id);
    let entry = data
        .entry_for(&id, pre_release)
        .cloned()
        .ok_or("The plugin is no longer in the market.")?;
    if let Some(reason) = market::incompatibility(&entry, &version).or_else(|| updates::install_refusal(&entry, &data.revoked)) {
        return Err(reason);
    }
    let bytes = market::fetch_package(&entry).await?;
    let accept = accept_key_change.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || updates::install_entry(&entry, &bytes, accept))
        .await
        .map_err(|error| format!("The install task failed: {error}"))??;
    snapshot()
}

#[tauri::command]
pub async fn uninstall_plugin(id: String) -> Result<PluginsSnapshot, String> {
    if builtin::is_builtin(&id) {
        return Err("Built-in plugins cannot be uninstalled; switch it off instead.".into());
    }
    let host = host()?;
    let dir = lock(&host.installed)
        .iter()
        .find(|plugin| plugin.folder == id)
        .map(|plugin| plugin.dir.clone())
        .ok_or("Plugin not found.")?;
    tauri::async_runtime::spawn_blocking(move || {
        stop_plugin(&id)?;
        fs::remove_dir_all(&dir).map_err(|error| format!("Could not delete {} (is a file in it open?): {error}", dir.display()))?;
        update_state(|state, _| {
            state.plugins.remove(&id);
            Ok(())
        })?;
        lock(&host.runtimes).remove(&id);
        super::webviews::forget_plugin(&id);
        rescan()
    })
    .await
    .map_err(|error| format!("The uninstall task failed: {error}"))??;
    snapshot()
}

#[tauri::command]
pub fn list_plugins() -> Result<PluginsSnapshot, String> {
    snapshot()
}

#[tauri::command]
pub async fn set_plugins_allowed(allowed: bool) -> Result<PluginsSnapshot, String> {
    update_state(|state, _| {
        state.allow_third_party = allowed;
        Ok(())
    })?;
    sync_processes()?;
    snapshot()
}

#[tauri::command]
pub async fn set_plugin_enabled(id: String, enabled: bool) -> Result<PluginsSnapshot, String> {
    update_state(|state, installed| {
        let plugin = installed.iter().find(|plugin| plugin.folder == id).ok_or("Plugin not found.")?;
        if enabled {
            let manifest = plugin.manifest.as_ref().map_err(Clone::clone)?;
            if let Some(item) = revocations::find(&state.revoked, &id, &manifest.version).filter(|_| !plugin.dev) {
                return Err(format!("This version was taken off the market: {}", item.reason.en()));
            }
            let grant = state.plugins.entry(id.clone()).or_default();
            grant.granted_permissions = manifest.permissions.clone();
        }
        let grant = state.plugins.entry(id.clone()).or_default();
        grant.enabled = enabled;
        Ok(())
    })?;
    if !enabled {
        lock(&host()?.runtimes).remove(&id);
    }
    sync_processes()?;
    snapshot()
}

#[tauri::command]
pub async fn reload_plugins() -> Result<PluginsSnapshot, String> {
    let host = host()?;
    stop_all()?;
    *lock(&host.installed) = scan(&host.plugins_dir, &app_version(&host.app));
    lock(&host.runtimes).retain(|id, _| builtin::is_builtin(id));
    sync_processes()?;
    snapshot()
}

#[tauri::command]
pub fn open_plugins_folder() -> Result<(), String> {
    let host = host()?;
    tauri_plugin_opener::open_path(&host.plugins_dir, None::<&str>).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn run_plugin_command(id: String, command: String) -> Result<(), String> {
    let host = host()?;
    if builtin::is_builtin(&id) {
        if !lock(&host.builtins_running).contains(&id) {
            return Err("The plugin is not running.".into());
        }
        let info = builtin::run_command(&id, &command)?;
        lock(&host.runtimes).entry(id).or_default().info = info;
        return Ok(());
    }
    let known = lock(&host.installed).iter().any(|plugin| {
        plugin.folder == id
            && plugin
                .manifest
                .as_ref()
                .is_ok_and(|manifest| manifest.contributes.commands.iter().any(|item| item.id() == command))
    });
    if !known {
        return Err("Unknown plugin command.".into());
    }
    lifecycle::deliver(&id, format!("onCommand:{command}"), "command", json!({ "id": command }))
}

pub(super) fn store_settings(id: &str, values: &Map<String, Value>) -> Result<Map<String, Value>, String> {
    let mut resolved = Map::new();
    update_state(|state, installed| {
        let manifest = installed
            .iter()
            .find(|plugin| plugin.folder == id)
            .and_then(|plugin| plugin.manifest.as_ref().ok())
            .ok_or("Plugin not found.")?;
        let specs = &manifest.contributes.settings;
        let mut checked = Vec::with_capacity(values.len());
        for (key, value) in values {
            let spec = specs
                .iter()
                .find(|spec| spec.key() == key)
                .ok_or_else(|| format!("\"{key}\" is not one of the plugin's contributes.settings."))?;
            checked.push((key.clone(), settings::coerce(spec, value).map_err(|error| format!("\"{key}\" {error}."))?));
        }
        let grant = state.plugins.entry(id.to_string()).or_default();
        grant.settings.extend(checked);
        resolved = settings::resolve(specs, &grant.settings);
        Ok(())
    })?;
    Ok(resolved)
}

#[tauri::command]
pub fn set_plugin_setting(id: String, key: String, value: Value) -> Result<PluginsSnapshot, String> {
    let host = host()?;
    let mut values = Map::new();
    values.insert(key, value);
    let resolved = store_settings(&id, &values)?;
    if lock(&host.builtins_running).contains(&id) {
        builtin::settings_changed(&id, &resolved)?;
        views::runtime_changed(&host.app, &id, runtime::RuntimeStatus::Running);
    } else {
        let supervisors = lock(&host.supervisors);
        match supervisors.get(&id) {
            Some(supervisor) => supervisor.update_settings(resolved),
            None => {
                drop(supervisors);
                lifecycle::wake_for_settings(&id);
            }
        }
    }
    snapshot()
}

#[tauri::command]
pub fn run_plugin_notification_action(id: String, action: String) -> Result<(), String> {
    if !notify::is_action_id(&action) {
        return Err("Unknown notification action.".into());
    }
    lifecycle::deliver(&id, "notification.action".into(), "notification.action", json!({ "id": action }))
}

#[tauri::command]
pub fn list_plugin_menu(menu: String) -> Result<Vec<menus::PluginMenuEntry>, String> {
    menus::entries(&menu)
}

#[tauri::command]
pub fn run_plugin_menu_command(id: String, menu: String, command: String, todo_id: String) -> Result<(), String> {
    menus::run(&id, &menu, &command, &todo_id)
}

#[tauri::command]
pub fn run_plugin_item_menu_command(id: String, menu: String, command: String, item_id: String) -> Result<(), String> {
    menus::run(&id, &menu, &command, &item_id)
}

#[tauri::command]
pub fn answer_plugin_permission(request_id: u64, answer: String) -> Result<(), String> {
    let answer = sensitive::Answer::parse(&answer).ok_or("Unknown answer.")?;
    sensitive::answer(request_id, answer);
    Ok(())
}

#[tauri::command]
pub fn revoke_plugin_sensitive_permission(id: String, permission: String) -> Result<PluginsSnapshot, String> {
    sensitive::revoke(&id, &permission)?;
    snapshot()
}

#[tauri::command]
pub fn set_plugin_notifications_muted(id: String, muted: bool) -> Result<PluginsSnapshot, String> {
    update_state(|state, installed| {
        if !installed.iter().any(|plugin| plugin.folder == id) {
            return Err("Plugin not found.".into());
        }
        state.plugins.entry(id.clone()).or_default().notifications_muted = muted;
        Ok(())
    })?;
    snapshot()
}

#[tauri::command]
pub fn set_plugin_memory_limit(id: String, megabytes: u32) -> Result<PluginsSnapshot, String> {
    if !super::lifecycle::MEMORY_LIMIT_CHOICES_MB.contains(&megabytes) {
        return Err(format!("A memory limit is one of {:?} MB.", super::lifecycle::MEMORY_LIMIT_CHOICES_MB));
    }
    update_state(|state, installed| {
        if !installed.iter().any(|plugin| plugin.folder == id && !plugin.builtin) {
            return Err("Plugin not found.".into());
        }
        let grant = state.plugins.entry(id.clone()).or_default();
        grant.memory_limit_mb = (megabytes != super::lifecycle::DEFAULT_MEMORY_LIMIT_MB).then_some(megabytes);
        Ok(())
    })?;
    snapshot()
}

#[tauri::command]
pub fn set_plugin_keybinding(id: String, command: String, keybinding: Option<String>) -> Result<PluginsSnapshot, String> {
    let keybinding = match keybinding.as_deref().map(str::trim) {
        None => None,
        Some("") => Some(String::new()),
        Some(text) => Some(
            crate::clipboard_history::parse_shortcut_binding(text)
                .ok_or_else(|| format!("\"{text}\" is not a shortcut: use modifiers and one key, like \"Ctrl+Alt+P\"."))?
                .label,
        ),
    };
    update_state(|state, installed| {
        let known = installed
            .iter()
            .find(|plugin| plugin.folder == id)
            .and_then(|plugin| plugin.manifest.as_ref().ok())
            .is_some_and(|manifest| manifest.contributes.commands.iter().any(|item| item.id() == command));
        if !known {
            return Err("The plugin has no such command.".into());
        }
        let grant = state.plugins.entry(id.clone()).or_default();
        match keybinding {
            Some(keybinding) => grant.keybindings.insert(command, keybinding),
            None => grant.keybindings.remove(&command),
        };
        Ok(())
    })?;
    super::keybindings::refresh();
    snapshot()
}

#[tauri::command]
pub async fn clear_plugin_data(id: String) -> Result<PluginsSnapshot, String> {
    if builtin::is_builtin(&id) {
        return Err("Built-in plugins keep no plugin data.".into());
    }
    let host = host()?;
    if !lock(&host.installed).iter().any(|plugin| plugin.folder == id) {
        return Err("Plugin not found.".into());
    }
    let data_dir = host.data_dir.join(&id);
    tauri::async_runtime::spawn_blocking(move || {
        stop_plugin(&id)?;
        let cleared = storage::clear_plugin_data(&id, &data_dir);
        sync_processes()?;
        cleared
    })
    .await
    .map_err(|error| format!("The clear task failed: {error}"))??;
    snapshot()
}

fn notify_view(id: &str, view_id: &str, method: &str, params: Value) -> Result<(), String> {
    if !views::declares_view(id, view_id) {
        return Err("Unknown plugin view.".into());
    }
    lifecycle::deliver(id, format!("onView:{view_id}"), method, params)
}

#[tauri::command]
pub fn list_plugin_views() -> Result<PluginViewsSnapshot, String> {
    views::snapshot()
}

#[tauri::command]
pub fn set_plugin_view_visible(id: String, view_id: String, visible: bool) -> Result<Option<Value>, String> {
    if !views::declares_view(&id, &view_id) {
        return Err("Unknown plugin view.".into());
    }
    let model = views::set_visible(&id, &view_id, visible);
    let params = json!({ "viewId": view_id, "visible": visible });
    if visible {
        let _ = notify_view(&id, &view_id, "view.visible", params);
    } else if let Some(supervisor) = lock(&host()?.supervisors).get(&id).filter(|supervisor| supervisor.is_ready()) {
        let _ = supervisor.notify("view.visible", params);
    }
    Ok(model)
}

#[tauri::command]
pub fn run_plugin_view_action(id: String, view_id: String, item_id: Option<String>, action_id: String, checked: Option<bool>) -> Result<(), String> {
    if !views::is_action_id(&action_id) || item_id.as_deref().is_some_and(|item| !views::is_action_id(item)) {
        return Err("Unknown plugin view action.".into());
    }
    let mut params = json!({ "viewId": view_id, "actionId": action_id });
    if let Some(item) = item_id {
        params["itemId"] = json!(item);
    }
    if let Some(checked) = checked {
        params["checked"] = json!(checked);
    }
    notify_view(&id, &view_id, "view.action", params)
}

#[tauri::command]
pub fn submit_plugin_view(id: String, view_id: String, values: Value) -> Result<(), String> {
    views::check_view_values(&values)?;
    notify_view(&id, &view_id, "view.submit", json!({ "viewId": view_id, "values": values }))
}

#[tauri::command]
pub fn search_plugin_view(id: String, view_id: String, query: String) -> Result<(), String> {
    views::check_query(&query)?;
    notify_view(&id, &view_id, "view.search", json!({ "viewId": view_id, "query": query }))
}

#[tauri::command]
pub async fn restart_plugin(id: String) -> Result<(), String> {
    if builtin::is_builtin(&id) {
        return Err("Built-in plugins cannot be restarted here.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        stop_plugin(&id)?;
        sync_processes()
    })
    .await
    .map_err(|error| format!("The restart task failed: {error}"))?
}
