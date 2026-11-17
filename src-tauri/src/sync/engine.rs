use std::{
    path::{Path, PathBuf},
    sync::{
        mpsc::{self, Receiver, RecvTimeoutError, Sender},
        Mutex, MutexGuard, OnceLock, PoisonError,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};

use super::{
    backend_folder::FolderBackend,
    base,
    categories::{links::Links, settings, snippets::Snippets, todos::Todos, Category},
    clock,
    config::{self, SyncCategory, SyncConfig},
    device,
    layout::DeviceInfo,
    round::{Clockwork, Options, Round},
    status::{SyncPhase, SyncStatus},
    Hlc,
};

const STATUS_EVENT: &str = "sync-status-changed";
const PUSH_DELAY: Duration = Duration::from_secs(5);
const PULL_EVERY: Duration = Duration::from_secs(5 * 60);
const STARTUP_PAUSE: Duration = Duration::from_secs(2);
const STARTUP_WAIT: Duration = Duration::from_secs(60);

enum Wake {
    Changed,
    Now,
}

struct Engine {
    app: AppHandle,
    home: PathBuf,
    data_home: PathBuf,
    wake: Mutex<Sender<Wake>>,
    status: Mutex<SyncStatus>,
    options: Mutex<Options>,
    run: Mutex<()>,
}

static ENGINE: OnceLock<Engine> = OnceLock::new();

fn guard<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

struct GlobalClock;

impl Clockwork for GlobalClock {
    fn tick(&mut self) -> Hlc {
        clock::with(|clock, wall| clock.tick(wall))
    }

    fn observe(&mut self, seen: &Hlc) {
        clock::observe(std::iter::once(seen));
    }

    fn now_ms(&self) -> u64 {
        clock::wall_ms()
    }
}

pub(crate) fn start(app: &AppHandle, home: PathBuf, data_home: PathBuf) {
    if ENGINE.get().is_some() {
        return;
    }
    let (sender, receiver) = mpsc::channel();
    let config = config::load(&home);
    let status = SyncStatus::new(&config, device::id().ok());
    let engine = Engine { app: app.clone(), home, data_home, wake: Mutex::new(sender), status: Mutex::new(status), options: Mutex::new(Options::default()), run: Mutex::new(()) };
    if ENGINE.set(engine).is_err() {
        return;
    }
    let spawned = thread::Builder::new().name("fuyu-sync".into()).spawn(move || {
        thread::sleep(STARTUP_PAUSE);
        crate::todos::wait_until_decided(STARTUP_WAIT);
        work(&receiver);
    });
    if let Err(error) = spawned {
        eprintln!("could not start the sync thread: {error}");
    }
}

fn work(receiver: &Receiver<Wake>) {
    let Some(engine) = ENGINE.get() else { return };
    let mut push_at: Option<Instant> = None;
    let mut pull_at = Instant::now();
    loop {
        let due = push_at.map_or(pull_at, |push_at| push_at.min(pull_at));
        match receiver.recv_timeout(due.saturating_duration_since(Instant::now())) {
            Ok(Wake::Changed) => {
                push_at = Some(Instant::now() + PUSH_DELAY);
                continue;
            }
            Ok(Wake::Now) => {}
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => return,
        }
        engine.round();
        push_at = None;
        pull_at = Instant::now() + PULL_EVERY;
    }
}

fn device_name() -> String {
    #[cfg(target_os = "macos")]
    if let Ok(output) = std::process::Command::new("scutil").args(["--get", "ComputerName"]).output() {
        let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if output.status.success() && !name.is_empty() {
            return name;
        }
    }
    std::env::var("COMPUTERNAME").or_else(|_| std::env::var("HOSTNAME")).unwrap_or_default()
}

impl Engine {
    fn update(&self, change: impl FnOnce(&mut SyncStatus)) -> SyncStatus {
        let (changed, next) = {
            let mut current = guard(&self.status);
            let mut next = current.clone();
            change(&mut next);
            let changed = *current != next;
            if changed {
                *current = next.clone();
            }
            (changed, next)
        };
        if changed {
            let _ = self.app.emit(STATUS_EVENT, next.clone());
        }
        next
    }

    fn round(&self) {
        let _running = guard(&self.run);
        let config = config::load(&self.home);
        let Some(folder) = config.folder.clone() else {
            self.update(|status| status.configure(&config));
            return;
        };
        let device_id = match device::id() {
            Ok(id) => id,
            Err(error) => {
                self.update(|status| {
                    status.phase = SyncPhase::Error;
                    status.last_error = Some(error);
                });
                return;
            }
        };
        self.update(|status| {
            status.configure(&config);
            status.device_id = Some(device_id.clone());
            status.phase = SyncPhase::Syncing;
        });
        let me = DeviceInfo {
            device_id: device_id.clone(),
            name: device_name(),
            platform: std::env::consts::OS.into(),
            app_version: self.app.package_info().version.to_string(),
            last_sync_at: 0,
        };
        let options = std::mem::take(&mut *guard(&self.options));
        let result = run_round(&self.app, &self.home, &self.data_home, &config, &folder, &me, options);
        let now = clock::wall_ms();
        self.update(|status| status.finish(result, &device_id, now));
    }
}

fn run_round(app: &AppHandle, home: &Path, data_home: &Path, config: &SyncConfig, folder: &str, me: &DeviceInfo, options: Options) -> super::round::RoundResult {
    let backend = FolderBackend::new(PathBuf::from(folder));
    let state_dir = home.join(base::DIR_NAME);
    let device = me.device_id.as_str();
    let mut todos = Todos::new(device);
    let mut snippets = Snippets::new(device);
    let mut links = Links::new(app.clone(), device);
    let groups = &config.optional_groups;
    let mut settings_part = settings::Settings::new(app.clone(), settings::Part::Settings, device, groups);
    let mut presets = settings::Settings::new(app.clone(), settings::Part::Presets, device, groups);
    let all: [&mut dyn Category; 5] = [&mut todos, &mut snippets, &mut links, &mut settings_part, &mut presets];
    let (mut enabled, disabled): (Vec<&mut dyn Category>, Vec<&mut dyn Category>) = all.into_iter().partition(|category| config.enabled(category.kind()));
    let disabled: Vec<SyncCategory> = disabled.iter().map(|category| category.kind()).collect();
    let app_version = app.package_info().version.to_string();
    let mut backup = || crate::system::update_backup::create_before_sync(data_home, &app_version);
    let mut clock = GlobalClock;
    let mut round = Round { backend: &backend, me, state_dir: &state_dir, clock: &mut clock, options, backup: &mut backup };
    round.run(&mut enabled, &disabled)
}

fn engine() -> Result<&'static Engine, String> {
    ENGINE.get().ok_or_else(|| "Sync is not started.".to_string())
}

