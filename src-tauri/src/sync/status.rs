use serde::Serialize;

use crate::user_error::UserError;

use super::{
    config::{SyncBackendKind, SyncCategory, SyncConfig},
    layout::DeviceInfo,
    round::{Outcome, RoundResult},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncPhase {
    Off,
    Idle,
    Syncing,
    FolderMissing,
    NeedsConfirm,
    NewerVersion,
    Locked,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EncryptionState {
    Off,
    Unlocked,
    Locked,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptionSummary {
    pub state: EncryptionState,
    pub has_local_key: bool,
    pub key_id: Option<String>,
}

impl Default for EncryptionSummary {
    fn default() -> Self {
        Self {
            state: EncryptionState::Off,
            has_local_key: false,
            key_id: None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CategoryState {
    Off,
    Waiting,
    Ok,
    NotReady,
    NewerVersion,
    NeedsConfirm,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryStatus {
    pub category: SyncCategory,
    pub state: CategoryState,
    pub message: Option<String>,
    pub last_sync_at: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ConfirmReason {
    ManyDeletions,
    RemoteCleared,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConfirm {
    pub reason: ConfirmReason,
    pub category: Option<SyncCategory>,
    pub removed: usize,
    pub total: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncDevice {
    pub device_id: String,
    pub name: String,
    pub platform: String,
    pub app_version: String,
    pub last_sync_at: u64,
    pub this_device: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavSummary {
    pub url: String,
    pub username: String,
    pub has_password: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub phase: SyncPhase,
    pub backend: SyncBackendKind,
    pub folder: Option<String>,
    pub webdav: Option<WebdavSummary>,
    pub encryption: EncryptionSummary,
    pub device_id: Option<String>,
    pub last_sync_at: Option<u64>,
    pub last_error: Option<String>,
    pub(crate) error: Option<UserError>,
    pub confirm: Option<SyncConfirm>,
    pub categories: Vec<CategoryStatus>,
    pub optional_groups: Vec<String>,
    pub devices: Vec<SyncDevice>,
    pub skipped_files: Vec<String>,
}

impl SyncStatus {
    pub(crate) fn new(
        config: &SyncConfig,
        device_id: Option<String>,
        has_webdav_password: bool,
        has_encryption_key: bool,
    ) -> Self {
        let mut status = Self {
            phase: SyncPhase::Off,
            backend: SyncBackendKind::Off,
            folder: None,
            webdav: None,
            encryption: EncryptionSummary {
                state: EncryptionState::Off,
                has_local_key: has_encryption_key,
                key_id: None,
            },
            device_id,
            last_sync_at: None,
            last_error: None,
            error: None,
            confirm: None,
            categories: Vec::new(),
            optional_groups: Vec::new(),
            devices: Vec::new(),
            skipped_files: Vec::new(),
        };
        status.configure(config, has_webdav_password, has_encryption_key);
        status
    }

    pub(crate) fn configure(
        &mut self,
        config: &SyncConfig,
        has_webdav_password: bool,
        has_encryption_key: bool,
    ) {
        self.backend = config.active_backend();
        self.folder = config.folder.clone();
        self.webdav = config.webdav.as_ref().map(|webdav| WebdavSummary {
            url: webdav.url.clone(),
            username: webdav.username.clone(),
            has_password: has_webdav_password,
        });
        self.encryption.has_local_key = has_encryption_key;
        self.optional_groups = config.optional_groups.clone();
        if self.backend == SyncBackendKind::Off {
            self.phase = SyncPhase::Off;
            self.confirm = None;
            self.last_error = None;
            self.error = None;
            self.encryption.state = EncryptionState::Off;
            self.encryption.key_id = None;
        } else if self.phase == SyncPhase::Off {
            self.phase = SyncPhase::Idle;
        }
        let previous = std::mem::take(&mut self.categories);
        self.categories = SyncCategory::ALL
            .iter()
            .map(|category| {
                let kept = previous.iter().find(|status| status.category == *category);
                let state = match (config.enabled(*category), kept) {
                    (false, _) => CategoryState::Off,
                    (true, Some(kept)) if kept.state != CategoryState::Off => kept.state,
                    (true, _) => CategoryState::Waiting,
                };
                CategoryStatus {
                    category: *category,
                    state,
                    message: kept
                        .filter(|_| state != CategoryState::Off)
                        .and_then(|kept| kept.message.clone()),
                    last_sync_at: kept.and_then(|kept| kept.last_sync_at),
                }
            })
            .collect();
    }

    fn set_category(&mut self, category: SyncCategory, state: CategoryState, message: Option<String>, now: u64) {
        if let Some(status) = self.categories.iter_mut().find(|status| status.category == category) {
            status.state = state;
            status.message = message;
            if state == CategoryState::Ok {
                status.last_sync_at = Some(now);
            }
        }
    }

    pub(crate) fn finish(
        &mut self,
        result: RoundResult,
        error: Option<UserError>,
        me: &str,
        now: u64,
    ) {
        self.confirm = None;
        self.last_error = None;
        self.error = None;
        match result {
            RoundResult::FolderMissing(message) => {
                self.phase = SyncPhase::FolderMissing;
                self.last_error = Some(message);
                self.error = error;
            }
            RoundResult::RemoteCleared => {
                self.phase = SyncPhase::NeedsConfirm;
                self.confirm = Some(SyncConfirm {
                    reason: ConfirmReason::RemoteCleared,
                    category: None,
                    removed: 0,
                    total: 0,
                });
            }
            RoundResult::NewerVersion => self.phase = SyncPhase::NewerVersion,
            RoundResult::EncryptionLocked { key_id } => {
                self.phase = SyncPhase::Locked;
                self.encryption.state = EncryptionState::Locked;
                self.encryption.key_id = Some(key_id);
            }
            RoundResult::Failed(message) => {
                self.phase = SyncPhase::Error;
                self.last_error = Some(message);
                self.error = error;
            }
            RoundResult::Done {
                categories,
                devices,
                skipped,
                encrypted_key_id,
            } => {
                self.phase = SyncPhase::Idle;
                self.last_sync_at = Some(now);
                self.skipped_files = skipped;
                match encrypted_key_id {
                    Some(key_id) => {
                        self.encryption.state = EncryptionState::Unlocked;
                        self.encryption.key_id = Some(key_id);
                    }
                    None => {
                        self.encryption.state = EncryptionState::Off;
                        self.encryption.key_id = None;
                    }
                }
                self.devices = devices.into_iter().map(|device| device_row(device, me)).collect();
                for (category, outcome) in categories {
                    self.record(category, outcome, now);
                }
                if self.phase == SyncPhase::Error {
                    self.error = error;
                }
            }
        }
    }

    fn record(&mut self, category: SyncCategory, outcome: Outcome, now: u64) {
        match outcome {
            Outcome::Synced { .. } => self.set_category(category, CategoryState::Ok, None, now),
            Outcome::NotReady => self.set_category(category, CategoryState::NotReady, None, now),
            Outcome::NewerVersion => self.set_category(category, CategoryState::NewerVersion, None, now),
            Outcome::NeedsConfirm { removed, total } => {
                self.set_category(category, CategoryState::NeedsConfirm, None, now);
                if self.confirm.is_none() {
                    self.phase = SyncPhase::NeedsConfirm;
                    self.confirm = Some(SyncConfirm {
                        reason: ConfirmReason::ManyDeletions,
                        category: Some(category),
                        removed,
                        total,
                    });
                }
            }
            Outcome::Failed(message) => {
                if self.phase == SyncPhase::Idle {
                    self.phase = SyncPhase::Error;
                    self.last_error = Some(message.clone());
                }
                self.set_category(category, CategoryState::Error, Some(message), now);
            }
        }
    }
}

fn device_row(device: DeviceInfo, me: &str) -> SyncDevice {
    SyncDevice {
        this_device: device.device_id == me,
        device_id: device.device_id,
        name: device.name,
        platform: device.platform,
        app_version: device.app_version,
        last_sync_at: device.last_sync_at,
    }
}
