use std::{
    fs::{self, File},
    io::{BufReader, Write},
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

use super::model;
use super::packs::{Pack, RUNTIME};
use crate::system::download_mirrors;
use crate::user_error::UserError;

pub(crate) const PROGRESS_EVENT: &str = "voice-input-model-progress";
const USER_AGENT: &str = concat!("Fuyu/", env!("CARGO_PKG_VERSION"), " (https://github.com/TixXin/fuyu)");
const TOTAL_TIMEOUT: Duration = Duration::from_secs(60 * 60);
const PROGRESS_EVERY: Duration = Duration::from_millis(250);

static DOWNLOADING: AtomicBool = AtomicBool::new(false);
static CANCEL: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceModelProgress {
    pub stage: &'static str,
    pub downloaded: u64,
    pub total: u64,
    pub source: &'static str,
}

enum Failure {
    Cancelled,
    Other(String),
}

pub(crate) fn is_downloading() -> bool {
    DOWNLOADING.load(Ordering::SeqCst)
}

pub(crate) fn cancel() {
    CANCEL.store(true, Ordering::SeqCst);
}

pub(crate) async fn download(app: AppHandle) -> Result<(), UserError> {
    if DOWNLOADING.swap(true, Ordering::SeqCst) {
        return Err(UserError::new("voiceInput.downloadBusy", "The speech model is already downloading."));
    }
    CANCEL.store(false, Ordering::SeqCst);
    let result = run(&app).await;
    DOWNLOADING.store(false, Ordering::SeqCst);
    let _ = app.emit(PROGRESS_EVENT, VoiceModelProgress { stage: "done", downloaded: 0, total: 0, source: "" });
    result
}

struct Progress {
    done: u64,
    total: u64,
}

fn failed(error: impl std::fmt::Display) -> UserError {
    UserError::new("voiceInput.downloadFailed", "Could not download the speech model.").detail(error)
}

async fn run(app: &AppHandle) -> Result<(), UserError> {
    let root = model::root_dir(app)?;
    if RUNTIME.is_none() {
        return Err(failed("Voice input is not available on this system."));
    }
    fs::create_dir_all(&root).map_err(failed)?;
    let client = download_mirrors::client(USER_AGENT, TOTAL_TIMEOUT).map_err(failed)?;
    let missing = model::missing(&root);
    let mut progress = Progress { done: 0, total: missing.iter().map(|pack| pack.bytes).sum() };
    for pack in missing {
        let source = get(app, &client, &root, pack, &progress).await?;
        install(app, &root, pack, source, &progress).await?;
        progress.done = progress.done.saturating_add(pack.bytes);
    }
    Ok(())
}

async fn get(app: &AppHandle, client: &reqwest::Client, root: &Path, pack: &'static Pack, progress: &Progress) -> Result<&'static str, UserError> {
    let part = model::archive_path(root, pack);
    let mut failures = Vec::new();
    for download_mirrors::Source { name: source, url } in download_mirrors::sources(pack.url) {
        match fetch(app, client, &url, &part, pack, source, progress).await {
            Ok(()) => return Ok(source),
            Err(Failure::Cancelled) => {
                let _ = fs::remove_file(&part);
                return Err(UserError::new("voiceInput.downloadCancelled", "The download was cancelled."));
            }
            Err(Failure::Other(message)) => failures.push(format!("{source}: {message}")),
        }
    }
    let _ = fs::remove_file(&part);
    Err(failed(failures.join("; ")))
}

async fn install(app: &AppHandle, root: &Path, pack: &'static Pack, source: &'static str, progress: &Progress) -> Result<(), UserError> {
    let done = progress.done.saturating_add(pack.bytes);
    let _ = app.emit(PROGRESS_EVENT, VoiceModelProgress { stage: "unpack", downloaded: done, total: progress.total, source });
    let part = model::archive_path(root, pack);
    let target = model::pack_dir(root, pack);
    let unpacked = tauri::async_runtime::spawn_blocking(move || {
        let result = File::open(&part).map_err(|error| error.to_string()).and_then(|file| model::unpack(pack, BufReader::new(file), &target));
        let _ = fs::remove_file(&part);
        result
    })
    .await
    .map_err(|error| error.to_string())
    .and_then(|result| result);
    unpacked.map_err(|error| UserError::new("voiceInput.unpackFailed", "Could not unpack the speech model.").detail(error))
}

fn other(error: impl std::fmt::Display) -> Failure {
    Failure::Other(error.to_string())
}

async fn fetch(app: &AppHandle, client: &reqwest::Client, url: &str, part: &Path, pack: &Pack, source: &'static str, progress: &Progress) -> Result<(), Failure> {
    let mut response = client.get(url).send().await.map_err(other)?.error_for_status().map_err(other)?;
    let limit = pack.bytes.saturating_mul(2);
    let mut file = File::create(part).map_err(other)?;
    let mut hasher = Sha256::new();
    let mut downloaded: u64 = 0;
    let mut reported = Instant::now();
    while let Some(chunk) = response.chunk().await.map_err(other)? {
        if CANCEL.load(Ordering::SeqCst) {
            return Err(Failure::Cancelled);
        }
        downloaded = downloaded.saturating_add(chunk.len() as u64);
        if downloaded > limit {
            return Err(Failure::Other("The file is larger than expected.".to_string()));
        }
        hasher.update(&chunk);
        file.write_all(&chunk).map_err(other)?;
        if reported.elapsed() >= PROGRESS_EVERY {
            reported = Instant::now();
            let done = progress.done.saturating_add(downloaded.min(pack.bytes));
            let _ = app.emit(PROGRESS_EVENT, VoiceModelProgress { stage: "download", downloaded: done, total: progress.total, source });
        }
    }
    file.flush().map_err(other)?;
    let digest = model::sha256_hex(&hasher.finalize());
    if digest != pack.sha256 {
        return Err(Failure::Other(format!("Checksum mismatch: {digest}")));
    }
    Ok(())
}
