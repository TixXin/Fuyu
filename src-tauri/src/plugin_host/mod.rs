mod activation;
mod author_signing;
mod baseline;
mod builtin;
mod commands;
mod dev;
mod effort_labels;
mod events;
mod feeds;
mod grants;
mod keybindings;
mod lifecycle;
mod manifest;
mod market;
mod market_likes;
mod market_link;
mod market_themes;
mod menus;
mod view_specs;
mod views;
mod notify;
mod optional;
mod permissions;
mod registry;
mod reveal;
mod revocations;
mod rpc;
mod runtime;
mod sensitive;
mod settings;
mod signature;
mod sound_contrib;
mod storage;
mod system_events;
mod store;
#[cfg(test)]
mod tests;
mod updates;
mod uri;
#[cfg_attr(not(windows), path = "webviews_unsupported.rs")]
mod webviews;

pub use commands::*;
pub(crate) use uri::{find_link, open as open_link};
#[cfg(target_os = "macos")]
pub(crate) use uri::open_opened as open_opened_links;
pub use dev::*;
pub use effort_labels::*;
pub use market_likes::*;
pub use market_link::*;
pub use market_themes::*;
pub use updates::*;
pub use webviews::*;
pub(crate) use dev::answer_local_api as answer_dev_api;
pub(crate) use sound_contrib::{plugin_sound_packs, PluginSoundPack};

use std::{
    collections::{HashMap, HashSet},
    fs,
    path::PathBuf,
    sync::{Arc, Mutex, MutexGuard, OnceLock, PoisonError},
};
use tauri::{AppHandle, Manager};

use crate::local_api;

use grants::sync_processes;
use manifest::PluginManifest;
use registry::{migrate_local_api, scan};
use runtime::{RuntimeTable, Supervisor};
use store::{load_state, save_state, PluginsState, STATE_FILE_NAME};

const PLUGINS_DIR_NAME: &str = "plugins";
const PLUGIN_DATA_DIR_NAME: &str = "plugins-data";

static HOST: OnceLock<PluginHost> = OnceLock::new();

struct PluginHost {
    app: AppHandle,
    plugins_dir: PathBuf,
    data_dir: PathBuf,
    state_path: PathBuf,
    state: Mutex<PluginsState>,
    installed: Mutex<Vec<InstalledPlugin>>,
    supervisors: Mutex<HashMap<String, Supervisor>>,
    builtins_running: Mutex<HashSet<String>>,
    runtimes: RuntimeTable,
}

struct InstalledPlugin {
    folder: String,
    dir: PathBuf,
    manifest: Result<PluginManifest, String>,
    builtin: bool,
    dev: bool,
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let app_dir = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let plugins_dir = app_dir.join(PLUGINS_DIR_NAME);
    fs::create_dir_all(&plugins_dir)
        .map_err(|error| format!("Could not create {}: {error}", plugins_dir.display()))?;
    let state_path = app_dir.join(STATE_FILE_NAME);
    let installed = scan(&plugins_dir, &app_version(app));
    let mut state = load_state(&state_path);
    if migrate_local_api(&mut state, &installed, local_api::legacy_switches()) {
        save_state(&state_path, &state)?;
    }
    let host = PluginHost {
        app: app.clone(),
        installed: Mutex::new(installed),
        plugins_dir,
        data_dir: app_dir.join(PLUGIN_DATA_DIR_NAME),
        state: Mutex::new(state),
        state_path,
        supervisors: Mutex::new(HashMap::new()),
        builtins_running: Mutex::new(HashSet::new()),
        runtimes: Arc::new(Mutex::new(HashMap::new())),
    };
    if HOST.set(host).is_err() {
        return Err("The plugin host was initialized twice.".into());
    }
    if crate::dev_lane::lane().is_none() {
        if let Err(error) = uri::register_scheme() {
            eprintln!("could not register fuyu:// and focusd:// links: {error}");
        }
    }
    events::listen(app);
    system_events::start();
    keybindings::start();
    lifecycle::start();
    updates::start();
    sync_processes()
}

pub(crate) fn publish_event(name: &str, payload: serde_json::Value) {
    events::publish_known(name, payload);
}

fn host() -> Result<&'static PluginHost, String> {
    HOST.get().ok_or_else(|| "The plugin host is not initialized.".to_string())
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

fn app_version(app: &AppHandle) -> String {
    app.package_info().version.to_string()
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::plugin_host::list_plugins,
            crate::plugin_host::take_market_install_request,
            crate::plugin_host::set_plugins_allowed,
            crate::plugin_host::set_plugin_enabled,
            crate::plugin_host::reload_plugins,
            crate::plugin_host::open_plugins_folder,
            crate::plugin_host::run_plugin_command,
            crate::plugin_host::set_plugin_setting,
            crate::plugin_host::get_plugin_market,
            crate::plugin_host::get_cached_plugin_market,
            crate::plugin_host::get_plugin_market_likes,
            crate::plugin_host::get_theme_market,
            crate::plugin_host::install_market_plugin,
            crate::plugin_host::uninstall_plugin,
            crate::plugin_host::run_plugin_notification_action,
            crate::plugin_host::set_plugin_notifications_muted,
            crate::plugin_host::clear_plugin_data,
            crate::plugin_host::list_plugin_menu,
            crate::plugin_host::run_plugin_menu_command,
            crate::plugin_host::run_plugin_item_menu_command,
            crate::plugin_host::answer_plugin_permission,
            crate::plugin_host::revoke_plugin_sensitive_permission,
            crate::plugin_host::list_plugin_views,
            crate::plugin_host::set_plugin_view_visible,
            crate::plugin_host::show_plugin_webview,
            crate::plugin_host::hide_plugin_webview,
            crate::plugin_host::run_plugin_view_action,
            crate::plugin_host::submit_plugin_view,
            crate::plugin_host::search_plugin_view,
            crate::plugin_host::restart_plugin,
            crate::plugin_host::get_plugin_dev_state,
            crate::plugin_host::set_plugin_dev_mode,
            crate::plugin_host::load_dev_plugin,
            crate::plugin_host::reload_dev_plugin,
            crate::plugin_host::unload_dev_plugin,
            crate::plugin_host::get_plugin_rpc_trace,
            crate::plugin_host::send_plugin_dev_event,
            crate::plugin_host::set_plugin_auto_update,
            crate::plugin_host::set_plugin_pre_release,
            crate::plugin_host::set_plugin_memory_limit,
            crate::plugin_host::set_plugin_keybinding,
            crate::plugin_host::set_plugin_publisher_trusted,
            crate::plugin_host::check_plugin_updates,
            crate::plugin_host::list_agent_effort_labels,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
