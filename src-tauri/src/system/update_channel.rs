use std::time::{Duration, Instant};

use super::download_mirrors::{self, Exhausted, Failure, FailureKind, CONNECT_TIMEOUT, READ_TIMEOUT};
use super::update_runtime::{change, Stage};
use crate::user_error::UserError;

use serde::Serialize;
use tauri::{ipc::Channel, AppHandle, Url};
use tauri_plugin_updater::{Update, UpdaterExt};

const STABLE_MANIFEST: &str = "releases/latest/download/latest.json";
const BETA_MANIFEST: &str = "releases/download/beta-channel/latest.json";
const CHECK_TIMEOUT: Duration = Duration::from_secs(20);
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(600);
const PROGRESS_EVERY: Duration = Duration::from_millis(100);

#[derive(Serialize)]
pub struct UpdateInfo {
    version: String,
    body: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum DownloadEvent {
    Started {
        #[serde(rename = "contentLength")]
        content_length: Option<u64>,
    },
    Progress {
        #[serde(rename = "chunkLength")]
        chunk_length: usize,
    },
    Finished,
}

pub(crate) fn channel_endpoints(configured: &[Url], channel: &str) -> Result<Vec<Url>, String> {
    match channel {
        "stable" => Ok(configured.to_vec()),
        "beta" => {
            let mut endpoints = configured
                .iter()
                .map(|endpoint| {
                    let url = endpoint.as_str();
                    let base = url
                        .strip_suffix(STABLE_MANIFEST)
                        .ok_or_else(|| format!("Cannot derive the beta channel from {url}"))?;
                    Url::parse(&format!("{base}{BETA_MANIFEST}")).map_err(|error| error.to_string())
                })
                .collect::<Result<Vec<_>, _>>()?;
            endpoints.extend_from_slice(configured);
            Ok(endpoints)
        }
        other => Err(format!("Unknown update channel: {other}")),
    }
}

fn configured_endpoints(app: &AppHandle) -> Result<Vec<Url>, String> {
    let config = app
        .config()
        .plugins
        .0
        .get("updater")
        .cloned()
        .ok_or("The updater is not configured")?;
    serde_json::from_value::<tauri_plugin_updater::Config>(config)
        .map(|config| config.endpoints)
        .map_err(|error| error.to_string())
}

async fn check(app: &AppHandle, channel: &str) -> Result<Option<Update>, String> {
    let endpoints = channel_endpoints(&configured_endpoints(app)?, channel)?;
    let mut builder = app
        .updater_builder()
        .endpoints(endpoints)
        .map_err(|error| error.to_string())?
        .timeout(CHECK_TIMEOUT)
        .configure_client(|client| client.connect_timeout(CONNECT_TIMEOUT).read_timeout(READ_TIMEOUT));
    if let Some(proxy) = super::updater::proxy_url().map_err(|error| error.to_string())? {
        builder = builder.proxy(proxy);
    }
    builder.build().map_err(|error| error.to_string())?
        .check().await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn updater_check(app: AppHandle, channel: String) -> Result<Option<UpdateInfo>, UserError> {
    if channel != "stable" && channel != "beta" {
        return Err(format!("Unknown update channel: {channel}").into());
    }
    change(&app, |runtime| runtime.begin_check(&channel))?;
    let task_app = app.clone();
    let result = tauri::async_runtime::spawn(async move {
        match check(&task_app, &channel).await {
            Ok(found) => {
                let info = found.as_ref().map(|update| UpdateInfo {
                    version: update.version.clone(),
                    body: update.body.clone(),
                });
                change(&task_app, |runtime| {
                    runtime.complete_check(found.map(|update| {
                        let version = update.version.clone();
                        let notes = update.body.clone().unwrap_or_default();
                        (update, version, notes)
                    }));
                    Ok(())
                })?;
                Ok(info)
            }
            Err(error) => {
                change(&task_app, |runtime| { runtime.fail(&error, true); Ok(()) })?;
                Err(UserError::from(error))
            }
        }
    }).await;
    match result {
        Ok(result) => result,
        Err(error) => {
            let detail = error.to_string();
            change(&app, |runtime| { runtime.fail(&detail, true); Ok(()) })?;
            Err(detail.into())
        }
    }
}

fn classify(error: &tauri_plugin_updater::Error) -> Failure {
    use tauri_plugin_updater::Error;
    match error {
        Error::Reqwest(error) => Failure::from_reqwest(error),
        Error::Network(message) => Failure::new(FailureKind::Status, message.clone()),
        Error::Minisign(_) | Error::Base64(_) | Error::SignatureUtf8(_) => Failure::new(FailureKind::Invalid, error.to_string()),
        other => Failure::new(FailureKind::Unreachable, other.to_string()),
    }
}

async fn download(app: &AppHandle, update: &mut Update, on_event: Option<&Channel<DownloadEvent>>) -> Result<Vec<u8>, String> {
    let original = update.download_url.clone();
    let mut attempts = Vec::new();
    for source in download_mirrors::sources(original.as_str()) {
        let Ok(url) = Url::parse(&source.url) else { continue };
        update.download_url = url;
        let _ = change(app, |runtime| {
            runtime.snapshot.download_source = Some(source.name.to_string());
            runtime.snapshot.downloaded = 0;
            runtime.snapshot.total = 0;
            Ok(())
        });
        let result = download_from(app, update, on_event).await;
        update.download_url = original.clone();
        match result {
            Ok(bytes) => return Ok(bytes),
            Err(error) => attempts.push((source.name, classify(&error))),
        }
    }
    let what = format!("Fuyu {}", update.version);
    Err(Exhausted { attempts }.to_user_error(&what).to_string())
}

async fn download_from(app: &AppHandle, update: &Update, on_event: Option<&Channel<DownloadEvent>>) -> Result<Vec<u8>, tauri_plugin_updater::Error> {
    let mut started = false;
    let mut pending: usize = 0;
    let mut reported = Instant::now();
    update.download(
        |chunk_length, content_length| {
            pending = pending.saturating_add(chunk_length);
            if !started || reported.elapsed() >= PROGRESS_EVERY {
                let bytes = std::mem::take(&mut pending);
                reported = Instant::now();
                let _ = change(app, |runtime| {
                    if !started { runtime.snapshot.total = content_length.unwrap_or(0); }
                    runtime.snapshot.downloaded = runtime.snapshot.downloaded.saturating_add(bytes);
                    Ok(())
                });
            }
            if !started {
                started = true;
                if let Some(channel) = on_event { let _ = channel.send(DownloadEvent::Started { content_length }); }
            }
            if let Some(channel) = on_event { let _ = channel.send(DownloadEvent::Progress { chunk_length }); }
        },
        || {
            let _ = change(app, |runtime| {
                if runtime.snapshot.total > 0 {
                    runtime.snapshot.downloaded = usize::try_from(runtime.snapshot.total).unwrap_or(usize::MAX);
                }
                Ok(())
            });
            if let Some(channel) = on_event { let _ = channel.send(DownloadEvent::Finished); }
        },
    ).await
}

fn join_error(app: &AppHandle, error: impl std::fmt::Display) -> UserError {
    let detail = error.to_string();
    let _ = change(app, |runtime| { runtime.fail(&detail, false); Ok(()) });
    UserError::from(detail)
}

#[tauri::command]
pub async fn updater_download(app: AppHandle, expected_version: String, expected_channel: String) -> Result<(), UserError> {
    let mut update = change(&app, |runtime| runtime.begin_download(&expected_version, &expected_channel))?;
    update.timeout = Some(DOWNLOAD_TIMEOUT);
    let task_app = app.clone();
    let result = tauri::async_runtime::spawn(async move {
        let mut update = update;
        match download(&task_app, &mut update, None).await {
            Ok(bytes) => change(&task_app, |runtime| { runtime.finish_download(update, bytes); Ok(()) }),
            Err(error) => {
                change(&task_app, |runtime| { runtime.download_failed(update, &error); Ok(()) })?;
                Err(UserError::from(error))
            }
        }
    }).await;
    result.unwrap_or_else(|error| Err(join_error(&app, error)))
}

#[tauri::command]
pub async fn updater_install(
    app: AppHandle,
    on_event: Channel<DownloadEvent>,
    expected_version: Option<String>,
    expected_channel: Option<String>,
) -> Result<(), UserError> {
    let (mut update, ready) = change(&app, |runtime| {
        runtime.begin_install(expected_version.as_deref(), expected_channel.as_deref())
    })?;
    update.timeout = Some(DOWNLOAD_TIMEOUT);
    let task_app = app.clone();
    let result = tauri::async_runtime::spawn(async move {
        let result = async {
            let bytes = match ready {
                Some(bytes) => {
                    let _ = on_event.send(DownloadEvent::Finished);
                    bytes
                }
                None => download(&task_app, &mut update, Some(&on_event)).await?,
            };
            let _ = change(&task_app, |runtime| { runtime.snapshot.stage = Stage::Installing; Ok(()) });
            update.install(bytes).map_err(|error| error.to_string())
        }.await;
        change(&task_app, |runtime| {
            match &result {
                Ok(()) => runtime.snapshot.stage = Stage::Done,
                Err(error) => runtime.fail(error, false),
            }
            Ok(())
        })?;
        if result.is_ok() {
            restart_after_install(&task_app);
        }
        result.map_err(UserError::from)
    }).await;
    result.unwrap_or_else(|error| Err(join_error(&app, error)))
}

fn restart_after_install(app: &AppHandle) {
    const SETTLE: Duration = Duration::from_millis(1500);
    let app = app.clone();
    let spawned = std::thread::Builder::new().name("update-restart".into()).spawn(move || {
        std::thread::sleep(SETTLE);
        app.request_restart();
    });
    if let Err(error) = spawned {
        eprintln!("[updater] could not schedule the restart: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn urls(list: &[&str]) -> Vec<Url> {
        list.iter().filter_map(|url| Url::parse(url).ok()).collect()
    }

    #[test]
    fn stable_keeps_the_configured_endpoints() {
        let configured = urls(&["https://github.com/o/r/releases/latest/download/latest.json"]);
        assert_eq!(channel_endpoints(&configured, "stable"), Ok(configured));
    }

    #[test]
    fn beta_reads_the_beta_manifest_on_every_mirror_then_falls_back_to_stable() {
        let configured = urls(&[
            "https://github.com/o/r/releases/latest/download/latest.json",
            "https://ghfast.top/https://github.com/o/r/releases/latest/download/latest.json",
        ]);
        let beta = urls(&[
            "https://github.com/o/r/releases/download/beta-channel/latest.json",
            "https://ghfast.top/https://github.com/o/r/releases/download/beta-channel/latest.json",
            "https://github.com/o/r/releases/latest/download/latest.json",
            "https://ghfast.top/https://github.com/o/r/releases/latest/download/latest.json",
        ]);
        assert_eq!(channel_endpoints(&configured, "beta"), Ok(beta));
    }

    #[test]
    fn unknown_channels_and_unrecognized_endpoints_are_refused() {
        let configured = urls(&["https://example.com/update.json"]);
        assert!(channel_endpoints(&configured, "beta").is_err());
        assert!(channel_endpoints(&configured, "nightly").is_err());
    }

    #[test]
    fn the_shipped_endpoints_have_a_beta_channel() {
        let config: serde_json::Value = serde_json::from_str(include_str!("../../tauri.conf.json"))
            .expect("tauri.conf.json must be valid JSON");
        let updater: tauri_plugin_updater::Config =
            serde_json::from_value(config["plugins"]["updater"].clone())
                .expect("plugins.updater must deserialize");
        let beta = channel_endpoints(&updater.endpoints, "beta").expect("beta endpoints");
        assert_eq!(beta.len(), 2 * updater.endpoints.len());
    }
}
