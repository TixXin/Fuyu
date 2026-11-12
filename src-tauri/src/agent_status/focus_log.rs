use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::Path,
    time::Instant,
};

use super::snapshot::current_unix_millis;

pub(super) const FILE_NAME: &str = "agent-focus.log";
const MAX_BYTES: u64 = 64 * 1024;

pub(super) struct Attempt {
    started: Instant,
    at: i64,
    head: String,
    steps: Vec<String>,
}

impl Attempt {
    pub(super) fn new(provider: &str, session_id: Option<&str>) -> Self {
        let session: String = session_id.unwrap_or("-").chars().take(8).collect();
        Self { started: Instant::now(), at: current_unix_millis(), head: format!("{provider} {session}"), steps: Vec::new() }
    }

    pub(super) fn note(&mut self, step: impl Into<String>) {
        self.steps.push(step.into());
    }

    pub(super) fn line(&self, outcome: &str) -> String {
        format!(
            "{} {} | {} | {outcome} in {} ms\n",
            self.at,
            self.head,
            self.steps.join(", "),
            self.started.elapsed().as_millis()
        )
    }

    pub(super) fn finish(self, app_dir: Option<&Path>, outcome: &str) {
        let Some(app_dir) = app_dir else { return };
        let path = app_dir.join(FILE_NAME);
        if fs::metadata(&path).is_ok_and(|metadata| metadata.len() > MAX_BYTES) {
            if let Ok(text) = fs::read_to_string(&path) {
                let half = text.len() / 2;
                let cut = text[half..].find('\n').map_or(text.len(), |at| half + at + 1);
                let _ = fs::write(&path, &text[cut..]);
            }
        }
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
            let _ = file.write_all(self.line(outcome).as_bytes());
        }
    }
}