fn wake(engine: &Engine, wake: Wake) {
    let _ = guard(&engine.wake).send(wake);
}

pub(crate) fn notify_local_change() {
    if let Some(engine) = ENGINE.get() {
        if guard(&engine.status).phase != SyncPhase::Off {
            wake(engine, Wake::Changed);
        }
    }
}

pub(crate) fn status() -> Result<SyncStatus, String> {
    Ok(guard(&engine()?.status).clone())
}

pub(crate) fn configure(folder: Option<String>, categories: Vec<SyncCategory>, optional_groups: Vec<String>) -> Result<SyncStatus, String> {
    let engine = engine()?;
    let next = SyncConfig { folder, categories, optional_groups, ..SyncConfig::default() }.normalized();
    if let Some(folder) = &next.folder {
        let path = Path::new(folder);
        if !path.is_absolute() || !path.is_dir() {
            return Err(format!("{folder} is not a folder that can be used for sync."));
        }
    }
    let running = guard(&engine.run);
    let previous = config::load(&engine.home);
    if previous.folder != next.folder {
        base::forget(&engine.home.join(base::DIR_NAME));
        *guard(&engine.options) = Options::default();
    }
    config::save(&engine.home, &next)?;
    drop(running);
    let status = engine.update(|status| status.configure(&next));
    if next.folder.is_some() {
        wake(engine, Wake::Now);
    }
    Ok(status)
}

pub(crate) fn sync_now() -> Result<(), String> {
    wake(engine()?, Wake::Now);
    Ok(())
}

pub(crate) fn confirm() -> Result<(), String> {
    let engine = engine()?;
    *guard(&engine.options) = Options { allow_deletions: true, allow_reset: true };
    wake(engine, Wake::Now);
    Ok(())
}
