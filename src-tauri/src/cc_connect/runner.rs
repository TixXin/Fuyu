use crate::user_error::UserError;
use crate::system::CommandExt;
use std::{
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{mpsc, Arc, Mutex, MutexGuard, OnceLock, PoisonError},
    thread,
    time::{Duration, Instant},
};

use serde_json::{Map, Value};

use super::locate::{self, EXE_NAME, FOLDER};
use crate::{
    system::CREATE_NO_WINDOW,
    win32::job::{self, Job},
};

const LOG_NAME: &str = "cc-connect.log";
const POLL: Duration = Duration::from_millis(250);
const RECHECK: Duration = Duration::from_secs(15);
const STABLE: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, PartialEq)]
pub(super) enum RunState {
    Off,
    Starting,
    Running,
    External,
    NoConfig,
    Failed(UserError),
}

impl RunState {
    pub(super) fn key(&self) -> &'static str {
        match self {
            Self::Off => "off",
            Self::Starting => "starting",
            Self::Running => "running",
            Self::External => "external",
            Self::NoConfig => "noConfig",
            Self::Failed(_) => "failed",
        }
    }

    pub(super) fn error(&self) -> Option<UserError> {
        match self {
            Self::Failed(error) => Some(error.clone()),
            _ => None,
        }
    }
}

fn backoff(failures: u32) -> Duration {
    Duration::from_secs((5u64 << failures.saturating_sub(1).min(5)).min(120))
}

struct Runner {
    setting: Option<String>,
    status: Arc<Mutex<RunState>>,
    restart: mpsc::Sender<()>,
}

fn runner() -> MutexGuard<'static, Option<Runner>> {
    static RUNNER: OnceLock<Mutex<Option<Runner>>> = OnceLock::new();
    RUNNER.get_or_init(Mutex::default).lock().unwrap_or_else(PoisonError::into_inner)
}

fn set(status: &Mutex<RunState>, next: RunState) {
    *status.lock().unwrap_or_else(PoisonError::into_inner) = next;
}

pub(crate) fn apply(settings: &Map<String, Value>, app_dir: Option<&Path>, config: PathBuf) -> Result<(), UserError> {
    if !settings.get("run").and_then(Value::as_bool).unwrap_or(false) {
        stop();
        return Ok(());
    }
    let app_dir = app_dir.ok_or("cc-connect is not ready yet.")?.to_path_buf();
    let setting = settings.get("path").and_then(Value::as_str).map(str::trim).filter(|path| !path.is_empty()).map(str::to_string);
    let mut current = runner();
    if current.as_ref().is_some_and(|runner| runner.setting == setting) {
        return Ok(());
    }
    *current = None;
    let status = Arc::new(Mutex::new(RunState::Starting));
    let (restart, restarts) = mpsc::channel();
    {
        let (setting, status) = (setting.clone(), Arc::clone(&status));
        thread::Builder::new()
            .name("cc-connect".into())
            .spawn(move || supervise(setting.as_deref(), &app_dir, &config, &status, &restarts))
            .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?;
    }
    *current = Some(Runner { setting, status, restart });
    Ok(())
}

pub(crate) fn stop() {
    *runner() = None;
}

pub(super) fn restart() {
    if let Some(runner) = runner().as_ref() {
        let _ = runner.restart.send(());
    }
}

pub(super) fn state() -> RunState {
    runner().as_ref().map_or(RunState::Off, |runner| runner.status.lock().unwrap_or_else(PoisonError::into_inner).clone())
}

enum Ended {
    Waiting(RunState),
    Exited { stable: bool, reason: UserError },
    Restart,
    Stopped,
}

fn supervise(setting: Option<&str>, app_dir: &Path, config: &Path, status: &Mutex<RunState>, restarts: &mpsc::Receiver<()>) {
    let mut failures = 0u32;
    loop {
        set(status, RunState::Starting);
        let wait = match run_once(setting, app_dir, config, status, restarts) {
            Ended::Stopped => return,
            Ended::Restart => continue,
            Ended::Waiting(state) => {
                set(status, state);
                RECHECK
            }
            Ended::Exited { stable, reason } => {
                failures = if stable { 1 } else { failures.saturating_add(1) };
                set(status, RunState::Failed(reason));
                backoff(failures)
            }
        };
        if let Err(mpsc::RecvTimeoutError::Disconnected) = restarts.recv_timeout(wait) {
            return;
        }
    }
}

