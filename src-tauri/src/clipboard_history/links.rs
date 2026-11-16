use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex, OnceLock,
    },
};

use reqwest::Url;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use super::{current_unix_millis, links_order};
use crate::sync::{clock, record, Clock, Hlc, Tombstone};
use crate::user_error::UserError;

pub(super) const FILE_NAME: &str = "clipboard-links.json";
const CHANGED_EVENT: &str = "clipboard-links-changed";
const VERSION: u32 = 2;
const MAX_LINKS: usize = 1_000;
const MAX_SITES: usize = 100;
const MAX_URL_CHARS: usize = 2_048;
const MAX_TITLE_CHARS: usize = 200;
const MAX_SITE_CHARS: usize = 253;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardLink {
    pub(super) id: String,
    pub(super) url: String,
    #[serde(default)]
    pub(super) title: String,
    #[serde(default)]
    pub(super) added_at: i64,
    #[serde(default)]
    pub(super) sort_key: String,
    #[serde(default, deserialize_with = "clock::lenient", skip_serializing_if = "Option::is_none")]
    pub(super) updated_at: Option<Hlc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) device_id: Option<String>,
}

impl ClipboardLink {
    fn new(url: String, title: &str) -> Self {
        Self { id: new_id(), url, title: clean_title(title), added_at: current_unix_millis(), sort_key: String::new(), updated_at: None, device_id: None }
    }

