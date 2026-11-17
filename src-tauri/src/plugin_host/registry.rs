use serde::Serialize;
use serde_json::{Map, Value};
use std::{collections::BTreeMap, fs, path::PathBuf};

use super::store::WindowRules;
use super::{
    app_version, builtin, dev,
    grants::sync_processes,
    host, keybindings, lock,
    manifest::{parse_manifest, read_manifest_text, runtime_requirement, LocalizedText, PluginCommand, PluginRuntime, MANIFEST_FILE_NAME},
    market,
    permissions::missing_permissions,
    runtime::{self, CallRecord, Resources, RuntimeStatus},
    sensitive::SensitiveChoice,
    settings::{self, InfoItem, SettingSpec},
    updates, InstalledPlugin, PluginHost,
};

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(test, derive(Default))]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    id: String,
    builtin: bool,
    dev: bool,
    invalid_reason: Option<String>,
    name: Option<LocalizedText>,
    description: Option<LocalizedText>,
    version: String,
    author: String,
    homepage: String,
    permissions: Vec<String>,
    optional_permissions: Vec<String>,
    commands: Vec<PluginCommand>,
    runtime: &'static str,
    platforms: Vec<String>,
    webview: bool,
    has_process: bool,
    enabled: bool,
    needs_approval: bool,
    status: RuntimeStatus,
    error: Option<String>,
    log: Vec<String>,
    calls: Vec<CallRecord>,
    settings_schema: Vec<SettingSpec>,
    settings: Map<String, Value>,
    info: Vec<InfoItem>,
    notifications_muted: bool,
    window_rules: WindowRules,
    keybinding_conflicts: Vec<String>,
    keybindings: BTreeMap<String, String>,
    sensitive: BTreeMap<String, SensitiveChoice>,
    activation: &'static str,
    activation_events: Vec<String>,
    startup_ms: Option<u64>,
    resources: Option<Resources>,
    keep_alive: Option<String>,
    revoked: Option<LocalizedText>,
    update_available: Option<String>,
    auto_updated: Option<String>,
    update_failed: Option<String>,
    pre_release: bool,
    memory_limit_mb: u32,
    pre_release_available: Option<String>,
    author_key: Option<String>,
    signing_key_changed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(test, derive(Default))]
#[serde(rename_all = "camelCase")]
pub struct PluginsSnapshot {
    allow_third_party: bool,
    node_available: bool,
    powershell_available: bool,
    plugins_dir: String,
    plugins: Vec<PluginInfo>,
    auto_update: bool,
    trusted_publishers: Vec<String>,
    broken_state_backup: Option<String>,
}

pub(super) fn scan(plugins_dir: &PathBuf, app_version: &str) -> Vec<InstalledPlugin> {
    let mut plugins: Vec<InstalledPlugin> = builtin::manifests(app_version)
        .into_iter()
        .map(|(id, manifest)| InstalledPlugin {
            folder: id.to_string(),
            dir: PathBuf::new(),
            manifest,
            builtin: true,
            dev: false,
        })
        .collect();
    plugins.extend(scan_folder(plugins_dir, app_version));
    plugins
}

fn scan_folder(plugins_dir: &PathBuf, app_version: &str) -> Vec<InstalledPlugin> {
    let development = dev::plugins();
    let mut found: Vec<InstalledPlugin> = development
        .iter()
        .map(|(id, dir)| InstalledPlugin {
            folder: id.clone(),
            dir: dir.clone(),
            manifest: dev::read_manifest(dir, app_version).and_then(|manifest| {
                if &manifest.id == id { Ok(manifest) } else { Err(format!("The id changed to \"{}\"; load the folder again.", manifest.id)) }
            }),
            builtin: false,
            dev: true,
        })
        .collect();
    let Ok(entries) = fs::read_dir(plugins_dir) else {
        return found;
    };
    let mut installed: Vec<InstalledPlugin> = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
        .filter(|entry| !entry.file_name().to_string_lossy().starts_with(market::WORK_DIR_PREFIX))
        .map(|entry| {
            let folder = entry.file_name().to_string_lossy().into_owned();
            let dir = entry.path();
            let manifest = if builtin::is_builtin(&folder) {
                Err("This id belongs to a plugin built into Fuyu.".to_string())
            } else {
                read_manifest_text(&dir)
                    .map_err(|error| format!("Could not read {MANIFEST_FILE_NAME}: {error}"))
                    .and_then(|text| parse_manifest(&text, &folder, app_version))
                    .and_then(dev::check_installed)
            };
            InstalledPlugin { folder, dir, manifest, builtin: false, dev: false }
        })
        .filter(|plugin| !development.iter().any(|(id, _)| *id == plugin.folder))
        .collect();
    found.append(&mut installed);
    found.sort_by(|left, right| left.folder.cmp(&right.folder));
    found
}

pub(super) fn rescan() -> Result<(), String> {
    let host = host()?;
    *lock(&host.installed) = scan(&host.plugins_dir, &app_version(&host.app));
    sync_processes()
}

pub(super) fn installed_version(host: &PluginHost, id: &str) -> Option<String> {
    lock(&host.installed)
        .iter()
        .find(|plugin| plugin.folder == id)
        .map(|plugin| plugin.manifest.as_ref().map(|manifest| manifest.version.clone()).unwrap_or_default())
}

