use std::{
    collections::HashMap,
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock, PoisonError,
    },
    time::{Duration, Instant},
};

use objc2_app_kit::NSRunningApplication;
use objc2_foundation::NSString;

use super::{
    accessibility::{self, Element},
    apps,
};
use crate::plugin_kernel::{
    builtins::Background,
    worker::{Stop, Worker},
};

const DOCK: &str = "com.apple.dock";
const POLL: Duration = Duration::from_secs(3);
const TICK: Duration = Duration::from_secs(1);
const WAIT_SLICE: Duration = Duration::from_millis(200);
const PRIVACY_PAGE: &str =
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Badge {
    NotAllowed,
    NotInDock,
    Label(Option<String>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DockEntry {
    pub(crate) path: String,
    pub(crate) label: Option<String>,
}

pub(crate) type BadgeCallback = Arc<dyn Fn(Badge) + Send + Sync>;
pub(crate) type ActivateCallback = Arc<dyn Fn() + Send + Sync>;

pub(crate) struct DockSource {
    pub(crate) source: &'static str,
    pub(crate) bundle_ids: &'static [&'static str],
    pub(crate) on_badge: BadgeCallback,
    pub(crate) on_activate: ActivateCallback,
}

struct RegisteredSource {
    source: &'static str,
    bundle_ids: &'static [&'static str],
    enabled: bool,
    last_badge: Option<Badge>,
    was_front: bool,
    on_badge: BadgeCallback,
    on_activate: ActivateCallback,
}

#[derive(Default)]
struct DockPollState {
    sources: Vec<RegisteredSource>,
}

impl DockPollState {
    fn subscribe(&mut self, spec: DockSource) {
        if let Some(existing) = self
            .sources
            .iter_mut()
            .find(|entry| entry.source == spec.source)
        {
            existing.bundle_ids = spec.bundle_ids;
            existing.on_badge = spec.on_badge;
            existing.on_activate = spec.on_activate;
            return;
        }
        self.sources.push(RegisteredSource {
            source: spec.source,
            bundle_ids: spec.bundle_ids,
            enabled: false,
            last_badge: None,
            was_front: false,
            on_badge: spec.on_badge,
            on_activate: spec.on_activate,
        });
    }

    fn set_enabled(&mut self, source: &'static str, enabled: bool) -> (bool, bool) {
        let mut newly_enabled = false;
        if let Some(entry) = self.sources.iter_mut().find(|entry| entry.source == source) {
            if entry.enabled != enabled {
                entry.enabled = enabled;
                entry.last_badge = None;
                entry.was_front = false;
                newly_enabled = enabled;
            }
        }
        (self.any_enabled(), newly_enabled)
    }

    fn is_enabled(&self, source: &'static str) -> bool {
        self.sources
            .iter()
            .any(|entry| entry.source == source && entry.enabled)
    }

    fn any_enabled(&self) -> bool {
        self.sources.iter().any(|entry| entry.enabled)
    }

