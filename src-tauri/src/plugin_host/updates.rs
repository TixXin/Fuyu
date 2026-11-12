use std::{
    collections::{BTreeMap, BTreeSet},
    sync::Mutex,
    thread,
    time::Duration,
};

use super::{
    app_version,
    author_signing::KeyCheck,
    grants::{stop_plugin, update_state},
    host, lock,
    manifest::{version_at_least, LocalizedText},
    market::{self, MarketData, MarketEntry, OFFICIAL_PUBLISHER},
    registry::{rescan, snapshot, PluginsSnapshot},
    revocations,
    store::PluginsState,
};

const FIRST_CHECK_AFTER: Duration = Duration::from_secs(30);
const CHECK_EVERY: Duration = Duration::from_secs(6 * 60 * 60);

#[derive(Default)]
struct Status {
    available: BTreeMap<String, String>,
    updated: BTreeMap<String, String>,
    pre_releases: BTreeMap<String, String>,
    key_changed: BTreeSet<String>,
}

static STATUS: Mutex<Status> = Mutex::new(Status {
    available: BTreeMap::new(),
    updated: BTreeMap::new(),
    pre_releases: BTreeMap::new(),
    key_changed: BTreeSet::new(),
});

pub(super) fn key_check(state: &PluginsState, entry: &MarketEntry) -> Option<KeyCheck> {
    let remembered = state.plugins.get(&entry.id).map(|grant| grant.author_keys.as_slice()).unwrap_or_default();
    entry.key_check(remembered).ok()
}

pub(super) fn signing_key_changed(id: &str) -> bool {
    lock(&STATUS).key_changed.contains(id)
}

pub(super) fn wants_pre_release(state: &PluginsState, id: &str) -> bool {
    state.plugins.get(id).is_some_and(|grant| grant.pre_release)
}

pub(super) fn status_for(id: &str) -> (Option<String>, Option<String>, Option<String>) {
    let status = lock(&STATUS);
    (status.available.get(id).cloned(), status.updated.get(id).cloned(), status.pre_releases.get(id).cloned())
}

pub(super) fn trusts(state: &PluginsState, publisher: &str) -> bool {
    publisher == OFFICIAL_PUBLISHER || state.trusted_publishers.iter().any(|name| name == publisher)
}

