use std::{fs, path::Path};

use serde::Deserialize;

use crate::win32;

pub(super) const DIR_NAME: &str = "agent-sessions";
const START_TIME_TOLERANCE: u64 = 10;

#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SessionRecord {
    pub(super) provider: Option<String>,
    pub(super) source: Option<String>,
    pub(super) pid: Option<u32>,
    pub(super) pid_started: Option<u64>,
    pub(super) orca_handle: Option<String>,
    pub(super) wt_session: Option<String>,
    pub(super) term_program: Option<String>,
    pub(super) started_at: Option<i64>,
    pub(super) ended_at: Option<i64>,
    pub(super) end_reason: Option<String>,
}

pub(super) fn is_session_id(id: &str) -> bool {
    (1..=128).contains(&id.len()) && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

pub(super) fn parse(text: &str) -> Option<SessionRecord> {
    serde_json::from_str(text.trim_start_matches('\u{feff}')).ok()
}

pub(super) fn read(app_dir: &Path, session_id: &str) -> Option<SessionRecord> {
    if !is_session_id(session_id) {
        return None;
    }
    parse(&fs::read_to_string(app_dir.join(DIR_NAME).join(format!("{session_id}.json"))).ok()?)
}

pub(super) fn same_start(recorded: Option<u64>, actual: Option<u64>) -> bool {
    match (recorded, actual) {
        (Some(recorded), Some(actual)) => recorded.abs_diff(actual) <= START_TIME_TOLERANCE,
        (None, Some(_)) => true,
        _ => false,
    }
}

impl SessionRecord {
    pub(super) fn live_pid(&self) -> Option<u32> {
        let pid = self.pid.filter(|pid| *pid != 0)?;
        same_start(self.pid_started, win32::process_times::start_time(pid)).then_some(pid)
    }

    pub(super) fn has_ended(&self) -> bool {
        self.ended_at.is_some() || (self.pid.is_some_and(|pid| pid != 0) && self.live_pid().is_none())
    }

    pub(super) fn orca_handle(&self) -> Option<String> {
        self.orca_handle.clone().filter(|handle| super::orca::is_terminal_handle(handle))
    }
}
