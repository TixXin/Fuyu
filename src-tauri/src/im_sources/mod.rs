#[cfg(target_os = "macos")]
mod macos;
mod specs;
mod state;
#[cfg(windows)]
mod windows;

#[cfg(test)]
mod tests;

use std::{
    sync::{Arc, Mutex, OnceLock, PoisonError},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use specs::{find_index, SOURCES};
pub use state::ImSourceSnapshot;
use state::{SourceState, StateChange};

pub const EVENT_NAME: &str = "im-sources-changed";
const INSTALLED_CACHE_TTL: Duration = Duration::from_secs(60);

static SERVICE: OnceLock<Arc<ImSourcesService>> = OnceLock::new();

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImSourcesChangedEvent {
    pub source: &'static str,
    pub snapshot: ImSourceSnapshot,
    pub newest_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub replaced_id: Option<String>,
    pub window_visible: bool,
}

struct SourceSlot {
    state: Mutex<SourceState>,
    #[cfg(windows)]
    shell_sub: Mutex<Option<crate::wechat_reminders::ShellSubscription>>,
}

struct InstalledCache {
    refreshed_at: Option<Instant>,
    values: [bool; SOURCES.len()],
}

impl Default for InstalledCache {
    fn default() -> Self {
        Self {
            refreshed_at: None,
            values: [false; SOURCES.len()],
        }
    }
}

struct ImSourcesService {
    app: AppHandle,
    slots: [SourceSlot; SOURCES.len()],
    installed_cache: Mutex<InstalledCache>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

impl ImSourcesService {
    fn new(app: AppHandle) -> Self {
        Self {
            app,
            slots: std::array::from_fn(|index| SourceSlot {
                state: Mutex::new(SourceState::new(&SOURCES[index])),
                #[cfg(windows)]
                shell_sub: Mutex::new(None),
            }),
            installed_cache: Mutex::new(InstalledCache::default()),
        }
    }

    fn is_enabled(&self, index: usize) -> bool {
        self.slots[index]
            .state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .snapshot
            .enabled
    }

    fn on_set_enabled(&self, index: usize, enabled: bool) {
        let outcome = {
            let mut state = self.slots[index]
                .state
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            let change = state.set_enabled(enabled);
            change.changed.then(|| (state.snapshot.clone(), change))
        };
        if let Some((snapshot, change)) = outcome {
            self.publish(snapshot, change);
        }
    }

    fn on_foreground(&self, index: usize, at_ms: i64) {
        let outcome = {
            let mut state = self.slots[index]
                .state
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            let change = state.apply_foreground(at_ms);
            change.changed.then(|| (state.snapshot.clone(), change))
        };
        if let Some((snapshot, change)) = outcome {
            self.publish(snapshot, change);
        }
    }

    #[cfg(windows)]
    fn on_toast_poll(&self, index: usize, poll: crate::toast_notifications::ToastPoll) {
        let outcome = {
            let mut state = self.slots[index]
                .state
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            let change = state.apply_toast_poll(poll, now_ms());
            change.changed.then(|| (state.snapshot.clone(), change))
        };
        if let Some((snapshot, change)) = outcome {
            self.publish(snapshot, change);
        }
    }

    #[cfg(windows)]
    fn on_flash(&self, index: usize) {
        let outcome = {
            let mut state = self.slots[index]
                .state
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            let change = state.apply_flash(now_ms());
            change.changed.then(|| (state.snapshot.clone(), change))
        };
        if let Some((snapshot, change)) = outcome {
            self.publish(snapshot, change);
        }
    }

    #[cfg(target_os = "macos")]
    fn on_badge(&self, index: usize, reading: state::BadgeReading, at_ms: i64) {
        let outcome = {
            let mut state = self.slots[index]
                .state
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            let change = state.apply_badge(reading, at_ms);
            change.changed.then(|| (state.snapshot.clone(), change))
        };
        if let Some((snapshot, change)) = outcome {
            self.publish(snapshot, change);
        }
    }

    fn apply_installed(&self, values: [bool; SOURCES.len()]) {
        {
            let mut cache = self
                .installed_cache
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            cache.values = values;
            cache.refreshed_at = Some(Instant::now());
        }
        for (index, installed) in values.into_iter().enumerate() {
            let mut state = self.slots[index]
                .state
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            state.set_installed(installed);
        }
    }

    fn installed_needs_refresh(&self) -> bool {
        self.installed_cache
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .refreshed_at
            .is_none_or(|at| at.elapsed() >= INSTALLED_CACHE_TTL)
    }

    fn publish(&self, snapshot: ImSourceSnapshot, change: StateChange) {
        let visible = crate::coexist::banner_visible(
            self.app
                .get_webview_window(crate::island::WINDOW_LABEL)
                .is_some_and(|window| window.is_visible().unwrap_or(false)),
        );
        let allow_banner = crate::coexist::banner_visible(true);
        let newest_id = change.newest_id.filter(|_| allow_banner);
        let replaced_id = change.replaced_id.filter(|_| allow_banner);
        let event = ImSourcesChangedEvent {
            source: snapshot.source,
            snapshot,
            newest_id,
            replaced_id,
            window_visible: visible,
        };
        let _ = self.app.emit_to(
            crate::settings_window::WINDOW_LABEL,
            EVENT_NAME,
            event.clone(),
        );
        let _ = self
            .app
            .emit_to(crate::island::WINDOW_LABEL, EVENT_NAME, event);
    }
}

fn detect_installed_platform() -> [bool; SOURCES.len()] {
    #[cfg(windows)]
    {
        windows::detect_installed_all()
    }
    #[cfg(target_os = "macos")]
    {
        macos::detect_installed_all()
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        [false; SOURCES.len()]
    }
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    if SERVICE.get().is_some() {
        return Ok(());
    }
    let service = Arc::new(ImSourcesService::new(app.clone()));
    if SERVICE.set(Arc::clone(&service)).is_err() {
        return Ok(());
    }
    #[cfg(windows)]
    windows::register_sources(&service);
    #[cfg(target_os = "macos")]
    macos::register_sources(&service);

    let warming = Arc::clone(&service);
    let _ = std::thread::Builder::new()
        .name("im-sources-installed".into())
        .spawn(move || {
            warming.apply_installed(detect_installed_platform());
        });
    Ok(())
}

fn ready(app: &AppHandle) -> Result<&'static Arc<ImSourcesService>, String> {
    init(app)?;
    SERVICE
        .get()
        .ok_or_else(|| "IM sources service is not ready yet.".to_string())
}

fn resolve_index(source: &str) -> Result<usize, String> {
    find_index(source).ok_or_else(|| format!("Unknown IM source: {}", source.trim()))
}

async fn ensure_installed_fresh(service: &Arc<ImSourcesService>) {
    if !service.installed_needs_refresh() {
        return;
    }
    if let Ok(values) = tauri::async_runtime::spawn_blocking(detect_installed_platform).await {
        service.apply_installed(values);
    }
}

#[tauri::command]
pub async fn get_im_sources_state(
    app: AppHandle,
    source: Option<String>,
) -> Result<Vec<ImSourceSnapshot>, String> {
    let service = ready(&app)?;
    ensure_installed_fresh(service).await;
    if let Some(target) = source {
        let index = resolve_index(&target)?;
        let snapshot = service.slots[index]
            .state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .snapshot
            .clone();
        return Ok(vec![snapshot]);
    }
    Ok(service
        .slots
        .iter()
        .map(|slot| {
            slot.state
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .snapshot
                .clone()
        })
        .collect())
}

#[tauri::command]
pub fn set_im_source_auto_clear(
    app: AppHandle,
    source: String,
    enabled: bool,
) -> Result<ImSourceSnapshot, String> {
    let service = ready(&app)?;
    let index = resolve_index(&source)?;
    let mut state = service.slots[index]
        .state
        .lock()
        .unwrap_or_else(PoisonError::into_inner);
    state.auto_clear = enabled;
    Ok(state.snapshot.clone())
}

#[tauri::command]
pub fn clear_im_source_notifications(
    app: AppHandle,
    source: String,
) -> Result<ImSourceSnapshot, String> {
    let service = ready(&app)?;
    let index = resolve_index(&source)?;
    let (snapshot, changed) = {
        let mut state = service.slots[index]
            .state
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        let changed = state.clear();
        (state.snapshot.clone(), changed)
    };
    if changed {
        service.publish(
            snapshot.clone(),
            StateChange {
                changed: true,
                newest_id: None,
                replaced_id: None,
            },
        );
    }
    Ok(snapshot)
}

#[tauri::command]
pub async fn open_im_source(app: AppHandle, source: String) -> Result<(), String> {
    let service = ready(&app)?;
    let index = resolve_index(&source)?;
    let spec = &SOURCES[index];
    let asked_at = now_ms();
    #[cfg(windows)]
    let last_packaged_aumid = service.slots[index]
        .state
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .last_packaged_aumid
        .clone();

    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            windows::open_source(spec, last_packaged_aumid)
        }
        #[cfg(target_os = "macos")]
        {
            macos::open_source(spec)
        }
        #[cfg(not(any(windows, target_os = "macos")))]
        {
            let _ = spec;
            Err("IM source activation is not supported on this platform.".to_string())
        }
    })
    .await
    .map_err(|error| format!("打开 {} 的线程失败：{error}", spec.display_name))??;

    service.on_foreground(index, asked_at);
    Ok(())
}

#[tauri::command]
pub async fn request_im_notification_access(app: AppHandle) -> Result<String, String> {
    #[cfg(windows)]
    {
        windows::request_notification_access(app).await
    }
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        macos::request_notification_access()
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = app;
        Ok("unspecified".to_string())
    }
}

#[tauri::command]
pub fn open_im_notification_settings(app: AppHandle, access: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        let _ = app;
        windows::open_notification_settings(access)
    }
    #[cfg(target_os = "macos")]
    {
        let _ = (app, access);
        macos::open_notification_settings()
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = (app, access);
        Ok(())
    }
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::im_sources::get_im_sources_state,
            crate::im_sources::set_im_source_auto_clear,
            crate::im_sources::clear_im_source_notifications,
            crate::im_sources::open_im_source,
            crate::im_sources::request_im_notification_access,
            crate::im_sources::open_im_notification_settings,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