    fn bare(&self) -> Self {
        Self { updated_at: None, device_id: None, ..self.clone() }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum LinkMatching {
    #[default]
    Any,
    Web,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardLinkSettings {
    #[serde(default = "default_true")]
    pub(super) notice: bool,
    #[serde(default)]
    pub(super) matching: LinkMatching,
    #[serde(default)]
    pub(super) blocked_sites: Vec<String>,
    #[serde(default)]
    pub(super) only_sites: Vec<String>,
}

impl Default for ClipboardLinkSettings {
    fn default() -> Self {
        Self { notice: true, matching: LinkMatching::Any, blocked_sites: Vec::new(), only_sites: Vec::new() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardLinks {
    #[serde(default)]
    pub(super) version: u32,
    #[serde(default)]
    pub(super) settings: ClipboardLinkSettings,
    #[serde(default)]
    pub(super) links: Vec<ClipboardLink>,
    #[serde(default)]
    pub(super) tombstones: Vec<Tombstone>,
}

fn default_true() -> bool {
    true
}

struct Store {
    path: PathBuf,
    state: Mutex<ClipboardLinks>,
}

static STORE: OnceLock<Store> = OnceLock::new();
static NEXT_ID: AtomicU64 = AtomicU64::new(0);

fn store(app: &AppHandle) -> Result<&'static Store, String> {
    if let Some(store) = STORE.get() {
        return Ok(store);
    }
    let dir = crate::home_dir::fuyu_home(tauri::Manager::path(app))
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let path = dir.join(FILE_NAME);
    let mut links = load(&path);
    clock::with(|clock, _| fill_missing(&mut links, clock.device()));
    clock::observe(all_stamps(&links));
    let state = Mutex::new(links);
    let _ = STORE.set(Store { path, state });
    STORE.get().ok_or_else(|| "The link bookmarks could not be loaded.".to_string())
}

pub(super) fn load(path: &Path) -> ClipboardLinks {
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str::<ClipboardLinks>(&content).ok())
        .map(normalized)
        .unwrap_or_else(|| ClipboardLinks { version: VERSION, ..ClipboardLinks::default() })
}

fn save(path: &Path, links: &ClipboardLinks) -> Result<(), String> {
    let content = serde_json::to_string_pretty(links).map_err(|error| format!("Failed to write the bookmarks: {error}"))?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, content).map_err(|error| format!("Could not write {}: {error}", temporary.display()))?;
    fs::rename(&temporary, path).map_err(|error| format!("Could not write {}: {error}", path.display()))
}

pub(super) fn normalized(mut links: ClipboardLinks) -> ClipboardLinks {
    links.version = VERSION;
    links.settings = normalized_settings(links.settings);
    let mut kept: Vec<ClipboardLink> = Vec::new();
    for link in links.links {
        let Some(url) = normalized_url(&link.url) else { continue };
        if kept.iter().any(|kept| kept.url == url) || kept.len() == MAX_LINKS {
            continue;
        }
        let id = if link.id.trim().is_empty() || kept.iter().any(|kept| kept.id == link.id) { new_id() } else { link.id };
        kept.push(ClipboardLink { id, url, title: clean_title(&link.title), ..link });
    }
    if !links_order::is_ordered(kept.iter().map(|link| link.sort_key.as_str())) {
        let keys = links_order::keys_between(None, None, kept.len());
        for (link, key) in kept.iter_mut().zip(keys) {
            link.sort_key = key;
        }
    }
    links.links = kept;
    links
}

pub(super) fn fill_missing(links: &mut ClipboardLinks, device: &str) {
    for link in &mut links.links {
        let added = u64::try_from(link.added_at).unwrap_or(0);
        let stamp = link.updated_at.get_or_insert_with(|| Hlc::from_millis(added, device));
        if link.device_id.is_none() {
            link.device_id = Some(stamp.device.clone());
        }
    }
}

fn all_stamps(links: &ClipboardLinks) -> impl Iterator<Item = &Hlc> {
    links.links.iter().filter_map(|link| link.updated_at.as_ref()).chain(links.tombstones.iter().map(|tombstone| &tombstone.deleted_at))
}

pub(super) fn restamp(old: &ClipboardLinks, mut new: ClipboardLinks, clock: &mut Clock, wall: u64) -> ClipboardLinks {
    for link in &mut new.links {
        match old.links.iter().find(|previous| previous.id == link.id) {
            Some(previous) if previous.bare() == link.bare() => *link = previous.clone(),
            _ => {
                let stamp = clock.tick(wall);
                link.device_id = Some(stamp.device.clone());
                link.updated_at = Some(stamp);
            }
        }
    }
    let mut tombstones = old.tombstones.clone();
    for link in &old.links {
        if !new.links.iter().any(|kept| kept.id == link.id) {
            record::bury(&mut tombstones, &link.id, clock.tick(wall));
        }
    }
    for link in &new.links {
        record::unbury(&mut tombstones, &link.id);
    }
    new.tombstones = tombstones;
    if new != *old {
        record::prune(&mut new.tombstones, wall);
    }
    new
}

pub(super) fn normalized_settings(settings: ClipboardLinkSettings) -> ClipboardLinkSettings {
    ClipboardLinkSettings { blocked_sites: normalized_sites(&settings.blocked_sites), only_sites: normalized_sites(&settings.only_sites), ..settings }
}

pub(super) fn normalized_sites(sites: &[String]) -> Vec<String> {
    let mut kept: Vec<String> = Vec::new();
    for site in sites {
        let site = site.trim().to_lowercase();
        let site = site.split_once("://").map_or(site.as_str(), |(_, rest)| rest);
        let site = site.split(['/', '?', '#']).next().unwrap_or_default();
        let site = site.rsplit_once('@').map_or(site, |(_, host)| host);
        let site = site.split(':').next().unwrap_or_default().trim_start_matches("*.").trim_start_matches("www.").trim_matches('.');
        if site.is_empty() || site.chars().count() > MAX_SITE_CHARS || kept.iter().any(|kept| kept == site) || kept.len() == MAX_SITES {
            continue;
        }
        kept.push(site.to_string());
    }
    kept
}

pub(super) fn normalized_url(url: &str) -> Option<String> {
    let url = url.trim();
    if url.is_empty() || url.chars().count() > MAX_URL_CHARS || url.chars().any(char::is_whitespace) {
        return None;
    }
    let with_scheme = if url.contains("://") { url.to_string() } else { format!("https://{url}") };
    let parsed = Url::parse(&with_scheme).ok()?;
    let host = parsed.host_str()?;
    if !matches!(parsed.scheme(), "http" | "https") || (!host.contains('.') && host != "localhost") {
        return None;
    }
    Some(parsed.to_string())
}

fn clean_title(title: &str) -> String {
    title.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(MAX_TITLE_CHARS).collect()
}

fn new_id() -> String {
    format!("{}-{}", current_unix_millis(), NEXT_ID.fetch_add(1, Ordering::Relaxed))
}

pub(super) fn notice_enabled(app: &AppHandle) -> bool {
    store(app).ok().and_then(|store| store.state.lock().ok().map(|state| state.settings.notice)).unwrap_or(false)
}

fn update<F>(app: &AppHandle, change: F) -> Result<ClipboardLinks, UserError>
where
    F: FnOnce(&mut ClipboardLinks) -> Result<(), UserError>,
{
    let store = store(app)?;
    let mut state = store.state.lock().map_err(|error| error.to_string())?;
    let mut next = state.clone();
    change(&mut next)?;
    let next = clock::with(|clock, wall| restamp(&state, next, clock, wall));
    save(&store.path, &next)?;
    *state = next.clone();
    drop(state);
    let _ = app.emit(CHANGED_EVENT, &next);
    crate::sync::notify_local_change();
    Ok(next)
}

fn link_values(links: &[ClipboardLink]) -> Result<Vec<serde_json::Value>, String> {
    links.iter().map(serde_json::to_value).collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

pub(crate) fn links_for_sync(app: &AppHandle) -> Result<crate::sync::SyncRecords, String> {
    let store = store(app)?;
    let state = store.state.lock().map_err(|error| error.to_string())?;
    Ok((link_values(&state.links)?, state.tombstones.clone()))
}

pub(crate) fn replace_links_from_sync(
    app: &AppHandle,
    expected: (&[serde_json::Value], &[Tombstone]),
    links: Vec<serde_json::Value>,
    tombstones: Vec<Tombstone>,
) -> Result<(), String> {
    let store = store(app)?;
    let mut links: Vec<ClipboardLink> = links.into_iter().filter_map(|link| serde_json::from_value(link).ok()).collect();
    links.sort_by(|left, right| (&left.sort_key, &left.id).cmp(&(&right.sort_key, &right.id)));
    let mut state = store.state.lock().map_err(|error| error.to_string())?;
    if link_values(&state.links)? != expected.0 || state.tombstones != expected.1 {
        return Err("The bookmarks changed while syncing; trying again later.".into());
    }
    let next = normalized(ClipboardLinks { version: VERSION, settings: state.settings.clone(), links, tombstones });
    if next == *state {
        return Ok(());
    }
    clock::observe(all_stamps(&next));
    save(&store.path, &next)?;
    *state = next.clone();
    drop(state);
    let _ = app.emit(CHANGED_EVENT, &next);
    Ok(())
}

pub(super) fn add_links(links: &mut ClipboardLinks, entries: impl IntoIterator<Item = (String, String)>) -> usize {
    let mut fresh: Vec<ClipboardLink> = Vec::new();
    for (url, title) in entries {
        let Some(url) = normalized_url(&url) else { continue };
        if links.links.len() + fresh.len() >= MAX_LINKS || links.links.iter().chain(&fresh).any(|link| link.url == url) {
            continue;
        }
        fresh.push(ClipboardLink::new(url, &title));
    }
    let first = links.links.first().map(|link| link.sort_key.as_str());
    let keys = links_order::keys_between(None, first, fresh.len());
    for (link, key) in fresh.iter_mut().zip(keys) {
        link.sort_key = key;
    }
    let added = fresh.len();
    links.links.splice(0..0, fresh);
    added
}

pub(super) fn move_link(links: &mut ClipboardLinks, id: &str, to: usize) -> Result<(), UserError> {
    let from = links.links.iter().position(|link| link.id == id).ok_or_else(|| UserError::new("clipboard.linkMissing", "This bookmark was not found."))?;
    let mut link = links.links.remove(from);
    let to = to.min(links.links.len());
    if to != from {
        let before = to.checked_sub(1).and_then(|index| links.links.get(index)).map(|link| link.sort_key.as_str());
        let after = links.links.get(to).map(|link| link.sort_key.as_str());
        link.sort_key = links_order::key_between(before, after);
    }
    links.links.insert(to, link);
    Ok(())
}

#[tauri::command]
pub fn get_clipboard_links(app: AppHandle) -> Result<ClipboardLinks, UserError> {
    let store = store(&app)?;
    let state = store.state.lock().map_err(|error| error.to_string())?;
    Ok(state.clone())
}

#[tauri::command]
pub fn add_clipboard_link(app: AppHandle, url: String, title: Option<String>) -> Result<ClipboardLinks, UserError> {
    if normalized_url(&url).is_none() {
        return Err(UserError::new("clipboard.notLink", "This is not a web address."));
    }
    update(&app, |links| {
        add_links(links, [(url, title.unwrap_or_default())]);
        Ok(())
    })
}

#[tauri::command]
pub fn remove_clipboard_link(app: AppHandle, id: String) -> Result<ClipboardLinks, UserError> {
    update(&app, |links| {
        links.links.retain(|link| link.id != id);
        Ok(())
    })
}

#[tauri::command]
pub fn move_clipboard_link(app: AppHandle, id: String, to: usize) -> Result<ClipboardLinks, UserError> {
    update(&app, |links| move_link(links, &id, to))
}

#[tauri::command]
pub fn set_clipboard_link_settings(app: AppHandle, settings: ClipboardLinkSettings) -> Result<ClipboardLinks, UserError> {
    update(&app, |links| {
        links.settings = normalized_settings(settings);
        Ok(())
    })
}

#[tauri::command]
pub async fn export_clipboard_links(app: AppHandle) -> Result<String, UserError> {
    let links = get_clipboard_links(app)?;
    Ok(super::links_transfer::export(&links)?)
}

#[tauri::command]
pub async fn import_clipboard_links(app: AppHandle, content: String) -> Result<usize, UserError> {
    let entries = super::links_transfer::parse(&content);
    if entries.is_empty() {
        return Err(UserError::new("clipboard.noLinks", "No web addresses were found in this file."));
    }
    let mut added = 0;
    update(&app, |links| {
        added = add_links(links, entries);
        Ok(())
    })?;
    Ok(added)
}

#[cfg(test)]
#[path = "links_tests.rs"]
mod tests;
