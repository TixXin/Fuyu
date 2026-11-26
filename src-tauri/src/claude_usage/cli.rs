use std::{
    env, fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};

use serde_json::Value;

use super::{
    source::{self, FetchError, Limits},
    UsageErrorKind,
};
use crate::system::{CommandExt, CREATE_NO_WINDOW};

const ANSWER_TIMEOUT: Duration = Duration::from_secs(30);
const EXIT_GRACE: Duration = Duration::from_secs(10);
const REQUEST_ID: &str = "fuyu-usage";
const SETTINGS_FILE: &str = "fuyu-claude-usage-settings.json";
const SETTINGS: &str = r#"{"disableAllHooks":true}"#;
const SEARCH_DEPTH: usize = 5;
const SESSION_ENV: [&str; 5] = ["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_SSE_PORT"];

pub(super) fn fetch(home_dir: &Path, proxy: Option<&str>) -> Option<Result<Limits, FetchError>> {
    let mut last = None;
    for binary in candidates(home_dir) {
        match query(&binary, proxy) {
            Ok(limits) => return Some(Ok(limits)),
            Err(error) => last = Some(Err(error)),
        }
    }
    last
}

fn candidates(home_dir: &Path) -> Vec<PathBuf> {
    let mut found: Vec<PathBuf> = crate::cc_connect::find_command("claude").into_iter().collect();
    if let Some(bundled) = bundled(&crate::agent_status::claude_desktop_dir(home_dir).join("claude-code")) {
        if !found.contains(&bundled) {
            found.push(bundled);
        }
    }
    found
}

pub(super) fn bundled(root: &Path) -> Option<PathBuf> {
    let mut versions: Vec<(Vec<u64>, PathBuf)> = fs::read_dir(root)
        .ok()?
        .flatten()
        .filter_map(|entry| Some((version(&entry.file_name().to_string_lossy())?, entry.path())))
        .collect();
    versions.sort_by(|first, second| second.0.cmp(&first.0));
    versions.into_iter().find_map(|(_, dir)| find_binary(&dir, SEARCH_DEPTH))
}

fn version(name: &str) -> Option<Vec<u64>> {
    let parts = name.split('.').map(|part| part.parse().ok()).collect::<Option<Vec<u64>>>()?;
    (parts.len() >= 2).then_some(parts)
}

fn find_binary(dir: &Path, depth: usize) -> Option<PathBuf> {
    let name = if cfg!(windows) { "claude.exe" } else { "claude" };
    let mut entries: Vec<_> = fs::read_dir(dir).ok()?.flatten().map(|entry| entry.path()).collect();
    entries.sort();
    if let Some(found) = entries.iter().find(|path| path.is_file() && path.file_name().is_some_and(|file| file == name)) {
        return Some(found.clone());
    }
    if depth == 0 {
        return None;
    }
    entries.iter().filter(|path| path.is_dir()).find_map(|path| find_binary(path, depth - 1))
}

fn query(binary: &Path, proxy: Option<&str>) -> Result<Limits, FetchError> {
    let failed = |what: String| FetchError::new(UsageErrorKind::Network, what);
    let work_dir = env::temp_dir();
    let settings = work_dir.join(SETTINGS_FILE);
    fs::write(&settings, SETTINGS).map_err(|error| failed(format!("Could not write {}: {error}", settings.display())))?;
    let mut command = Command::new(binary);
    command
        .args(["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--settings"])
        .arg(&settings)
        .current_dir(&work_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW);
    for key in SESSION_ENV {
        command.env_remove(key);
    }
    if let Some(proxy) = proxy.filter(|_| env::var_os("HTTPS_PROXY").is_none() && env::var_os("https_proxy").is_none()) {
        command.env("HTTPS_PROXY", proxy);
    }
    let mut child = command
        .spawn()
        .map_err(|error| failed(format!("Could not start {}: {error}", binary.display())))?;
    let result = ask(&mut child);
    finish(&mut child);
    result
}

fn ask(child: &mut Child) -> Result<Limits, FetchError> {
    let failed = |what: String| FetchError::new(UsageErrorKind::Network, what);
    let mut stdin = child.stdin.take().ok_or_else(|| failed("Claude Code has no input pipe.".into()))?;
    writeln!(stdin, "{}", request()).map_err(|error| failed(format!("Could not ask Claude Code for the usage: {error}")))?;
    drop(stdin);
    let stdout = child.stdout.take().ok_or_else(|| failed("Claude Code has no output pipe.".into()))?;
    let (sender, receiver) = mpsc::channel();
    thread::Builder::new()
        .name("claude-usage-cli".into())
        .spawn(move || {
            let found = BufReader::new(stdout).lines().map_while(Result::ok).find_map(|line| answer(&line));
            let _ = sender.send(found);
        })
        .map_err(|error| failed(format!("Could not read Claude Code's answer: {error}")))?;
    match receiver.recv_timeout(ANSWER_TIMEOUT) {
        Ok(Some(result)) => result,
        Ok(None) => Err(FetchError::new(UsageErrorKind::InvalidResponse, "Claude Code closed without answering the usage request; it may be too old to support it.")),
        Err(_) => Err(failed("Claude Code did not answer the usage request in time.".into())),
    }
}

fn finish(child: &mut Child) {
    let deadline = Instant::now() + EXIT_GRACE;
    while Instant::now() < deadline {
        if !matches!(child.try_wait(), Ok(None)) {
            return;
        }
        thread::sleep(Duration::from_millis(100));
    }
    let _ = child.kill();
    let _ = child.wait();
}

pub(super) fn request() -> String {
    serde_json::json!({
        "type": "control_request",
        "request_id": REQUEST_ID,
        "request": { "subtype": "get_usage", "skip_behaviors": true },
    })
    .to_string()
}

pub(super) fn answer(line: &str) -> Option<Result<Limits, FetchError>> {
    let value = serde_json::from_str::<Value>(line).ok()?;
    if value["type"] != "control_response" || value["response"]["request_id"] != REQUEST_ID {
        return None;
    }
    let response = &value["response"];
    if response["subtype"] != "success" {
        let reason = response["error"].as_str().unwrap_or("unknown error");
        return Some(Err(FetchError::new(UsageErrorKind::InvalidResponse, format!("Claude Code could not read the usage: {reason}"))));
    }
    let limits = &response["response"]["rate_limits"];
    if !limits.is_object() {
        return Some(Err(FetchError::new(
            UsageErrorKind::LoginRequired,
            "Claude Code has no plan usage to show: it is not signed in with a Claude plan, or its nonessential traffic is turned off.",
        )));
    }
    Some(source::parse_api_usage(&limits.to_string()))
}

#[cfg(test)]
#[path = "cli_tests.rs"]
mod tests;
