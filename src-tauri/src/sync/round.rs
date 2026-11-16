use serde_json::Value;
use std::path::Path;

use super::{
    backend::{Backend, BackendError},
    base::{self, State},
    categories::Category,
    codec,
    config::SyncCategory,
    device,
    layout::{self, DeviceInfo, Doc, DocFile, Meta, SCHEMA_VERSION},
    merge::{self, Rules},
    Hlc,
};

const DEVICE_INFO_EVERY_MS: u64 = 60 * 60 * 1000;

pub(crate) trait Clockwork {
    fn tick(&mut self) -> Hlc;
    fn observe(&mut self, seen: &Hlc);
    fn now_ms(&self) -> u64;
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(crate) struct Options {
    pub allow_deletions: bool,
    pub allow_reset: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Outcome {
    Synced { changed_local: bool, pushed: bool },
    NotReady,
    NewerVersion,
    NeedsConfirm { removed: usize, total: usize },
    Failed(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum RoundResult {
    FolderMissing(String),
    RemoteCleared,
    NewerVersion,
    Failed(String),
    Done { categories: Vec<(SyncCategory, Outcome)>, devices: Vec<DeviceInfo>, skipped: Vec<String> },
}

pub(crate) struct Round<'a> {
    pub backend: &'a dyn Backend,
    pub me: &'a DeviceInfo,
    pub state_dir: &'a Path,
    pub clock: &'a mut dyn Clockwork,
    pub options: Options,
    pub backup: &'a mut dyn FnMut() -> Result<(), String>,
}

enum Remote {
    Docs(Vec<Doc>),
    Newer,
}

fn read_json(backend: &dyn Backend, path: &str) -> Result<Option<Value>, BackendError> {
    match backend.read(path)? {
        Some(bytes) => codec::decode(path, &bytes).map(Some).map_err(BackendError::Failed),
        None => Ok(None),
    }
}

impl Round<'_> {
    fn check_meta(&mut self, state: &State) -> Result<(), RoundResult> {
        let failed = |error: BackendError| match error {
            BackendError::Unavailable(message) => RoundResult::FolderMissing(message),
            BackendError::Failed(message) => RoundResult::Failed(message),
        };
        match read_json(self.backend, layout::META_FILE).map_err(failed)? {
            Some(meta) if layout::schema_version(&meta) > u64::from(SCHEMA_VERSION) => Err(RoundResult::NewerVersion),
            Some(_) => Ok(()),
            None if state.synced_once && !self.options.allow_reset => Err(RoundResult::RemoteCleared),
            None => {
                let meta = codec::encode(layout::META_FILE, &Meta::new(self.clock.now_ms())).map_err(RoundResult::Failed)?;
                self.backend.write(layout::META_FILE, &meta).map_err(failed)
            }
        }
    }

    fn others(&self, skipped: &mut Vec<String>) -> Result<(Vec<String>, Vec<DeviceInfo>), BackendError> {
        let mut ids = Vec::new();
        let mut devices = Vec::new();
        for listed in self.backend.list(layout::DEVICES_DIR)? {
            if !listed.is_dir || !device::is_valid_id(&listed.name) {
                continue;
            }
            if listed.name != self.me.device_id {
                ids.push(listed.name.clone());
            }
            let path = layout::device_info_path(&listed.name);
            match read_json(self.backend, &path).map(|value| value.map(serde_json::from_value::<DeviceInfo>)) {
                Ok(Some(Ok(info))) if info.device_id == listed.name => devices.push(info),
                Ok(None) => {}
                Ok(Some(_)) | Err(BackendError::Failed(_)) => skipped.push(path),
                Err(error) => return Err(error),
            }
        }
        Ok((ids, devices))
    }

    fn remote_docs(&self, category: SyncCategory, others: &[String], skipped: &mut Vec<String>) -> Result<Remote, BackendError> {
        let mut docs = Vec::new();
        for other in others {
            let path = layout::category_path(other, category.name());
            let value = match read_json(self.backend, &path) {
                Ok(Some(value)) => value,
                Ok(None) => continue,
                Err(BackendError::Failed(_)) => {
                    skipped.push(path);
                    continue;
                }
                Err(error) => return Err(error),
            };
            if layout::schema_version(&value) > u64::from(SCHEMA_VERSION) {
                return Ok(Remote::Newer);
            }
            match serde_json::from_value::<DocFile>(value) {
                Ok(file) if file.category == category.name() && file.device_id == *other => docs.push(file.doc),
                _ => skipped.push(path),
            }
        }
        Ok(Remote::Docs(docs))
    }

    fn push(&mut self, category: SyncCategory, doc: &Doc) -> Result<bool, BackendError> {
        let path = layout::category_path(&self.me.device_id, category.name());
        let current = read_json(self.backend, &path).ok().flatten().and_then(|value| serde_json::from_value::<DocFile>(value).ok());
        if current.as_ref().is_some_and(|file| file.doc == *doc && file.schema_version == SCHEMA_VERSION) {
            return Ok(false);
        }
        let file = DocFile { schema_version: SCHEMA_VERSION, category: category.name().into(), device_id: self.me.device_id.clone(), written_at: self.clock.now_ms(), doc: doc.clone() };
        let bytes = codec::encode(&path, &file).map_err(BackendError::Failed)?;
        self.backend.write(&path, &bytes)?;
        Ok(true)
    }

    fn sync_one(&mut self, category: &mut dyn Category, others: &[String], state: &mut State, skipped: &mut Vec<String>) -> Result<Outcome, BackendError> {
        let kind = category.kind();
        let local = match category.load() {
            Ok(Some(local)) => local,
            Ok(None) => return Ok(Outcome::NotReady),
            Err(error) => return Ok(Outcome::Failed(error)),
        };
        let remotes = match self.remote_docs(kind, others, skipped)? {
            Remote::Docs(docs) => docs,
            Remote::Newer => return Ok(Outcome::NewerVersion),
        };
        for stamp in remotes.iter().flat_map(Doc::stamps) {
            self.clock.observe(stamp);
        }
        let base = base::load(self.state_dir, kind.name());
        let first = base.is_none();
        let pinned = |id: &str| category.pinned(id);
        let rules = Rules { first, pinned: &pinned };
        let mut merged = local.clone();
        {
            let clock = &mut *self.clock;
            let mut tick = || clock.tick();
            for remote in &remotes {
                merged = merge::merge(&merged, remote, base.as_ref(), &rules, &mut tick);
            }
            category.tidy(&mut merged, &mut tick);
        }
        merge::prune(&mut merged, self.clock.now_ms());
        let removed = merge::removed(&local, &merged);
        if merge::needs_brake(&local, removed) && !self.options.allow_deletions {
            return Ok(Outcome::NeedsConfirm { removed, total: local.entries.len() });
        }
        let changed_local = merged != local;
        if changed_local {
            if first && !state.backed_up {
                if let Err(error) = (self.backup)() {
                    return Ok(Outcome::Failed(error));
                }
                state.backed_up = true;
            }
            if let Err(error) = category.store(&merged) {
                return Ok(Outcome::Failed(error));
            }
        }
        let pushed = self.push(kind, &merged)?;
        if let Err(error) = base::save(self.state_dir, kind.name(), &merged) {
            return Ok(Outcome::Failed(error));
        }
        Ok(Outcome::Synced { changed_local, pushed })
    }

    fn write_device_info(&mut self, state: &mut State, devices: &mut Vec<DeviceInfo>) {
        let now = self.clock.now_ms();
        let mut info = self.me.clone();
        info.last_sync_at = now;
        let known = devices.iter().find(|device| device.device_id == info.device_id);
        let stale = known.is_none_or(|known| known.name != info.name || known.platform != info.platform || known.app_version != info.app_version);
        if stale || now.saturating_sub(state.device_info_at) >= DEVICE_INFO_EVERY_MS {
            let path = layout::device_info_path(&info.device_id);
            if codec::encode(&path, &info).ok().is_some_and(|bytes| self.backend.write(&path, &bytes).is_ok()) {
                state.device_info_at = now;
                devices.retain(|device| device.device_id != info.device_id);
                devices.push(info);
            }
        }
    }

    pub(crate) fn run(&mut self, categories: &mut [&mut dyn Category], disabled: &[SyncCategory]) -> RoundResult {
        if let Err(error) = self.backend.check() {
            return RoundResult::FolderMissing(error.message().to_string());
        }
        let mut state = base::load_state(self.state_dir);
        if let Err(result) = self.check_meta(&state) {
            return result;
        }
        let mut skipped = Vec::new();
        let (others, mut devices) = match self.others(&mut skipped) {
            Ok(found) => found,
            Err(BackendError::Unavailable(message)) => return RoundResult::FolderMissing(message),
            Err(BackendError::Failed(message)) => return RoundResult::Failed(message),
        };
        let mut outcomes = Vec::new();
        for category in categories.iter_mut() {
            let kind = category.kind();
            let outcome = match self.sync_one(&mut **category, &others, &mut state, &mut skipped) {
                Ok(outcome) => outcome,
                Err(BackendError::Unavailable(message)) => return RoundResult::FolderMissing(message),
                Err(BackendError::Failed(message)) => Outcome::Failed(message),
            };
            outcomes.push((kind, outcome));
        }
        for kind in disabled {
            let _ = self.backend.delete(&layout::category_path(&self.me.device_id, kind.name()));
        }
        self.write_device_info(&mut state, &mut devices);
        state.synced_once = true;
        state.last_sync_at = self.clock.now_ms();
        if let Err(error) = base::save_state(self.state_dir, &state) {
            return RoundResult::Failed(error);
        }
        devices.sort_by(|left, right| left.device_id.cmp(&right.device_id));
        RoundResult::Done { categories: outcomes, devices, skipped }
    }
}