    fn enabled_sources(&self) -> Vec<(&'static str, &'static [&'static str])> {
        self.sources
            .iter()
            .filter(|entry| entry.enabled)
            .map(|entry| (entry.source, entry.bundle_ids))
            .collect()
    }

    fn apply_badges(
        &mut self,
        trusted: bool,
        dock: Option<&[DockEntry]>,
        paths_by_source: &HashMap<&'static str, Vec<String>>,
    ) -> Vec<(BadgeCallback, Badge)> {
        let mut updates = Vec::new();
        for entry in &mut self.sources {
            if !entry.enabled {
                continue;
            }
            let reading = if !trusted {
                Badge::NotAllowed
            } else if let Some(items) = dock {
                let candidates = paths_by_source
                    .get(entry.source)
                    .map(Vec::as_slice)
                    .unwrap_or(&[]);
                match_candidate_paths(items, candidates)
            } else {
                Badge::NotInDock
            };
            if entry.last_badge.as_ref() != Some(&reading) {
                entry.last_badge = Some(reading.clone());
                updates.push((entry.on_badge.clone(), reading));
            }
        }
        updates
    }

    fn apply_frontmost(
        &mut self,
        frontmost: Option<&str>,
        paths_by_source: &HashMap<&'static str, Vec<String>>,
    ) -> Vec<ActivateCallback> {
        let mut callbacks = Vec::new();
        for entry in &mut self.sources {
            if !entry.enabled {
                entry.was_front = false;
                continue;
            }
            let candidates = paths_by_source
                .get(entry.source)
                .map(Vec::as_slice)
                .unwrap_or(&[]);
            let front = matches_frontmost(frontmost, candidates);
            let activated = front && !entry.was_front;
            entry.was_front = front;
            if activated {
                callbacks.push(entry.on_activate.clone());
            }
        }
        callbacks
    }
}

fn same_path(a: &str, b: &str) -> bool {
    a.trim_end_matches('/') == b.trim_end_matches('/')
}

fn match_candidate_paths(dock: &[DockEntry], candidate_paths: &[String]) -> Badge {
    for candidate in candidate_paths {
        if let Some(label) = dock
            .iter()
            .filter(|entry| same_path(&entry.path, candidate))
            .find_map(|entry| entry.label.as_ref())
        {
            return Badge::Label(Some(label.clone()));
        }
    }
    for candidate in candidate_paths {
        if dock.iter().any(|entry| same_path(&entry.path, candidate)) {
            return Badge::Label(None);
        }
    }
    Badge::NotInDock
}

fn matches_frontmost(frontmost: Option<&str>, candidate_paths: &[String]) -> bool {
    frontmost.is_some_and(|front| {
        candidate_paths
            .iter()
            .any(|candidate| same_path(front, candidate))
    })
}

fn resolve_source_paths(
    sources: &[(&'static str, &'static [&'static str])],
) -> HashMap<&'static str, Vec<String>> {
    let mut resolved = HashMap::with_capacity(sources.len());
    for &(source, bundle_ids) in sources {
        let paths = bundle_ids
            .iter()
            .filter_map(|bundle_id| apps::path_for_bundle_id(bundle_id))
            .collect();
        resolved.insert(source, paths);
    }
    resolved
}

fn read_dock_entries() -> Option<Vec<DockEntry>> {
    let running =
        NSRunningApplication::runningApplicationsWithBundleIdentifier(&NSString::from_str(DOCK));
    let dock = running
        .iter()
        .next()
        .and_then(|app| Element::application(app.processIdentifier()))?;
    let mut entries = Vec::new();
    for list in dock.children() {
        for item in list.children() {
            if let Some(path) = item.url_path("AXURL") {
                let label = item
                    .text("AXStatusLabel")
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty());
                entries.push(DockEntry { path, label });
            }
        }
    }
    Some(entries)
}

struct DockWatcher {
    state: Mutex<DockPollState>,
    dirty: AtomicBool,
    worker: Worker,
}

impl DockWatcher {
    fn new(run: impl Fn(Stop) + Send + Sync + 'static) -> Self {
        Self {
            state: Mutex::new(DockPollState::default()),
            dirty: AtomicBool::new(false),
            worker: Worker::new("dock-badges", run),
        }
    }

    fn subscribe(&self, spec: DockSource) {
        self.state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .subscribe(spec);
    }

    fn set_enabled(&self, source: &'static str, enabled: bool) {
        let (any_enabled, newly_enabled) = self
            .state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .set_enabled(source, enabled);
        if any_enabled {
            if newly_enabled {
                self.dirty.store(true, Ordering::Release);
            }
            if let Err(error) = self.worker.start() {
                eprintln!("failed to start dock-badges worker: {error}");
            }
        } else {
            self.worker.stop();
        }
    }

    fn is_source_running(&self, source: &'static str) -> bool {
        let enabled = self
            .state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .is_enabled(source);
        enabled && self.worker.running()
    }
}

static WATCHER: OnceLock<DockWatcher> = OnceLock::new();

fn watcher() -> &'static DockWatcher {
    WATCHER.get_or_init(|| DockWatcher::new(run_loop))
}

fn run_loop(stop: Stop) {
    let mut last_poll: Option<Instant> = None;
    let mut last_tick: Option<Instant> = None;
    loop {
        let forced = watcher().dirty.swap(false, Ordering::AcqRel);
        let due_poll = forced || last_poll.is_none_or(|at| at.elapsed() >= POLL);
        let due_tick = due_poll || last_tick.is_none_or(|at| at.elapsed() >= TICK);
        if due_tick {
            step_watcher(watcher(), due_poll);
            let now = Instant::now();
            if due_poll {
                last_poll = Some(now);
            }
            last_tick = Some(now);
        }
        if stop.wait(WAIT_SLICE) {
            return;
        }
    }
}

fn step_watcher(watcher: &DockWatcher, poll_dock: bool) {
    let sources = watcher
        .state
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .enabled_sources();
    if sources.is_empty() {
        return;
    }
    let paths_by_source = resolve_source_paths(&sources);
    if poll_dock {
        let trusted = accessibility::is_trusted();
        let dock = trusted.then(read_dock_entries).flatten();
        let updates = watcher
            .state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .apply_badges(trusted, dock.as_deref(), &paths_by_source);
        for (callback, badge) in updates {
            callback(badge);
        }
    }
    let frontmost = apps::frontmost_path();
    let activations = watcher
        .state
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .apply_frontmost(frontmost.as_deref(), &paths_by_source);
    for callback in activations {
        callback();
    }
}

pub(crate) fn subscribe(spec: DockSource) {
    watcher().subscribe(spec);
}

pub(crate) fn set_enabled(source: &'static str, enabled: bool) {
    watcher().set_enabled(source, enabled);
}

pub(crate) fn is_source_running(source: &'static str) -> bool {
    watcher().is_source_running(source)
}

pub(crate) fn open_app(bundle_id: &str) -> Result<(), String> {
    let status = Command::new("/usr/bin/open")
        .arg("-b")
        .arg(bundle_id)
        .status()
        .map_err(|error| error.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("Could not open {bundle_id}."))
    }
}

