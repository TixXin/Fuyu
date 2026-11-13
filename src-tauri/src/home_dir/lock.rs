use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::OnceLock,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

pub(crate) const LOCK_FILE: &str = "fuyu.lock";
const REFRESH: Duration = Duration::from_secs(60);
const STALE_MS: u64 = 3 * 60 * 1000;

static HELD: OnceLock<PathBuf> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Lock {
    pub computer: String,
    pub pid: u32,
    pub at: u64,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|elapsed| elapsed.as_millis() as u64).unwrap_or(0)
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn this_computer() -> String {
    std::env::var("COMPUTERNAME").unwrap_or_default()
}

#[cfg(target_os = "macos")]
pub(crate) fn this_computer() -> String {
    static NAME: OnceLock<String> = OnceLock::new();
    NAME.get_or_init(|| {
        std::process::Command::new("scutil")
            .args(["--get", "ComputerName"])
            .output()
            .ok()
            .filter(|output| output.status.success())
            .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
            .unwrap_or_default()
    })
    .clone()
}

pub(crate) fn read(home: &Path) -> Option<Lock> {
    serde_json::from_str(&fs::read_to_string(home.join(LOCK_FILE)).ok()?).ok()
}

pub(crate) fn held_elsewhere(lock: Option<Lock>, computer: &str, now: u64) -> Option<Lock> {
    lock.filter(|lock| !lock.computer.eq_ignore_ascii_case(computer) && now.saturating_sub(lock.at) < STALE_MS)
}

fn write(path: &Path) {
    let lock = Lock { computer: this_computer(), pid: std::process::id(), at: now_ms() };
    if let Ok(text) = serde_json::to_string(&lock) {
        let _ = crate::fs_write::replace_file(path, text.as_bytes());
    }
}

pub(crate) fn conflict(home: &Path) -> Option<Lock> {
    held_elsewhere(read(home), &this_computer(), now_ms())
}

pub(crate) fn take(home: &Path) {
    let path = home.join(LOCK_FILE);
    write(&path);
    if HELD.set(path.clone()).is_err() {
        return;
    }
    let _ = thread::Builder::new().name("home-lock".into()).spawn(move || loop {
        thread::sleep(REFRESH);
        write(&path);
    });
}

pub(crate) fn release() {
    let Some(path) = HELD.get() else {
        return;
    };
    let ours = read(path.parent().unwrap_or(path))
        .is_some_and(|lock| lock.pid == std::process::id() && lock.computer.eq_ignore_ascii_case(&this_computer()));
    if ours {
        let _ = fs::remove_file(path);
    }
}

pub(crate) fn conflict_message(home: &Path, lock: &Lock) -> String {
    format!(
        "浮屿的家目录 {home} 正在被电脑「{computer}」上的浮屿使用。两台电脑同时用一个家目录会互相覆盖数据，所以这次不启动。\n请先在那台电脑上退出浮屿；那台电脑已经关机的话，等 3 分钟再启动。\n\nThe Fuyu home folder {home} is in use by Fuyu on \"{computer}\". Two computers using one home would overwrite each other's data, so Fuyu will not start. Quit Fuyu there first, or if that computer is off, start again in 3 minutes.",
        home = home.display(),
        computer = lock.computer,
    )
}

#[cfg(test)]
mod tests {
    use super::{held_elsewhere, Lock, STALE_MS};

    fn lock(computer: &str, at: u64) -> Option<Lock> {
        Some(Lock { computer: computer.into(), pid: 1, at })
    }

    #[test]
    fn a_fresh_lock_of_another_computer_blocks() {
        let now = 10_000_000;
        assert!(held_elsewhere(lock("LAPTOP", now - 1_000), "DESKTOP", now).is_some());
    }

    #[test]
    fn this_computer_a_stale_lock_or_no_lock_does_not_block() {
        let now = 10_000_000;
        assert!(held_elsewhere(lock("desktop", now), "DESKTOP", now).is_none());
        assert!(held_elsewhere(lock("LAPTOP", now - STALE_MS), "DESKTOP", now).is_none());
        assert!(held_elsewhere(None, "DESKTOP", now).is_none());
    }
}
