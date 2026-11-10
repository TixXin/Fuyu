//! Moving a user's island from before the rename (FocuSD Island / fly-island,
//! identifier `com.focusd.island`) to Fuyu (`com.tixxin.fuyu`), D17 step 3; see
//! docs/architecture/rename-plan.md.
//!
//! - `before_start`, before any window or WebView exists: copies the data
//!   folders (data_dirs.rs). The old ones stay, for going back to an old version.
//! - `after_start`, in the background: copies the saved credentials to the new
//!   service names once, moves launch at startup to the new registry value, and
//!   has an installed copy remove the old installed copy (legacy.rs). The agents' status hooks
//!   the user had are written again, as they point at the old folder (step 4).
//!
//! Lane previews and notification checks run under identifiers of their own and
//! migrate nothing.

mod data_dirs;
mod legacy;
#[cfg(test)]
mod tests;

use std::{
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

pub(crate) const OLD_IDENTIFIER: &str = "com.focusd.island";
/// The app's own identifier (tauri.conf.json); only it migrates.
pub(crate) const NEW_IDENTIFIER: &str = "com.tixxin.fuyu";

/// What the migration has done, in `rename-migration.json` in the new data folder.
#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
struct MigrationState {
    /// The identifier the data came from.
    from: String,
    /// When the data folders were copied (ms since 1970).
    copied_at: u64,
    /// The credentials were copied to the new service names.
    credentials: bool,
    /// The AI agents' status hooks were written again for the new folder (or none were installed).
    hooks: bool,
    /// How removing the old installed copy went: "removed", or why it failed.
    old_install: Option<String>,
}

fn roaming_dir() -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(PathBuf::from)
}

fn local_dir() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|elapsed| elapsed.as_millis() as u64).unwrap_or(0)
}

/// Copies the old data folders to the new identifier's.
pub(crate) fn before_start() {
    let identifier = NEW_IDENTIFIER;
    let (Some(roaming), Some(local)) = (roaming_dir(), local_dir()) else {
        return;
    };
    let bases = [roaming.clone(), local];
    if roaming.join(identifier).exists() || !bases.iter().any(|base| base.join(OLD_IDENTIFIER).is_dir()) {
        return;
    }
    legacy::stop_old_island();
    let state = MigrationState { from: OLD_IDENTIFIER.into(), copied_at: now_ms(), ..Default::default() };
    let text = serde_json::to_string_pretty(&state).unwrap_or_default();
    match data_dirs::copy_data_dirs(&bases, OLD_IDENTIFIER, identifier, &text) {
        Ok(true) => eprintln!("copied the data of {OLD_IDENTIFIER} to {identifier}"),
        Ok(false) => {}
        Err(error) => eprintln!("could not copy the data of {OLD_IDENTIFIER} (starting without it, trying again next time): {error}"),
    }
}

/// The rest of the migration, on a thread of its own.
/// Runs once the approval endpoint is up: the reinstalled Claude Code hooks need its address.
pub(crate) fn after_start(app: tauri::AppHandle) {
    let Some(dir) = roaming_dir().map(|roaming| roaming.join(NEW_IDENTIFIER)) else {
        return;
    };
    let release = !cfg!(debug_assertions);
    let _ = std::thread::Builder::new().name("rename-migration".into()).spawn(move || {
        let path = dir.join(data_dirs::STATE_FILE);
        let mut state: Option<MigrationState> = std::fs::read_to_string(&path).ok().and_then(|text| serde_json::from_str(&text).ok());
        if let Some(state) = state.as_mut().filter(|state| !state.credentials) {
            match crate::win32::credentials::copy_generic_credentials(renamed_credential) {
                Ok(count) => {
                    eprintln!("copied {count} credentials to the new service names");
                    state.credentials = true;
                }
                Err(error) => eprintln!("could not copy the credentials: {error}"),
            }
        }
        if let Some(state) = state.as_mut().filter(|state| !state.hooks) {
            match crate::agent_status::reinstall_hooks_after_rename(&app) {
                Ok(reinstalled) => {
                    eprintln!("agent status hooks {}", if reinstalled { "reinstalled for the new folder" } else { "were not installed" });
                    state.hooks = true;
                }
                Err(error) => eprintln!("could not reinstall the agent status hooks: {error}"),
            }
        }
        // A build run from the repository (`pnpm tauri dev`) leaves the user's startup entry alone.
        if release {
            if let Err(error) = crate::system::startup::migrate_legacy_value() {
                eprintln!("could not move launch at startup: {error}");
            }
        }
        if release && legacy::is_installed_copy() {
            let outcome = match legacy::uninstall_old() {
                Ok(true) => Some("removed".to_string()),
                Ok(false) => None,
                Err(error) => {
                    eprintln!("could not remove the old installed copy: {error}");
                    Some(error)
                }
            };
            if let (Some(state), Some(outcome)) = (state.as_mut(), outcome) {
                state.old_install = Some(outcome);
            }
        }
        if let Some(state) = state {
            if let Ok(text) = serde_json::to_string_pretty(&state) {
                let _ = std::fs::write(&path, text);
            }
        }
    });
}

/// The target name a credential gets under the new service names. keyring names
/// them `<account>.<service>`, and every service was `com.focusd.island` or
/// `com.focusd.island.<something>`; anything else is not the app's.
pub(crate) fn renamed_credential(target: &str) -> Option<String> {
    const OLD: &str = ".com.focusd.island";
    let (at, _) = target.match_indices(OLD).find(|(at, _)| {
        let rest = &target[at + OLD.len()..];
        rest.is_empty() || rest.starts_with('.')
    })?;
    Some(format!("{}.{NEW_IDENTIFIER}{}", &target[..at], &target[at + OLD.len()..]))
}