#[allow(dead_code)]
pub(crate) fn open_candidates(bundle_ids: &[&str]) -> Result<(), String> {
    let chosen = bundle_ids
        .iter()
        .copied()
        .find(|bundle_id| apps::path_for_bundle_id(bundle_id).is_some())
        .or_else(|| bundle_ids.first().copied())
        .ok_or_else(|| "No application bundle identifier configured.".to_string())?;
    open_app(chosen)
}

pub(crate) fn open_accessibility_settings() -> Result<(), String> {
    tauri_plugin_opener::open_url(PRIVACY_PAGE, None::<&str>).map_err(|error| error.to_string())
}

pub(crate) fn unread(label: &str) -> u32 {
    let digits: String = label.chars().filter(char::is_ascii_digit).collect();
    digits.parse().unwrap_or(1).max(1)
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::AtomicUsize;

    use super::*;

    fn entry(path: &str, label: Option<&str>) -> DockEntry {
        DockEntry {
            path: path.into(),
            label: label.map(Into::into),
        }
    }

    #[test]
    fn badge_labels_become_unread_counts() {
        assert_eq!(unread("7"), 7);
        assert_eq!(unread("99+"), 99);
        assert_eq!(unread("•"), 1);
        assert!(same_path("/Applications/WeChat.app/", "/Applications/WeChat.app"));
    }

    #[test]
    fn candidate_paths_prefer_badged_dock_item_then_present_icon() {
        let candidates = vec![
            "/Applications/Telegram.app".to_string(),
            "/Applications/Telegram Desktop.app".to_string(),
        ];
        let dock = vec![
            entry("/Applications/Telegram.app/", None),
            entry("/Applications/Telegram Desktop.app", Some("4")),
        ];
        assert_eq!(
            match_candidate_paths(&dock, &candidates),
            Badge::Label(Some("4".into()))
        );
        let cleared = vec![entry("/Applications/Telegram Desktop.app/", None)];
        assert_eq!(
            match_candidate_paths(&cleared, &candidates),
            Badge::Label(None)
        );
        assert_eq!(match_candidate_paths(&[], &candidates), Badge::NotInDock);
    }

    #[test]
    fn poll_state_batches_badges_and_frontmost_transitions_per_source() {
        let mut state = DockPollState::default();
        let qq_badges = Arc::new(Mutex::new(Vec::new()));
        let tg_badges = Arc::new(Mutex::new(Vec::new()));
        let tg_activates = Arc::new(AtomicUsize::new(0));

        let qq_sink = qq_badges.clone();
        state.subscribe(DockSource {
            source: "qq",
            bundle_ids: &["com.tencent.qq"],
            on_badge: Arc::new(move |b| qq_sink.lock().unwrap().push(b)),
            on_activate: Arc::new(|| {}),
        });
        let tg_sink = tg_badges.clone();
        let tg_act = tg_activates.clone();
        state.subscribe(DockSource {
            source: "telegram",
            bundle_ids: &["ru.keepcoder.Telegram", "com.tdesktop.Telegram"],
            on_badge: Arc::new(move |b| tg_sink.lock().unwrap().push(b)),
            on_activate: Arc::new(move || {
                tg_act.fetch_add(1, Ordering::SeqCst);
            }),
        });

        state.set_enabled("qq", true);
        state.set_enabled("telegram", true);
        let paths = HashMap::from([
            ("qq", vec!["/Applications/QQ.app".to_string()]),
            (
                "telegram",
                vec![
                    "/Applications/Telegram.app".to_string(),
                    "/Applications/Telegram Desktop.app".to_string(),
                ],
            ),
        ]);
        let dock = vec![
            entry("/Applications/QQ.app", Some("2")),
            entry("/Applications/Telegram Desktop.app", Some("5")),
        ];
        for (cb, b) in state.apply_badges(true, Some(&dock), &paths) {
            cb(b);
        }
        assert!(state.apply_badges(true, Some(&dock), &paths).is_empty());
        assert_eq!(qq_badges.lock().unwrap().len(), 1);
        assert_eq!(
            tg_badges.lock().unwrap().as_slice(),
            &[Badge::Label(Some("5".into()))]
        );

        for cb in state.apply_frontmost(Some("/Applications/Telegram Desktop.app/"), &paths) {
            cb();
        }
        assert!(state
            .apply_frontmost(Some("/Applications/Telegram Desktop.app"), &paths)
            .is_empty());
        assert_eq!(tg_activates.load(Ordering::SeqCst), 1);

        for (cb, b) in state.apply_badges(false, None, &paths) {
            cb(b);
        }
        assert_eq!(qq_badges.lock().unwrap().last(), Some(&Badge::NotAllowed));
    }

    #[test]
    fn shared_watcher_starts_with_first_source_and_stops_when_all_turn_off() {
        let watcher = DockWatcher::new(|stop| while !stop.wait(Duration::from_secs(10)) {});
        watcher.subscribe(DockSource {
            source: "qq",
            bundle_ids: &["com.tencent.qq"],
            on_badge: Arc::new(|_| {}),
            on_activate: Arc::new(|| {}),
        });
        watcher.subscribe(DockSource {
            source: "wechat",
            bundle_ids: &["com.tencent.xinWeChat"],
            on_badge: Arc::new(|_| {}),
            on_activate: Arc::new(|| {}),
        });
        assert!(!watcher.worker.running());
        watcher.set_enabled("qq", true);
        assert!(watcher.is_source_running("qq"));
        assert!(!watcher.is_source_running("wechat"));
        watcher.set_enabled("wechat", true);
        watcher.set_enabled("qq", false);
        assert!(!watcher.is_source_running("qq"));
        assert!(watcher.is_source_running("wechat"));
        watcher.set_enabled("wechat", false);
        assert!(!watcher.worker.running());
    }
}
