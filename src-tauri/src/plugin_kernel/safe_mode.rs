use std::{
    path::{Path, PathBuf},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

pub(super) const FILE: &str = "safe-mode.json";
pub(super) const MODES: [&str; 2] = ["third-party", "minimal"];
pub(super) const HEALTHY_AFTER: Duration = Duration::from_secs(60);
const CLOCK_GAP: Duration = Duration::from_secs(5);
const ASKED_TO_RESTART: &str = "asked to restart";
const HEARTBEAT: &str = "heartbeat";
const THIRD_PARTY_AFTER: u32 = 2;
const MINIMAL_AFTER: u32 = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum Cause {
    Variable,
    Shift,
    Failures,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SafeMode {
    pub(super) mode: String,
    pub(super) cause: Cause,
    pub(super) failures: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Record {
    failures: u32,
    updated_at: u64,
}

pub(super) fn choose(variable: Option<&str>, shift: bool, failures: u32) -> Option<SafeMode> {
    let safe = |mode: &str, cause| Some(SafeMode { mode: mode.to_owned(), cause, failures });
    if let Some(mode) = variable.map(str::trim).filter(|mode| MODES.contains(mode)) {
        return safe(mode, Cause::Variable);
    }
    if failures >= MINIMAL_AFTER {
        return safe("minimal", Cause::Failures);
    }
    if shift {
        return safe("third-party", Cause::Shift);
    }
    if failures >= THIRD_PARTY_AFTER {
        return safe("third-party", Cause::Failures);
    }
    None
}

#[derive(Debug)]
pub(super) struct Tracker {
    path: Option<PathBuf>,
    variable: Option<String>,
    shift: bool,
    failures: u32,
    started: Option<(u32, Instant, SystemTime)>,
    current: Option<SafeMode>,
}

impl Tracker {
    pub(super) fn new(dir: Option<&Path>, variable: Option<String>, shift: bool) -> Self {
        let path = dir.map(|dir| dir.join(FILE));
        let failures = path.as_deref().and_then(read).map(|record| record.failures).unwrap_or(0);
        Self { path, variable, shift, failures, started: None, current: None }
    }

    pub(super) fn starting(&mut self, generation: u32) -> Option<SafeMode> {
        self.started = Some((generation, Instant::now(), SystemTime::now()));
        self.current = choose(self.variable.as_deref(), self.shift, self.failures);
        self.current.clone()
    }

    pub(super) fn current(&self) -> Option<SafeMode> {
        self.current.clone()
    }

    pub(super) fn went_down(&mut self, generation: u32, reason: &str) {
        let ran = self.started.filter(|(started, ..)| *started == generation).map(|(_, at, wall)| (at.elapsed(), wall.elapsed().unwrap_or_default()));
        let ran = match ran {
            Some((ran, wall)) if counts_as_failure(reason, ran, wall) => Some(ran.max(wall)),
            Some((ran, wall)) if ran.max(wall) >= HEALTHY_AFTER => Some(ran.max(wall)),
            _ => None,
        };
        self.went_down_after(generation, ran);
    }

    pub(super) fn went_down_after(&mut self, generation: u32, ran: Option<Duration>) {
        match ran {
            Some(ran) if ran < HEALTHY_AFTER => self.set_failures(self.failures.saturating_add(1)),
            Some(_) => self.set_failures(0),
            None => {}
        }
        if self.started.is_some_and(|(started, ..)| started == generation) {
            self.started = None;
        }
    }

    pub(super) fn healthy(&mut self, generation: u32) {
        if self.ran_for(generation).is_some_and(|ran| ran >= HEALTHY_AFTER) {
            self.set_failures(0);
        }
    }

    pub(super) fn leave(&mut self) -> bool {
        if self.current.as_ref().is_some_and(|safe| safe.cause == Cause::Variable) {
            return false;
        }
        self.shift = false;
        self.started = None;
        self.set_failures(0);
        true
    }

    fn ran_for(&self, generation: u32) -> Option<Duration> {
        self.started.filter(|(started, ..)| *started == generation).map(|(_, at, _)| at.elapsed())
    }

    fn set_failures(&mut self, failures: u32) {
        if self.failures == failures {
            return;
        }
        self.failures = failures;
        if let Some(path) = &self.path {
            let updated_at = SystemTime::now().duration_since(UNIX_EPOCH).map(|since| since.as_millis() as u64).unwrap_or(0);
            if let Err(error) = write(path, &Record { failures, updated_at }) {
                eprintln!("[plugins-v3] could not save {}: {error}", path.display());
            }
        }
    }
}

pub(super) fn counts_as_failure(reason: &str, ran: Duration, wall: Duration) -> bool {
    if reason == ASKED_TO_RESTART {
        return false;
    }
    if reason.contains(HEARTBEAT) && wall.saturating_sub(ran) > CLOCK_GAP {
        return false;
    }
    ran.max(wall) < HEALTHY_AFTER
}

fn read(path: &Path) -> Option<Record> {
    serde_json::from_slice(&std::fs::read(path).ok()?).ok()
}

fn write(path: &Path, record: &Record) -> std::io::Result<()> {
    let text = serde_json::to_vec_pretty(record).map_err(std::io::Error::other)?;
    crate::fs_write::replace_file(path, &text)
}