fn run_once(setting: Option<&str>, app_dir: &Path, config: &Path, status: &Mutex<RunState>, restarts: &mpsc::Receiver<()>) -> Ended {
    if !config.is_file() {
        return Ended::Waiting(RunState::NoConfig);
    }
    if crate::win32::process::running_executable(&[EXE_NAME]).is_some() {
        return Ended::Waiting(RunState::External);
    }
    let exe = match locate::find(setting, Some(app_dir)) {
        Ok(Some((exe, _))) => exe,
        Ok(None) => return Ended::Waiting(RunState::Failed(UserError::new("ccConnect.notFoundRun", "cc-connect was not found; download it or fill in its path first."))),
        Err(error) => return Ended::Waiting(RunState::Failed(error)),
    };
    let log = app_dir.join(FOLDER).join(LOG_NAME);
    let (mut child, _job) = match start(&exe, config, &log) {
        Ok(started) => started,
        Err(error) => return Ended::Waiting(RunState::Failed(error)),
    };
    set(status, RunState::Running);
    let started = Instant::now();
    loop {
        match restarts.recv_timeout(POLL) {
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            other => {
                let _ = child.kill();
                let _ = child.wait();
                return if other.is_ok() { Ended::Restart } else { Ended::Stopped };
            }
        }
        match child.try_wait() {
            Ok(None) => {}
            Ok(Some(exit)) => {
                let reason = UserError::new("ccConnect.exited", format!("cc-connect stopped ({exit}).")).detail(last_line(&log).unwrap_or_default());
                return Ended::Exited { stable: started.elapsed() >= STABLE, reason };
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Ended::Exited { stable: false, reason: UserError::new("ccConnect.lost", "Lost track of cc-connect.").detail(error) };
            }
        }
    }
}

fn start(exe: &Path, config: &Path, log: &Path) -> Result<(Child, Job), UserError> {
    if let Some(dir) = log.parent() {
        fs::create_dir_all(dir).map_err(|error| UserError::new("file.create", format!("Could not create {}.", dir.display())).arg("path", dir.display().to_string()).detail(error))?;
    }
    let out = File::create(log).map_err(|error| UserError::new("file.write", format!("Could not write {}.", log.display())).arg("path", log.display().to_string()).detail(error))?;
    let err = out.try_clone().map_err(|error| UserError::new("file.write", format!("Could not write {}.", log.display())).arg("path", log.display().to_string()).detail(error))?;
    let mut command = Command::new(exe);
    command
        .arg("--config")
        .arg(config)
        .stdin(Stdio::null())
        .stdout(out)
        .stderr(err)
        .creation_flags(CREATE_NO_WINDOW | job::START_SUSPENDED);
    if let Some(dir) = config.parent() {
        command.current_dir(dir);
    }
    let mut child = command.spawn().map_err(|error| UserError::new("ccConnect.run", "Could not run cc-connect.").detail(error))?;
    match Job::new().and_then(|job| job.assign(&child).map(|()| job)).and_then(|job| job::resume(child.id()).map(|()| job)) {
        Ok(job) => Ok((child, job)),
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            Err(UserError::new("ccConnect.run", "Could not run cc-connect.").detail(error))
        }
    }
}

fn last_line(log: &Path) -> Option<String> {
    let mut file = File::open(log).ok()?;
    let length = file.metadata().ok()?.len();
    file.seek(SeekFrom::Start(length.saturating_sub(8192))).ok()?;
    let mut tail = Vec::new();
    file.read_to_end(&mut tail).ok()?;
    let text = String::from_utf8_lossy(&tail);
    text.lines().map(str::trim).rfind(|line| !line.is_empty()).map(|line| line.chars().take(300).collect())
}

#[cfg(test)]
mod tests {
    use super::{backoff, last_line};
    use std::{fs, time::Duration};

    #[test]
    fn the_backoff_doubles_up_to_two_minutes() {
        let waits: Vec<u64> = (1..=8).map(|failures| backoff(failures).as_secs()).collect();
        assert_eq!(waits, [5, 10, 20, 40, 80, 120, 120, 120]);
        assert_eq!(backoff(0), Duration::from_secs(5));
    }

    #[test]
    fn the_reason_is_the_log_s_last_line() {
        let log = std::env::temp_dir().join(format!("focusd-cc-connect-log-{}.log", std::process::id()));
        fs::write(&log, "starting\nlevel=ERROR msg=\"telegram: Unauthorized\"\n\n").unwrap();
        assert_eq!(last_line(&log).as_deref(), Some("level=ERROR msg=\"telegram: Unauthorized\""));
        fs::write(&log, "").unwrap();
        assert_eq!(last_line(&log), None);
        let _ = fs::remove_file(&log);
    }
}
