use plugin_base::{host_service, Serve};
use serde::Serialize;
use serde_json::Value;
use tauri::AppHandle;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
pub(crate) struct AppVersion {
    version: &'static str,
    platform: &'static str,
}

#[host_service("app.version")]
fn app_version() -> AppVersion {
    AppVersion { version: env!("CARGO_PKG_VERSION"), platform: std::env::consts::OS }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
pub(crate) struct AppEcho {
    echo: Value,
}

#[host_service("app.echo")]
fn app_echo(value: Value) -> AppEcho {
    AppEcho { echo: value }
}

pub(crate) fn registered() -> Result<Serve, String> {
    Serve::registered()
}

pub(crate) fn table(app: &AppHandle) -> Result<Serve, String> {
    let mut serve = registered()?;
    serve.manage(app.clone());
    serve.block_on_with(|future| tauri::async_runtime::block_on(future));
    Ok(serve)
}
