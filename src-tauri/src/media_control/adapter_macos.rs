use std::{
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, OnceLock, PoisonError,
    },
    thread,
    time::{Duration, Instant},
};

use serde_json::{Map, Value};
use tauri::{AppHandle, Manager};

const PERL: &str = "/usr/bin/perl";
const SCRIPT: &str = "mediaremote-adapter.pl";
const FRAMEWORK: &str = "MediaRemoteAdapter.framework";
const COMMAND_TIMEOUT: Duration = Duration::from_secs(3);
const FIRST_RETRY: Duration = Duration::from_secs(2);
const LAST_RETRY: Duration = Duration::from_secs(60);
const QUICK_EXIT: Duration = Duration::from_secs(5);
const GIVE_UP_AFTER: u32 = 3;

#[derive(Debug, Clone)]
pub(super) struct Paths {
    script: PathBuf,
    framework: PathBuf,
}

#[derive(Debug, Clone, Default)]
pub(super) struct Snapshot {
    pub(super) info: Map<String, Value>,
    pub(super) received_ms: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Change {
    Track,
    Playback,
    Other,
}

static PATHS: OnceLock<Paths> = OnceLock::new();
static SNAPSHOT: Mutex<Option<Snapshot>> = Mutex::new(None);
static BROKEN: AtomicBool = AtomicBool::new(false);

pub(super) fn locate(app: &AppHandle) -> Option<Paths> {
    let in_framework = |framework: PathBuf| Paths { script: framework.join("Resources").join(SCRIPT), framework };
    let bundled = app.path().resource_dir().ok().and_then(|resources| Some(in_framework(resources.parent()?.join("Frameworks").join(FRAMEWORK))));
    let built = Path::new(env!("CARGO_MANIFEST_DIR")).join("target").join("mediaremote-adapter").join(FRAMEWORK);
    let dev = cfg!(debug_assertions).then(|| in_framework(built));
    bundled.into_iter().chain(dev).find(|paths| paths.script.is_file() && paths.framework.is_dir())
}

pub(super) fn snapshot() -> Option<Snapshot> {
    SNAPSHOT.lock().unwrap_or_else(PoisonError::into_inner).clone()
}

pub(super) fn is_working() -> bool {
    PATHS.get().is_some() && !BROKEN.load(Ordering::SeqCst)
}

pub(super) fn merge(current: &mut Map<String, Value>, line: &str) -> Option<Change> {
    let message: Value = serde_json::from_str(line).ok()?;
    if message.get("type").and_then(Value::as_str) != Some("data") {
        return None;
    }
    let payload = message.get("payload")?.as_object()?;
    let before = current.clone();
    if message.get("diff").and_then(Value::as_bool) != Some(true) {
        current.clear();
    }
    for (key, value) in payload {
        if value.is_null() {
            current.remove(key);
        } else {
            current.insert(key.clone(), value.clone());
        }
    }
    let differs = |keys: &[&str]| keys.iter().any(|key| before.get(*key) != current.get(*key));
    Some(if differs(&["title", "artist", "album", "bundleIdentifier"]) {
        Change::Track
    } else if differs(&["playing", "playbackRate"]) {
        Change::Playback
    } else {
        Change::Other
    })
}

fn spawn_stream(paths: &Paths) -> std::io::Result<Child> {
    Command::new(PERL)
        .arg(&paths.script)
        .arg(&paths.framework)
        .arg("stream")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
}

fn store(info: Map<String, Value>) {
    *SNAPSHOT.lock().unwrap_or_else(PoisonError::into_inner) = Some(Snapshot { info, received_ms: super::state::current_unix_millis() });
}

pub(super) fn start(app: &AppHandle, on_change: impl Fn(Change) + Send + 'static) {
    let Some(paths) = locate(app) else {
        eprintln!("media: the MediaRemote adapter is not bundled; now playing is off");
        BROKEN.store(true, Ordering::SeqCst);
        return;
    };
    let _ = PATHS.set(paths.clone());
    let _ = thread::Builder::new().name("media-adapter".into()).spawn(move || {
        let mut retry = FIRST_RETRY;
        let mut quick_exits = 0;
        loop {
            let started = Instant::now();
            let mut received = false;
            match spawn_stream(&paths) {
                Ok(mut child) => {
                    if let Some(stdout) = child.stdout.take() {
                        let mut info = Map::new();
                        for line in BufReader::new(stdout).lines() {
                            let Ok(line) = line else { break };
                            if let Some(change) = merge(&mut info, &line) {
                                received = true;
                                store(info.clone());
                                if change != Change::Other {
                                    on_change(change);
                                }
                            }
                        }
                    }
                    let _ = child.kill();
                    let _ = child.wait();
                }
                Err(error) => eprintln!("media: could not start the MediaRemote adapter: {error}"),
            }
            *SNAPSHOT.lock().unwrap_or_else(PoisonError::into_inner) = None;
            on_change(Change::Track);
            if !received && started.elapsed() < QUICK_EXIT {
                quick_exits += 1;
                if quick_exits >= GIVE_UP_AFTER {
                    eprintln!("media: the MediaRemote adapter keeps failing; falling back to AppleScript");
                    BROKEN.store(true, Ordering::SeqCst);
                    return;
                }
            } else {
                quick_exits = 0;
                retry = FIRST_RETRY;
            }
            thread::sleep(retry);
            retry = (retry * 2).min(LAST_RETRY);
        }
    });
}

pub(super) fn run(args: &[String]) -> Result<(), String> {
    let paths = PATHS.get().filter(|_| !BROKEN.load(Ordering::SeqCst)).ok_or_else(|| "The MediaRemote adapter is not available.".to_string())?;
    let mut child = Command::new(PERL)
        .arg(&paths.script)
        .arg(&paths.framework)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Could not run the MediaRemote adapter: {error}"))?;
    let deadline = Instant::now() + COMMAND_TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => return Ok(()),
            Ok(Some(status)) => return Err(format!("The MediaRemote adapter failed ({status}).")),
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(20)),
            Ok(None) | Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("The MediaRemote adapter did not answer.".to_string());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{merge, Change};
    use serde_json::Map;

    #[test]
    fn full_payloads_replace_and_diffs_patch_the_state() {
        let mut info = Map::new();
        let full = r#"{"type":"data","diff":false,"payload":{"title":"A","artist":"X","playing":true,"elapsedTime":1}}"#;
        assert_eq!(merge(&mut info, full), Some(Change::Track));
        assert_eq!(merge(&mut info, r#"{"type":"data","diff":true,"payload":{"playing":false}}"#), Some(Change::Playback));
        assert_eq!(merge(&mut info, r#"{"type":"data","diff":true,"payload":{"elapsedTime":5}}"#), Some(Change::Other));
        assert_eq!(merge(&mut info, r#"{"type":"data","diff":true,"payload":{"artist":null}}"#), Some(Change::Track));
        assert!(!info.contains_key("artist"));
        assert_eq!(merge(&mut info, r#"{"type":"data","diff":false,"payload":{}}"#), Some(Change::Track));
        assert!(info.is_empty());
        assert_eq!(merge(&mut info, "not json"), None);
    }
}
