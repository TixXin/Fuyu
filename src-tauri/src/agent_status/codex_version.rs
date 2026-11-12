use std::{
    fs::File,
    io::{BufRead, BufReader, Read},
    path::Path,
};

use serde_json::Value;

use super::codex_usage::{codex_home, newest_rollouts};

const FIRST_ASYNC_HOOKS_RELEASE: (u64, u64) = (0, 148);
const HEAD_BYTES: u64 = 4 * 1024 * 1024;

pub(super) fn codex_runs_async_hooks(home_dir: &Path) -> Option<bool> {
    newest_rollouts(&codex_home(home_dir))
        .iter()
        .find_map(|path| read_first_line(path).as_deref().and_then(rollout_cli_version))
        .and_then(|version| runs_async_hooks(&version))
}

pub(super) fn rollout_cli_version(first_line: &str) -> Option<String> {
    let record = serde_json::from_str::<Value>(first_line).ok()?;
    if record["type"] != "session_meta" {
        return None;
    }
    record["payload"]["cli_version"]
        .as_str()
        .filter(|version| !version.is_empty())
        .map(str::to_string)
}

pub(super) fn runs_async_hooks(version: &str) -> Option<bool> {
    let mut parts = version.split(['.', '-', '+']);
    let major = parts.next()?.parse::<u64>().ok()?;
    let minor = parts.next()?.parse::<u64>().ok()?;
    Some((major, minor) >= FIRST_ASYNC_HOOKS_RELEASE)
}

fn read_first_line(path: &Path) -> Option<String> {
    let file = File::open(path).ok()?;
    let mut line = Vec::new();
    BufReader::new(file.take(HEAD_BYTES))
        .read_until(b'\n', &mut line)
        .ok()?;
    Some(String::from_utf8_lossy(&line).into_owned())
}
