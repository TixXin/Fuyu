use std::sync::{Mutex, MutexGuard, OnceLock};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::Update;

use crate::user_error::UserError;

pub(super) const STATE_EVENT: &str = "updater-state-changed";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(super) enum Stage {
    Idle,
    Checking,
    Latest,
    Available,
    Downloading,
    Ready,
    Installing,
    Done,
    Error,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSnapshot {
    pub revision: u64,
    pub(super) stage: Stage,
    pub next_version: String,
    pub notes: String,
    pub downloaded: usize,
    pub total: u64,
    pub detail: String,
    pub last_checked_at: Option<i64>,
    pub last_attempt_at: Option<i64>,
    pub channel: Option<String>,
    pub started_at: i64,
    pub check_failures: u32,
}

pub(super) struct Runtime<T> {
    pub snapshot: UpdateSnapshot,
    pub pending: Option<T>,
    pub pending_channel: Option<String>,
    pub ready: Option<Vec<u8>>,
    checking_channel: Option<String>,
}

impl<T> Runtime<T> {
    fn new() -> Self {
        Self {
            snapshot: UpdateSnapshot {
                revision: 0,
                stage: Stage::Idle,
                next_version: String::new(),
                notes: String::new(),
                downloaded: 0,
                total: 0,
                detail: String::new(),
                last_checked_at: None,
                last_attempt_at: None,
                channel: None,
                started_at: now(),
                check_failures: 0,
            },
            pending: None,
            pending_channel: None,
            ready: None,
            checking_channel: None,
        }
    }

    fn ensure_idle(&self) -> Result<(), UserError> {
        match self.snapshot.stage {
            Stage::Checking | Stage::Downloading | Stage::Installing => {
                Err(UserError::new("updater.busy", "An update operation is already in progress"))
            }
            Stage::Done => Err("The update has already been installed".into()),
            _ => Ok(()),
        }
    }

    pub fn begin_check(&mut self, channel: &str) -> Result<(), UserError> {
        self.ensure_idle()?;
        self.snapshot.stage = Stage::Checking;
        self.checking_channel = Some(channel.to_owned());
        self.snapshot.last_attempt_at = Some(now());
        self.snapshot.detail.clear();
        Ok(())
    }

    pub fn complete_check(&mut self, found: Option<(T, String, String)>) {
        self.snapshot.channel = self.checking_channel.take();
        self.snapshot.last_checked_at = Some(now());
        self.snapshot.check_failures = 0;
        self.snapshot.downloaded = 0;
        self.snapshot.total = 0;
        if let Some((update, version, notes)) = found {
            let same = self.ready.is_some() && version == self.snapshot.next_version && self.pending_channel == self.snapshot.channel;
            self.pending = Some(update);
            if !same {
                self.ready = None;
            }
            self.pending_channel.clone_from(&self.snapshot.channel);
            self.snapshot.next_version = version;
            self.snapshot.notes = notes;
            self.snapshot.stage = if self.ready.is_some() { Stage::Ready } else { Stage::Available };
        } else {
            self.pending = None;
            self.pending_channel = None;
            self.ready = None;
            self.snapshot.next_version.clear();
            self.snapshot.notes.clear();
            self.snapshot.stage = Stage::Latest;
        }
    }

    pub fn fail(&mut self, error: &str, check: bool) {
        self.snapshot.stage = Stage::Error;
        self.snapshot.detail = error.chars().take(240).collect();
        if check {
            self.checking_channel = None;
            self.snapshot.check_failures = self.snapshot.check_failures.saturating_add(1);
        }
    }

    fn check_target(&self, version: Option<&str>, channel: Option<&str>) -> Result<(), UserError> {
        if version.is_some_and(|v| v != self.snapshot.next_version)
            || channel.is_some_and(|c| Some(c) != self.pending_channel.as_deref())
        {
            return Err(UserError::new("updater.targetChanged", "The update target changed. Check the version and try again"));
        }
        Ok(())
    }

    pub fn begin_download(&mut self, version: &str, channel: &str) -> Result<T, UserError> {
        self.ensure_idle()?;
        self.check_target(Some(version), Some(channel))?;
        if self.ready.is_some() {
            return Err(UserError::new("updater.busy", "The update is already downloaded"));
        }
        let update = self.pending.take().ok_or("No update to download")?;
        self.snapshot.stage = Stage::Downloading;
        self.snapshot.downloaded = 0;
        self.snapshot.total = 0;
        self.snapshot.detail.clear();
        Ok(update)
    }

    pub fn finish_download(&mut self, update: T, bytes: Vec<u8>) {
        self.pending = Some(update);
        self.ready = Some(bytes);
        self.snapshot.stage = Stage::Ready;
    }

    pub fn download_failed(&mut self, update: T, error: &str) {
        self.pending = Some(update);
        self.snapshot.stage = Stage::Available;
        self.snapshot.detail = error.chars().take(240).collect();
    }

    pub fn begin_install(&mut self, version: Option<&str>, channel: Option<&str>) -> Result<(T, Option<Vec<u8>>), UserError> {
        self.ensure_idle()?;
        self.check_target(version, channel)?;
        let update = self.pending.take().ok_or("No update to install")?;
        let bytes = self.ready.take();
        self.snapshot.stage = if bytes.is_some() { Stage::Installing } else { Stage::Downloading };
        self.snapshot.channel.clone_from(&self.pending_channel);
        if bytes.is_none() {
            self.snapshot.downloaded = 0;
            self.snapshot.total = 0;
        }
        self.snapshot.detail.clear();
        Ok((update, bytes))
    }
}

static RUNTIME: OnceLock<Mutex<Runtime<Update>>> = OnceLock::new();

fn state() -> MutexGuard<'static, Runtime<Update>> {
    RUNTIME.get_or_init(|| Mutex::new(Runtime::new()))
        .lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn now() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub(super) fn change<T>(app: &AppHandle, update: impl FnOnce(&mut Runtime<Update>) -> Result<T, UserError>) -> Result<T, UserError> {
    let (result, snapshot) = {
        let mut runtime = state();
        let result = update(&mut runtime)?;
        runtime.snapshot.revision += 1;
        (result, runtime.snapshot.clone())
    };
    let _ = app.emit(STATE_EVENT, snapshot);
    Ok(result)
}

#[tauri::command]
pub fn updater_state() -> UpdateSnapshot {
    state().snapshot.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn available() -> Runtime<u8> {
        let mut runtime = Runtime::new();
        runtime.begin_check("stable").unwrap();
        runtime.complete_check(Some((1, "1.2.0".into(), "Notes".into())));
        runtime
    }

    #[test]
    fn check_reservation_rejects_other_checks_and_installs() {
        let mut runtime = available();
        runtime.begin_check("stable").unwrap();
        assert!(runtime.begin_check("beta").is_err());
        assert!(runtime.begin_install(Some("1.2.0"), Some("stable")).is_err());
        assert_eq!(runtime.snapshot.next_version, "1.2.0");
        assert_eq!(runtime.snapshot.notes, "Notes");
    }

    #[test]
    fn installation_pins_target_and_blocks_background_work() {
        let mut runtime = available();
        assert!(runtime.begin_install(Some("1.1.0"), Some("stable")).is_err());
        assert!(runtime.begin_install(Some("1.2.0"), Some("beta")).is_err());
        assert_eq!(runtime.pending, Some(1));
        assert_eq!(runtime.begin_install(Some("1.2.0"), Some("stable")), Ok((1, None)));
        assert!(runtime.begin_check("beta").is_err());
        assert!(runtime.begin_install(None, None).is_err());
    }

    #[test]
    fn failures_preserve_success_and_candidates_and_success_resets_backoff() {
        let mut runtime = available();
        let last_success = runtime.snapshot.last_checked_at;
        runtime.begin_check("beta").unwrap();
        runtime.fail("offline", true);
        assert_eq!(runtime.snapshot.last_checked_at, last_success);
        assert_eq!(runtime.snapshot.next_version, "1.2.0");
        assert_eq!(runtime.snapshot.check_failures, 1);
        assert_eq!(runtime.snapshot.channel.as_deref(), Some("stable"));
        assert!(runtime.begin_install(Some("1.2.0"), Some("beta")).is_err());
        runtime.begin_check("stable").unwrap();
        runtime.complete_check(None);
        assert_eq!(runtime.snapshot.check_failures, 0);
        assert!(runtime.pending.is_none());
        assert!(runtime.snapshot.next_version.is_empty());
    }

    #[test]
    fn install_failure_does_not_change_check_retry_count() {
        let mut runtime = available();
        runtime.begin_install(None, None).unwrap();
        runtime.fail("download failed", false);
        assert_eq!(runtime.snapshot.check_failures, 0);
        assert_eq!(runtime.snapshot.stage, Stage::Error);
        runtime.begin_check("stable").unwrap();
    }

    #[test]
    fn a_background_download_keeps_its_installer_until_installed() {
        let mut runtime = available();
        assert!(runtime.begin_download("1.1.0", "stable").is_err());
        let update = runtime.begin_download("1.2.0", "stable").unwrap();
        assert!(runtime.begin_check("stable").is_err());
        runtime.finish_download(update, vec![7]);
        assert_eq!(runtime.snapshot.stage, Stage::Ready);
        runtime.begin_check("stable").unwrap();
        runtime.complete_check(Some((2, "1.2.0".into(), "Notes".into())));
        assert_eq!(runtime.snapshot.stage, Stage::Ready);
        assert_eq!(runtime.begin_install(Some("1.2.0"), Some("stable")), Ok((2, Some(vec![7]))));
        assert_eq!(runtime.snapshot.stage, Stage::Installing);
    }

    #[test]
    fn a_newer_version_or_a_failed_download_drops_back_to_available() {
        let mut runtime = available();
        let update = runtime.begin_download("1.2.0", "stable").unwrap();
        runtime.finish_download(update, vec![7]);
        runtime.begin_check("stable").unwrap();
        runtime.complete_check(Some((3, "1.3.0".into(), String::new())));
        assert_eq!(runtime.snapshot.stage, Stage::Available);
        assert!(runtime.ready.is_none());
        let update = runtime.begin_download("1.3.0", "stable").unwrap();
        runtime.download_failed(update, "offline");
        assert_eq!(runtime.snapshot.stage, Stage::Available);
        assert_eq!(runtime.pending, Some(3));
    }

    #[test]
    fn competing_windows_only_reserve_one_operation() {
        use std::sync::{Arc, Barrier};
        let runtime = Arc::new(Mutex::new(available()));
        let barrier = Arc::new(Barrier::new(8));
        let threads: Vec<_> = (0..8).map(|_| {
            let runtime = Arc::clone(&runtime);
            let barrier = Arc::clone(&barrier);
            std::thread::spawn(move || {
                barrier.wait();
                runtime.lock().unwrap().begin_check("stable").is_ok()
            })
        }).collect();
        let winners = threads.into_iter().map(|thread| usize::from(thread.join().unwrap())).sum::<usize>();
        assert_eq!(winners, 1);
    }

    #[test]
    fn snapshot_serializes_the_frontend_contract() {
        let runtime: Runtime<()> = Runtime::new();
        let value = serde_json::to_value(runtime.snapshot).unwrap();
        assert_eq!(value["stage"], "idle");
        assert_eq!(value["revision"], 0);
        assert!(value["startedAt"].as_i64().unwrap() > 0);
        assert!(value["lastAttemptAt"].is_null());
        assert!(value["lastCheckedAt"].is_null());
        assert_eq!(value["checkFailures"], 0);
    }
}