fn is_valid_publisher(name: &str) -> bool {
    (1..=39).contains(&name.len()) && name.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

pub(super) fn absorb(data: &MarketData) -> Result<Vec<MarketEntry>, String> {
    revocations::apply(data.revoked.clone())?;
    let host = host()?;
    let version = app_version(&host.app);
    let state = lock(&host.state).clone();
    let mut available = BTreeMap::new();
    let mut pre_releases = BTreeMap::new();
    let mut key_changed = BTreeSet::new();
    let mut automatic = Vec::new();
    for plugin in lock(&host.installed).iter().filter(|plugin| !plugin.builtin && !plugin.dev) {
        let Ok(manifest) = &plugin.manifest else { continue };
        if let Some(pre) = data.pre_release_of(&plugin.folder) {
            pre_releases.insert(pre.id.clone(), pre.version.clone());
        }
        let Some(entry) = data.entry_for(&plugin.folder, wants_pre_release(&state, &plugin.folder)) else { continue };
        if !entry.is_newer_than(&manifest.version)
            || market::incompatibility(entry, &version).is_some()
            || revocations::find(&data.revoked, &entry.id, &entry.version).is_some()
        {
            continue;
        }
        available.insert(entry.id.clone(), entry.version.clone());
        let check = key_check(&state, entry);
        if check == Some(KeyCheck::Changed) {
            key_changed.insert(entry.id.clone());
        }
        let no_new_permissions = entry.permissions.iter().all(|name| manifest.permissions.contains(name));
        let signed = check.is_some_and(KeyCheck::may_install_by_itself);
        if state.auto_update && no_new_permissions && signed && trusts(&state, entry.publisher()) {
            automatic.push(entry.clone());
        }
    }
    let mut status = lock(&STATUS);
    status.available = available;
    status.pre_releases = pre_releases;
    status.key_changed = key_changed;
    Ok(automatic)
}

pub(super) fn install_entry(entry: &MarketEntry, bytes: &[u8], accept_key_change: bool) -> Result<(), String> {
    let host = host()?;
    let signer = entry.signer()?;
    let remembered = lock(&host.state).plugins.get(&entry.id).map(|grant| grant.author_keys.clone()).unwrap_or_default();
    if entry.key_check(&remembered)? == KeyCheck::Changed && !accept_key_change {
        return Err(format!(
            "{} {} is not signed with the key of the installed version; confirm the update to install it anyway.",
            entry.id, entry.version
        ));
    }
    stop_plugin(&entry.id)?;
    let installed = market::install_package(&host.plugins_dir, entry, bytes, &app_version(&host.app));
    lock(&host.runtimes).remove(&entry.id);
    rescan()?;
    installed?;
    update_state(|state, _| {
        state.plugins.entry(entry.id.clone()).or_default().author_keys = signer.into_iter().collect();
        Ok(())
    })?;
    let mut status = lock(&STATUS);
    status.available.remove(&entry.id);
    status.key_changed.remove(&entry.id);
    Ok(())
}

async fn check() -> Result<(), String> {
    let data = market::fetch_market().await?;
    let automatic = tauri::async_runtime::spawn_blocking(move || absorb(&data))
        .await
        .map_err(|error| format!("The update task failed: {error}"))??;
    for entry in automatic {
        let bytes = market::fetch_package(&entry).await?;
        let installed = entry.clone();
        tauri::async_runtime::spawn_blocking(move || install_entry(&installed, &bytes, false))
            .await
            .map_err(|error| format!("The update task failed: {error}"))??;
        lock(&STATUS).updated.insert(entry.id.clone(), entry.version.clone());
    }
    Ok(())
}

fn third_party_allowed() -> bool {
    host().is_ok_and(|host| lock(&host.state).allow_third_party)
}

pub(super) fn start() {
    let _ = thread::Builder::new().name("plugin-updates".into()).spawn(|| {
        thread::sleep(FIRST_CHECK_AFTER);
        loop {
            if third_party_allowed() {
                if let Err(error) = tauri::async_runtime::block_on(check()) {
                    eprintln!("plugin update check failed: {error}");
                }
            }
            thread::sleep(CHECK_EVERY);
        }
    });
}

pub(super) fn install_refusal(entry: &MarketEntry, revoked: &[revocations::Revocation]) -> Option<String> {
    let host = host().ok()?;
    let state = lock(&host.state);
    let revocation = revocations::find(revoked, &entry.id, &entry.version)
        .or_else(|| revocations::find(&state.revoked, &entry.id, &entry.version));
    if let Some(item) = revocation {
        return Some(format!("This version was taken off the market: {}", item.reason.en()));
    }
    let installed = lock(&host.installed)
        .iter()
        .find(|plugin| plugin.folder == entry.id && !plugin.dev)
        .and_then(|plugin| plugin.manifest.as_ref().ok().map(|manifest| manifest.version.clone()));
    if let Some(installed) = installed.filter(|installed| downgrade(installed, &entry.version)) {
        return Some(format!("Version {installed} is installed; the market offers the older {}.", entry.version));
    }
    (!trusts(&state, entry.publisher())).then(|| format!("Trust the publisher \"{}\" first.", entry.publisher()))
}

pub(super) fn downgrade(installed: &str, offered: &str) -> bool {
    installed != offered && version_at_least(installed, offered)
}

pub(super) fn revoked_reason(state: &PluginsState, id: &str, version: &str) -> Option<LocalizedText> {
    revocations::find(&state.revoked, id, version).map(|item| item.reason.clone())
}

#[tauri::command]
pub async fn set_plugin_auto_update(enabled: bool) -> Result<PluginsSnapshot, String> {
    update_state(|state, _| {
        state.auto_update = enabled;
        Ok(())
    })?;
    snapshot()
}

#[tauri::command]
pub async fn set_plugin_pre_release(id: String, enabled: bool) -> Result<PluginsSnapshot, String> {
    update_state(|state, installed| {
        if !installed.iter().any(|plugin| plugin.folder == id && !plugin.builtin && !plugin.dev) {
            return Err("Only plugins installed from the market have pre-releases.".into());
        }
        state.plugins.entry(id.clone()).or_default().pre_release = enabled;
        Ok(())
    })?;
    if let Some(data) = market::recent_market(Duration::from_secs(CHECK_EVERY.as_secs())) {
        let _ = absorb(&data);
    }
    snapshot()
}

#[tauri::command]
pub async fn set_plugin_publisher_trusted(publisher: String, trusted: bool) -> Result<PluginsSnapshot, String> {
    if !is_valid_publisher(&publisher) {
        return Err("A publisher is a GitHub user or organization name.".into());
    }
    if publisher == OFFICIAL_PUBLISHER {
        return Err("Fuyu's own plugins are always trusted.".into());
    }
    update_state(|state, _| {
        state.trusted_publishers.retain(|name| *name != publisher);
        if trusted {
            state.trusted_publishers.push(publisher.clone());
            state.trusted_publishers.sort();
        }
        Ok(())
    })?;
    snapshot()
}

#[tauri::command]
pub async fn check_plugin_updates() -> Result<PluginsSnapshot, String> {
    check().await?;
    snapshot()
}
