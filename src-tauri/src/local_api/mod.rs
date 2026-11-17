mod background;
mod bridge;
mod config;
#[cfg(debug_assertions)]
mod dev_island;
#[cfg(debug_assertions)]
mod lab;
mod routes;
mod server;
pub(crate) mod settings;
mod switches;
#[cfg(test)]
mod tests;

use std::{
    path::PathBuf,
    sync::{Mutex, MutexGuard, OnceLock, PoisonError},
};
use tauri::{AppHandle, Manager};

pub use bridge::BridgeResponse;
use config::{load_config, save_config, LocalApiConfig, CONFIG_FILE_NAME};

static SERVICE: OnceLock<LocalApiService> = OnceLock::new();

struct LocalApiService {
    app: AppHandle,
    path: PathBuf,
    config: Mutex<LocalApiConfig>,
}

struct LocalApiStatus {
    pub url: String,
    pub token: String,
    pub config_path: String,
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let path = crate::home_dir::fuyu_home(app.path())
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?
        .join(CONFIG_FILE_NAME);
    if let Ok(app_data) = app.path().app_data_dir() {
        if path.parent() != Some(app_data.as_path()) {
            config::set_mirror(app_data.join(CONFIG_FILE_NAME));
        }
    }
    let (mut config, mut changed) = load_config(&path)?;
    let own_port = crate::dev_lane::port(config.port, config::PREFERRED_PORT);
    if own_port != config.port {
        config.port = own_port;
        changed = true;
    }
    if changed || config::has_mirror() {
        save_config(&path, &config)?;
    }
    #[cfg(debug_assertions)]
    if let Some(home) = path.parent() {
        if let Err(error) = lab::start(app.clone(), home) {
            eprintln!("{error}");
        }
    }
    let _ = SERVICE.set(LocalApiService {
        app: app.clone(),
        path,
        config: Mutex::new(config),
    });
    background::init();
    Ok(())
}

fn service() -> Result<&'static LocalApiService, String> {
    SERVICE
        .get()
        .ok_or_else(|| "The local API is not initialized.".to_string())
}

fn config(service: &LocalApiService) -> MutexGuard<'_, LocalApiConfig> {
    service.config.lock().unwrap_or_else(PoisonError::into_inner)
}

fn current_config() -> LocalApiConfig {
    SERVICE.get().map(|service| config(service).clone()).unwrap_or_default()
}

fn start(allow_write: bool) -> Result<LocalApiStatus, String> {
    let service = service()?;
    {
        let mut config = config(service);
        let port = server::start(service.app.clone(), config.port)?;
        config.enabled = true;
        config.allow_write = allow_write;
        config.port = port;
        save_config(&service.path, &config)?;
    }
    status()
}

fn stop() -> Result<(), String> {
    let service = service()?;
    server::stop();
    crate::agent_status::clear_external_owner(server::LOCAL_API_OWNER);
    let mut config = config(service);
    config.enabled = false;
    save_config(&service.path, &config)
}

fn set_allow_write(allow_write: bool) -> Result<(), String> {
    let service = service()?;
    let mut config = config(service);
    config.allow_write = allow_write;
    save_config(&service.path, &config)
}

fn reset_token() -> Result<LocalApiStatus, String> {
    let service = service()?;
    {
        let mut config = config(service);
        config.token = config::generate_token()?;
        save_config(&service.path, &config)?;
    }
    status()
}

fn status() -> Result<LocalApiStatus, String> {
    let service = service()?;
    let config = config(service).clone();
    Ok(LocalApiStatus {
        url: format!("http://127.0.0.1:{}/v1", server::running_port().unwrap_or(config.port)),
        token: config.token,
        config_path: service.path.display().to_string(),
    })
}

pub(crate) fn call_island(app: &AppHandle, method: &'static str, params: serde_json::Value) -> Result<serde_json::Value, (u16, String)> {
    switches::check(method).map_err(|error| (error.status, error.message))?;
    let call = routes::ApiCall { method, params, writes: false };
    bridge::dispatch(app, call).map_err(|error| (error.status, error.message))
}

#[tauri::command]
pub fn answer_local_api_request(id: u64, response: BridgeResponse) {
    bridge::complete(id, response);
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::local_api::answer_local_api_request,
            crate::local_api::settings::get_local_api_info,
            crate::local_api::settings::reset_local_api_token,
            crate::local_api::settings::copy_local_api_token,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