pub(super) fn snapshot() -> Result<PluginsSnapshot, String> {
    let host = host()?;
    let state = lock(&host.state).clone();
    let runtimes = lock(&host.runtimes).clone();
    let plugins = lock(&host.installed)
        .iter()
        .map(|plugin| {
            let runtime = runtimes.get(&plugin.folder).cloned().unwrap_or_default();
            let grant = state.plugins.get(&plugin.folder).cloned().unwrap_or_default();
            let mut info = PluginInfo {
                id: plugin.folder.clone(),
                builtin: plugin.builtin,
                dev: plugin.dev,
                invalid_reason: None,
                name: None,
                description: None,
                version: String::new(),
                author: String::new(),
                homepage: String::new(),
                permissions: Vec::new(),
                optional_permissions: Vec::new(),
                commands: Vec::new(),
                runtime: "none",
                platforms: Vec::new(),
                webview: false,
                has_process: false,
                enabled: grant.enabled || plugin.dev,
                needs_approval: false,
                status: runtime.status,
                error: runtime.error,
                log: runtime.log.into_iter().collect(),
                calls: runtime.calls.into_iter().rev().collect(),
                settings_schema: Vec::new(),
                settings: Map::new(),
                info: runtime.info,
                notifications_muted: grant.notifications_muted,
                window_rules: grant.window_rules,
                keybinding_conflicts: keybindings::conflicts(&plugin.folder),
                keybindings: grant.keybindings.clone(),
                sensitive: grant.sensitive.clone(),
                activation: "startup",
                activation_events: Vec::new(),
                startup_ms: runtime.startup_ms,
                resources: runtime.resources,
                keep_alive: runtime.keep_alive.clone(),
                revoked: None,
                update_available: None,
                auto_updated: None,
                update_failed: None,
                pre_release: grant.pre_release,
                memory_limit_mb: super::lifecycle::memory_limit_mb(grant.memory_limit_mb),
                pre_release_available: None,
                author_key: grant.author_keys.first().cloned(),
                signing_key_changed: false,
            };
            if !plugin.builtin && !plugin.dev {
                (info.update_available, info.auto_updated, info.pre_release_available) = updates::status_for(&plugin.folder);
                info.signing_key_changed = updates::signing_key_changed(&plugin.folder);
                info.update_failed = updates::update_failure(&plugin.folder);
            }
            match &plugin.manifest {
                Ok(manifest) => {
                    info.needs_approval = grant.enabled
                        && !plugin.dev
                        && !missing_permissions(&manifest.permissions, &grant.granted_permissions).is_empty();
                    info.name = Some(manifest.name.clone());
                    info.description = Some(manifest.description.clone());
                    info.version = manifest.version.clone();
                    info.author = manifest.author.clone();
                    info.homepage = manifest.homepage.clone();
                    info.permissions = manifest.permissions.clone();
                    info.optional_permissions = manifest.optional_permissions.clone();
                    info.commands = manifest.contributes.commands.clone();
                    info.has_process = matches!(manifest.runtime, PluginRuntime::Process { .. } | PluginRuntime::Builtin);
                    info.runtime = runtime_requirement(&manifest.runtime);
                    info.platforms = super::manifest::platforms_of(&manifest.platforms, info.runtime);
                    info.webview = manifest.contributes.views.iter().any(|view| view.template == super::view_specs::ViewTemplate::Webview);
                    info.settings_schema = manifest.contributes.settings.clone();
                    info.settings = settings::resolve(&manifest.contributes.settings, &grant.settings);
                    info.activation = if manifest.activation.is_eager() { "startup" } else { "onDemand" };
                    info.activation_events = manifest.activation.events.iter().map(|event| event.label()).collect();
                    if !plugin.builtin && !plugin.dev {
                        info.revoked = updates::revoked_reason(&state, &plugin.folder, &manifest.version);
                    }
                }
                Err(reason) => info.invalid_reason = Some(reason.clone()),
            }
            info
        })
        .collect();
    Ok(PluginsSnapshot {
        allow_third_party: state.allow_third_party,
        node_available: runtime::find_node().is_some(),
        powershell_available: runtime::powershell_available(),
        plugins_dir: host.plugins_dir.display().to_string(),
        plugins,
        auto_update: state.auto_update,
        trusted_publishers: state.trusted_publishers.clone(),
        broken_state_backup: host.broken_state_backup.as_ref().map(|path| path.display().to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::{InfoItem, LocalizedText, PluginInfo, PluginsSnapshot};

    #[test]
    fn snapshot_never_carries_secret_info_values() {
        let token = "f3a9c2e1d4b5a6978877665544332211f3a9c2e1d4b5a6978877665544332211";
        let snapshot = PluginsSnapshot {
            plugins: vec![PluginInfo {
                id: "focusd.local-api".into(),
                info: vec![
                    InfoItem::new(LocalizedText::new("地址", "Address"), "http://127.0.0.1:39271/v1".into(), true, false),
                    InfoItem::new(LocalizedText::new("访问令牌", "Access token"), token.into(), true, true),
                ],
                ..PluginInfo::default()
            }],
            ..PluginsSnapshot::default()
        };
        let json = serde_json::to_value(&snapshot).expect("serializes");
        assert!(!json.to_string().contains(token));
        let info = &json["plugins"][0]["info"];
        assert_eq!(info[0]["value"], "http://127.0.0.1:39271/v1");
        assert_eq!(info[1]["value"], "");
        assert_eq!(info[1]["hasValue"], true);
        assert_eq!(info[1]["secret"], true);
    }
}
