use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;

use super::{
    grants::{stop_plugin, sync_processes, update_state},
    host, lock,
    manifest::LocalizedText,
    registry::rescan,
};

const REVOKED_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) enum RevokeAction {
    Disable,
    Uninstall,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub(super) enum RevokedVersions {
    All(String),
    Some(Vec<String>),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Revocation {
    pub id: String,
    pub versions: RevokedVersions,
    pub reason: LocalizedText,
    pub action: RevokeAction,
}

impl Revocation {
    fn covers(&self, id: &str, version: &str) -> bool {
        self.id == id
            && match &self.versions {
                RevokedVersions::All(all) => all == "*",
                RevokedVersions::Some(list) => list.iter().any(|item| item == version),
            }
    }
}

#[derive(Deserialize)]
struct RevokedFile {
    version: u32,
    #[serde(default)]
    revoked: Vec<Value>,
}

pub(super) fn parse_revoked(text: &str) -> Result<Vec<Revocation>, String> {
    let file: RevokedFile = serde_json::from_str(text).map_err(|error| format!("The revocation list is not valid: {error}"))?;
    if file.version != REVOKED_VERSION {
        return Err(format!("The revocation list has format {}; update Fuyu.", file.version));
    }
    Ok(file
        .revoked
        .into_iter()
        .filter_map(|value| serde_json::from_value::<Revocation>(value).ok())
        .filter(|item| !item.id.is_empty() && !matches!(&item.versions, RevokedVersions::All(all) if all != "*"))
        .collect())
}

pub(super) fn find<'a>(list: &'a [Revocation], id: &str, version: &str) -> Option<&'a Revocation> {
    list.iter().find(|item| item.covers(id, version))
}

pub(super) fn merge(saved: &[Revocation], fetched: Vec<Revocation>) -> Vec<Revocation> {
    let mut list = fetched;
    for item in saved {
        if !list.contains(item) {
            list.push(item.clone());
        }
    }
    list
}

pub(super) fn apply(fetched: Vec<Revocation>) -> Result<(), String> {
    let host = host()?;
    let list = merge(&lock(&host.state).revoked, fetched);
    let hits: Vec<(String, RevokeAction, std::path::PathBuf)> = lock(&host.installed)
        .iter()
        .filter(|plugin| !plugin.builtin && !plugin.dev)
        .filter_map(|plugin| {
            let manifest = plugin.manifest.as_ref().ok()?;
            let item = find(&list, &plugin.folder, &manifest.version)?;
            Some((plugin.folder.clone(), item.action, plugin.dir.clone()))
        })
        .collect();
    let unchanged = lock(&host.state).revoked == list;
    if unchanged && hits.iter().all(|(id, action, _)| *action == RevokeAction::Disable && !is_on(id)) {
        return Ok(());
    }
    update_state(|state, _| {
        state.revoked = list;
        for (id, action, _) in &hits {
            if *action == RevokeAction::Uninstall {
                state.plugins.remove(id);
            } else if let Some(grant) = state.plugins.get_mut(id) {
                grant.enabled = false;
            }
        }
        Ok(())
    })?;
    let mut removed = false;
    for (id, action, dir) in &hits {
        stop_plugin(id)?;
        if *action == RevokeAction::Uninstall && dir.is_dir() {
            fs::remove_dir_all(dir).map_err(|error| format!("Could not delete the revoked plugin {id}: {error}"))?;
            lock(&host.runtimes).remove(id);
            removed = true;
        }
    }
    if removed {
        rescan()
    } else {
        sync_processes()
    }
}

fn is_on(id: &str) -> bool {
    host().is_ok_and(|host| lock(&host.state).plugins.get(id).is_some_and(|grant| grant.enabled))
}
