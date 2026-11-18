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

use crate::user_error::UserError;

use super::{
    backend::Backend,
    backend_folder::FolderBackend,
    base,
    categories::{
        clip_favorites::ClipFavorites, links::Links, settings, snippets::Snippets, todos::Todos,
        Category,
    },
    clock,
    config::{self, SyncBackendKind, SyncCategory, SyncConfig, WebdavConfig},
    crypto::{self, DataKey},
    device,
    layout::DeviceInfo,
    round::{Clockwork, Options, Round, RoundResult},
    status::{EncryptionState, SyncPhase, SyncStatus},
    webdav::{self, WebdavBackend},
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

pub(super) struct Engine {
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
    let has_pw = webdav::secret::has_password();
    let has_enc = crypto::keychain::has_data_key();
    let status = SyncStatus::new(&config, device::id().ok(), has_pw, has_enc);
    let engine = Engine {
        app: app.clone(),
        home,
        data_home,
        wake: Mutex::new(sender),
        status: Mutex::new(status),
        options: Mutex::new(Options::default()),
        run: Mutex::new(()),
    };
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
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_default()
}

impl Engine {
    pub(super) fn home_dir(&self) -> &Path {
        &self.home
    }

    pub(super) fn lock_run(&self) -> MutexGuard<'_, ()> {
        guard(&self.run)
    }

    pub(super) fn set_encryption_summary(
        &self,
        state: EncryptionState,
        has_local_key: bool,
        key_id: Option<String>,
    ) -> SyncStatus {
        self.update(|status| {
            status.encryption.state = state;
            status.encryption.has_local_key = has_local_key;
            status.encryption.key_id = key_id;
        })
    }

    pub(super) fn prepare_after_remote_reset(&self) {
        base::forget(&self.home.join(base::DIR_NAME));
        *guard(&self.options) = Options { allow_deletions: false, allow_reset: true };
    }

    pub(super) fn run_round_blocking(&self) -> Result<SyncStatus, UserError> {
        self.round();
        Ok(guard(&self.status).clone())
    }

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

    fn fail_round(&self, config: &SyncConfig, has_pw: bool, has_enc: bool, error: UserError) {
        self.update(|status| {
            status.configure(config, has_pw, has_enc);
            status.phase = SyncPhase::Error;
            status.last_error = Some(error.to_string());
            status.error = Some(error);
        });
    }

    fn round(&self) {
        let _running = guard(&self.run);
        let config = config::load(&self.home);
        let has_pw = webdav::secret::has_password();
        let unlocked_key = crypto::keychain::read_data_key().ok().flatten();
        let has_enc = unlocked_key.is_some();
        let active = config.active_backend();
        if active == SyncBackendKind::Off {
            self.update(|status| status.configure(&config, has_pw, has_enc));
            return;
        }
        let device_id = match device::id() {
            Ok(id) => id,
            Err(error) => {
                self.fail_round(&config, has_pw, has_enc, UserError::from(error));
                return;
            }
        };
        self.update(|status| {
            status.configure(&config, has_pw, has_enc);
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

        let (result, user_error) = match active {
            SyncBackendKind::Off => return,
            SyncBackendKind::Folder => {
                let Some(folder) = config.folder.as_deref() else {
                    self.update(|status| status.configure(&config, has_pw, has_enc));
                    return;
                };
                let backend = FolderBackend::new(PathBuf::from(folder));
                let out = self.run_with_backend(&config, &backend, &me, options, unlocked_key.as_ref());
                (out, None)
            }
            SyncBackendKind::Webdav => {
                let Some(webdav_cfg) = config.webdav.as_ref() else {
                    self.update(|status| status.configure(&config, has_pw, has_enc));
                    return;
                };
                let password = match webdav::secret::read_password() {
                    Ok(Some(password)) => password,
                    Ok(None) => {
                        let error = UserError::new("sync.webdavNeedPassword", "Enter the WebDAV app password.");
                        self.fail_round(&config, false, has_enc, error);
                        return;
                    }
                    Err(error) => {
                        self.fail_round(&config, has_pw, has_enc, error);
                        return;
                    }
                };
                let backend = match WebdavBackend::new(&webdav_cfg.url, &webdav_cfg.username, &password) {
                    Ok(backend) => backend,
                    Err(error) => {
                        self.fail_round(&config, true, has_enc, error);
                        return;
                    }
                };
                let out = self.run_with_backend(&config, &backend, &me, options, unlocked_key.as_ref());
                let taken = backend.take_last_error();
                (out, taken)
            }
        };

        let now = clock::wall_ms();
        self.update(|status| status.finish(result, user_error, &device_id, now));
    }

    fn run_with_backend(
        &self,
        config: &SyncConfig,
        backend: &dyn Backend,
        me: &DeviceInfo,
        options: Options,
        unlocked_key: Option<&DataKey>,
    ) -> RoundResult {
        let state_dir = self.home.join(base::DIR_NAME);
        let device = me.device_id.as_str();
        let mut todos = Todos::new(device);
        let mut snippets = Snippets::new(device);
        let mut links = Links::new(self.app.clone(), device);
        let groups = &config.optional_groups;
        let mut settings_part =
            settings::Settings::new(self.app.clone(), settings::Part::Settings, device, groups);
        let mut presets =
            settings::Settings::new(self.app.clone(), settings::Part::Presets, device, groups);
        let mut clip_favorites = ClipFavorites::new(device);
        let all: [&mut dyn Category; 6] = [
            &mut todos,
            &mut snippets,
            &mut links,
            &mut settings_part,
            &mut presets,
            &mut clip_favorites,
        ];
        let (mut enabled, disabled): (Vec<&mut dyn Category>, Vec<&mut dyn Category>) =
            all.into_iter().partition(|category| config.enabled(category.kind()));
        let disabled: Vec<SyncCategory> = disabled.iter().map(|category| category.kind()).collect();
        let app_version = self.app.package_info().version.to_string();
        let data_home = &self.data_home;
        let mut backup = || crate::system::update_backup::create_before_sync(data_home, &app_version);
        let mut clock = GlobalClock;
        let mut round = Round {
            backend,
            me,
            state_dir: &state_dir,
            clock: &mut clock,
            options,
            unlocked_key,
            backup: &mut backup,
        };
        round.run(&mut enabled, &disabled)
    }
}

pub(super) fn open_backend(config: &SyncConfig) -> Result<Box<dyn Backend>, UserError> {
    match config.active_backend() {
        SyncBackendKind::Off => Err(UserError::new(
            "sync.needBackendFirst",
            "Choose a sync folder or connect WebDAV first.",
        )),
        SyncBackendKind::Folder => {
            let folder = config.folder.as_deref().ok_or_else(|| {
                UserError::new("sync.needBackendFirst", "Choose a sync folder first.")
            })?;
            Ok(Box::new(FolderBackend::new(PathBuf::from(folder))))
        }
        SyncBackendKind::Webdav => {
            let webdav_cfg = config.webdav.as_ref().ok_or_else(|| {
                UserError::new("sync.needBackendFirst", "Configure WebDAV first.")
            })?;
            let password = webdav::secret::read_password()?.ok_or_else(|| {
                UserError::new("sync.webdavNeedPassword", "Enter the WebDAV app password.")
            })?;
            Ok(Box::new(WebdavBackend::new(
                &webdav_cfg.url,
                &webdav_cfg.username,
                &password,
            )?))
        }
    }
}

pub(super) fn instance() -> Result<&'static Engine, UserError> {
    ENGINE
        .get()
        .ok_or_else(|| UserError::new("sync.notStarted", "Sync is not started."))
}

fn engine() -> Result<&'static Engine, UserError> {
    instance()
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

pub(crate) fn status() -> Result<SyncStatus, UserError> {
    Ok(guard(&engine()?.status).clone())
}

fn apply_saved_config(engine: &Engine, previous: &SyncConfig, next: SyncConfig) -> Result<SyncStatus, UserError> {
    let running = guard(&engine.run);
    if previous.target_key() != next.target_key() {
        base::forget(&engine.home.join(base::DIR_NAME));
        *guard(&engine.options) = Options::default();
    }
    config::save(&engine.home, &next).map_err(UserError::from)?;
    drop(running);
    let has_pw = webdav::secret::has_password();
    let has_enc = crypto::keychain::has_data_key();
    let updated = engine.update(|status| status.configure(&next, has_pw, has_enc));
    if next.active_backend() != SyncBackendKind::Off {
        wake(engine, Wake::Now);
    }
    Ok(updated)
}

pub(crate) fn configure(
    folder: Option<String>,
    categories: Vec<SyncCategory>,
    optional_groups: Vec<String>,
) -> Result<SyncStatus, UserError> {
    let engine = engine()?;
    let trimmed_folder = folder
        .map(|folder| folder.trim().to_string())
        .filter(|folder| !folder.is_empty());
    if let Some(folder) = &trimmed_folder {
        let path = Path::new(folder);
        if !path.is_absolute() || !path.is_dir() {
            return Err(UserError::new(
                "sync.badFolder",
                format!("{folder} is not a folder that can be used for sync."),
            )
            .arg("path", folder.clone()));
        }
    }
    let previous = config::load(&engine.home);
    let backend = if trimmed_folder.is_some() {
        SyncBackendKind::Folder
    } else {
        SyncBackendKind::Off
    };
    let next = SyncConfig {
        version: previous.version,
        backend: Some(backend),
        folder: trimmed_folder,
        webdav: previous.webdav.clone(),
        categories,
        optional_groups,
    }
    .normalized();
    apply_saved_config(engine, &previous, next)
}

pub(super) fn resolve_webdav_password_for_saved(
    saved: Option<&WebdavConfig>,
    target_url: &reqwest::Url,
    username: &str,
    provided: Option<&str>,
) -> Result<String, UserError> {
    if let Some(secret) = provided.map(str::trim).filter(|secret| !secret.is_empty()) {
        return Ok(secret.to_string());
    }
    let matches_saved = saved.is_some_and(|existing| {
        webdav::normalize_webdav_url(&existing.url).ok().as_ref() == Some(target_url)
            && existing.username == username
    });
    if matches_saved {
        if let Some(stored) = webdav::secret::read_password()? {
            return Ok(stored);
        }
    }
    Err(UserError::new("sync.webdavNeedPassword", "Enter the WebDAV app password."))
}

pub(crate) fn configure_webdav(
    url: String,
    username: String,
    password: Option<String>,
    categories: Vec<SyncCategory>,
    optional_groups: Vec<String>,
) -> Result<SyncStatus, UserError> {
    let engine = engine()?;
    let parsed_url = webdav::normalize_webdav_url(&url)?;
    let clean_url = webdav::clean_webdav_url(&url)?;
    let trimmed_user = username.trim().to_string();
    if trimmed_user.is_empty() {
        return Err(UserError::new("sync.webdavNeedUsername", "Enter the WebDAV username."));
    }
    let previous = config::load(&engine.home);
    let resolved_password = resolve_webdav_password_for_saved(
        previous.webdav.as_ref(),
        &parsed_url,
        &trimmed_user,
        password.as_deref(),
    )?;
    if password.as_deref().is_some_and(|raw| !raw.trim().is_empty()) {
        webdav::secret::save_password(&resolved_password)?;
    }
    let next = SyncConfig {
        version: previous.version,
        backend: Some(SyncBackendKind::Webdav),
        folder: previous.folder.clone(),
        webdav: Some(WebdavConfig {
            url: clean_url,
            username: trimmed_user,
        }),
        categories,
        optional_groups,
    }
    .normalized();
    apply_saved_config(engine, &previous, next)
}

pub(crate) async fn test_webdav(
    url: String,
    username: String,
    password: Option<String>,
) -> Result<(), UserError> {
    let parsed_url = webdav::normalize_webdav_url(&url)?;
    let trimmed_user = username.trim().to_string();
    if trimmed_user.is_empty() {
        return Err(UserError::new("sync.webdavNeedUsername", "Enter the WebDAV username."));
    }
    let saved_webdav = ENGINE
        .get()
        .map(|engine| config::load(&engine.home).webdav)
        .unwrap_or(None);
    let resolved_password = resolve_webdav_password_for_saved(
        saved_webdav.as_ref(),
        &parsed_url,
        &trimmed_user,
        password.as_deref(),
    )?;
    let backend = WebdavBackend::new(parsed_url.as_str(), &trimmed_user, &resolved_password)?;
    backend.test_connection().await
}

pub(crate) fn stop(forget_webdav: bool) -> Result<SyncStatus, UserError> {
    let engine = engine()?;
    let previous = config::load(&engine.home);
    if forget_webdav {
        webdav::secret::delete_password()?;
    }
    let next = SyncConfig {
        version: previous.version,
        backend: Some(SyncBackendKind::Off),
        folder: if previous.active_backend() == SyncBackendKind::Folder {
            None
        } else {
            previous.folder.clone()
        },
        webdav: if forget_webdav {
            None
        } else {
            previous.webdav.clone()
        },
        categories: previous.categories.clone(),
        optional_groups: previous.optional_groups.clone(),
    }
    .normalized();
    apply_saved_config(engine, &previous, next)
}

pub(crate) fn sync_now() -> Result<(), UserError> {
    wake(engine()?, Wake::Now);
    Ok(())
}

pub(crate) fn confirm() -> Result<(), UserError> {
    let engine = engine()?;
    *guard(&engine.options) = Options { allow_deletions: true, allow_reset: true };
    wake(engine, Wake::Now);
    Ok(())
}
