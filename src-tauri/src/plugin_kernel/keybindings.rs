use std::{
    collections::{BTreeMap, BTreeSet},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Mutex, MutexGuard, OnceLock, PoisonError,
    },
    thread,
    time::Duration,
};

use plugin_base::host_service;
use serde::{Deserialize, Serialize};
#[cfg(windows)]
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{WM_APP, WM_HOTKEY, WM_QUIT},
};

use crate::clipboard_history::parse_shortcut_binding;
#[cfg(windows)]
use crate::win32::{
    self,
    message_window::{self, WindowMessages},
};

#[cfg(windows)]
const CLASS_NAME: &str = "FuyuPluginV3Hotkeys";
#[cfg(windows)]
const WINDOW_NAME: &str = "Fuyu Plugin V3 Hotkeys";
#[cfg(windows)]
const FIRST_HOTKEY_ID: i32 = 0x5300;
#[cfg(windows)]
const REFRESH_MESSAGE: u32 = WM_APP + 0x62;
const APPLY_WAIT: Duration = Duration::from_secs(2);

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, ts(rename_all = "camelCase"))]
pub(crate) struct PluginHotkeySpec {
    pub plugin_id: String,
    pub command: String,
    pub shortcut: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(transparent)]
pub(crate) struct PluginHotkeyBindings(pub Vec<PluginHotkeySpec>);

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, ts(rename_all = "camelCase"))]
pub(crate) struct PluginHotkeySyncResult {
    pub conflicts: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Binding {
    pub plugin_id: String,
    pub command: String,
    pub label: String,
    pub modifiers: u32,
    pub key_code: u32,
}

#[derive(Default)]
struct State {
    wanted: Vec<Binding>,
    registered: Vec<Binding>,
    conflicts: BTreeMap<String, Vec<String>>,
    #[cfg(windows)]
    window: Option<isize>,
    #[cfg(windows)]
    thread: Option<thread::JoinHandle<()>>,
    #[cfg(windows)]
    reply: Option<mpsc::SyncSender<BTreeMap<String, Vec<String>>>>,
    #[cfg(target_os = "macos")]
    hotkeys: Vec<global_hotkey::hotkey::HotKey>,
}

static STATE: OnceLock<Mutex<State>> = OnceLock::new();
static ACTIVE: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "macos")]
type MainRunner = Box<dyn Fn(Box<dyn FnOnce() + Send>) -> bool + Send + Sync>;
#[cfg(target_os = "macos")]
static MAIN_RUNNER: OnceLock<MainRunner> = OnceLock::new();

fn lock_state() -> MutexGuard<'static, State> {
    STATE.get_or_init(Mutex::default).lock().unwrap_or_else(PoisonError::into_inner)
}

pub(crate) fn init(app: &tauri::AppHandle) {
    ACTIVE.store(true, Ordering::SeqCst);
    #[cfg(target_os = "macos")]
    {
        let handle = app.clone();
        let _ = MAIN_RUNNER.set(Box::new(move |job| handle.run_on_main_thread(job).is_ok()));
    }
    #[cfg(not(target_os = "macos"))]
    let _ = app;
}

pub(super) fn push_conflict(conflicts: &mut BTreeMap<String, Vec<String>>, plugin_id: &str, label: String) {
    let entries = conflicts.entry(plugin_id.to_owned()).or_default();
    if !entries.contains(&label) {
        entries.push(label);
    }
}

pub(super) fn merge_conflicts(target: &mut BTreeMap<String, Vec<String>>, extra: BTreeMap<String, Vec<String>>) {
    for (plugin_id, items) in extra {
        for item in items {
            push_conflict(target, &plugin_id, item);
        }
    }
}

pub(super) fn prepare(bindings: &[PluginHotkeySpec]) -> (Vec<Binding>, BTreeMap<String, Vec<String>>) {
    let mut wanted = Vec::new();
    let mut conflicts = BTreeMap::new();
    let mut seen = BTreeSet::new();
    for spec in bindings {
        let plugin_id = spec.plugin_id.trim();
        let command = spec.command.trim();
        let shortcut = spec.shortcut.trim();
        if plugin_id.is_empty() || command.is_empty() || shortcut.is_empty() {
            continue;
        }
        let Some(parsed) = parse_shortcut_binding(shortcut) else {
            push_conflict(&mut conflicts, plugin_id, shortcut.to_owned());
            continue;
        };
        if !seen.insert((parsed.modifiers, parsed.key_code)) {
            push_conflict(&mut conflicts, plugin_id, parsed.label);
            continue;
        }
        wanted.push(Binding {
            plugin_id: plugin_id.to_owned(),
            command: command.to_owned(),
            label: parsed.label,
            modifiers: parsed.modifiers,
            key_code: parsed.key_code,
        });
    }
    (wanted, conflicts)
}

pub(super) fn apply_registered(
    wanted: Vec<Binding>,
    mut register: impl FnMut(&Binding, usize) -> bool,
) -> (Vec<Binding>, BTreeMap<String, Vec<String>>) {
    let mut registered = Vec::with_capacity(wanted.len());
    let mut conflicts = BTreeMap::new();
    for binding in wanted {
        let index = registered.len();
        if register(&binding, index) {
            registered.push(binding);
        } else {
            push_conflict(&mut conflicts, &binding.plugin_id, binding.label);
        }
    }
    (registered, conflicts)
}

#[cfg(any(windows, target_os = "macos"))]
fn fire(plugin_id: String, command: String) {
    let _ = thread::Builder::new().name("plugin-v3-hotkey".into()).spawn(move || {
        super::notify_hotkey(&plugin_id, &command);
    });
}

#[host_service("pluginKernel.syncHotkeys")]
pub(crate) fn sync_hotkeys(bindings: PluginHotkeyBindings) -> PluginHotkeySyncResult {
    let (wanted, mut conflicts) = prepare(&bindings.0);
    if !ACTIVE.load(Ordering::SeqCst) {
        let mut state = lock_state();
        state.wanted.clone_from(&wanted);
        let (registered, extra) = apply_registered(wanted, |_, _| true);
        merge_conflicts(&mut conflicts, extra);
        state.registered = registered;
        state.conflicts.clone_from(&conflicts);
        return PluginHotkeySyncResult { conflicts };
    }
    let os_conflicts = apply_platform(wanted);
    merge_conflicts(&mut conflicts, os_conflicts);
    lock_state().conflicts.clone_from(&conflicts);
    PluginHotkeySyncResult { conflicts }
}

pub(crate) fn clear() {
    if !ACTIVE.load(Ordering::SeqCst) {
        let mut state = lock_state();
        state.wanted.clear();
        state.registered.clear();
        state.conflicts.clear();
        return;
    }
    clear_platform();
}

#[cfg(test)]
pub(super) fn snapshot_counts() -> (usize, usize, BTreeMap<String, Vec<String>>) {
    let state = lock_state();
    (state.wanted.len(), state.registered.len(), state.conflicts.clone())
}

#[cfg(target_os = "macos")]
fn apply_platform(wanted: Vec<Binding>) -> BTreeMap<String, Vec<String>> {
    {
        let mut state = lock_state();
        state.wanted = wanted;
    }
    let Some(runner) = MAIN_RUNNER.get() else {
        let mut state = lock_state();
        state.registered = state.wanted.clone();
        return BTreeMap::new();
    };
    let (tx, rx) = mpsc::sync_channel(1);
    if !runner(Box::new(move || {
        let _ = tx.send(apply_macos());
    })) {
        return BTreeMap::new();
    }
    rx.recv_timeout(APPLY_WAIT).unwrap_or_default()
}

#[cfg(target_os = "macos")]
fn clear_platform() {
    {
        let mut state = lock_state();
        state.wanted.clear();
        state.conflicts.clear();
    }
    if let Some(runner) = MAIN_RUNNER.get() {
        let (tx, rx) = mpsc::sync_channel(1);
        if runner(Box::new(move || {
            let _ = apply_macos();
            let _ = tx.send(());
        })) {
            let _ = rx.recv_timeout(APPLY_WAIT);
        }
    } else {
        lock_state().registered.clear();
    }
}

#[cfg(target_os = "macos")]
fn apply_macos() -> BTreeMap<String, Vec<String>> {
    use crate::{
        clipboard_history::{to_hotkey, ShortcutBinding},
        macos::hotkeys,
    };
    let (old, wanted) = {
        let mut state = lock_state();
        state.registered.clear();
        (std::mem::take(&mut state.hotkeys), state.wanted.clone())
    };
    for hotkey in old {
        hotkeys::unregister(hotkey);
    }
    let mut next_hotkeys = Vec::new();
    let (next_registered, os_conflicts) = apply_registered(wanted, |binding, _| {
        let shortcut = ShortcutBinding {
            label: binding.label.clone(),
            modifiers: binding.modifiers,
            key_code: binding.key_code,
        };
        let plugin_id = binding.plugin_id.clone();
        let command = binding.command.clone();
        let registered = to_hotkey(&shortcut).filter(|hotkey| {
            hotkeys::register(*hotkey, move || fire(plugin_id.clone(), command.clone())).is_ok()
        });
        if let Some(hotkey) = registered {
            next_hotkeys.push(hotkey);
            true
        } else {
            false
        }
    });
    let mut state = lock_state();
    state.hotkeys = next_hotkeys;
    state.registered = next_registered;
    os_conflicts
}

#[cfg(windows)]
fn apply_platform(wanted: Vec<Binding>) -> BTreeMap<String, Vec<String>> {
    let (tx, rx) = mpsc::sync_channel(1);
    let need_start = {
        let mut state = lock_state();
        state.wanted = wanted;
        if state.wanted.is_empty() && state.thread.as_ref().is_none_or(|handle| handle.is_finished()) {
            state.registered.clear();
            return BTreeMap::new();
        }
        state.reply = Some(tx);
        if let Some(window) = state.window {
            let _ = message_window::post_message(HWND(window as *mut _), REFRESH_MESSAGE);
            false
        } else {
            state.thread.as_ref().is_none_or(|handle| handle.is_finished())
        }
    };
    if need_start {
        let mut state = lock_state();
        if let Some(finished) = state.thread.take() {
            let _ = finished.join();
        }
        match thread::Builder::new().name("plugin-v3-hotkeys".into()).spawn(run_window) {
            Ok(handle) => state.thread = Some(handle),
            Err(error) => {
                eprintln!("[plugins-v3] could not start hotkey window: {error}");
                state.reply = None;
                return BTreeMap::new();
            }
        }
    }
    rx.recv_timeout(APPLY_WAIT).unwrap_or_default()
}

#[cfg(windows)]
fn clear_platform() {
    let handle = {
        let mut state = lock_state();
        state.wanted.clear();
        state.conflicts.clear();
        state.thread.take()
    };
    let Some(handle) = handle else {
        lock_state().registered.clear();
        return;
    };
    let started = std::time::Instant::now();
    while !handle.is_finished() {
        let window = lock_state().window;
        if let Some(window) = window {
            let _ = message_window::post_message(HWND(window as *mut _), WM_QUIT);
            break;
        }
        if started.elapsed() >= APPLY_WAIT {
            return;
        }
        thread::sleep(Duration::from_millis(10));
    }
    let _ = handle.join();
}

#[cfg(windows)]
fn run_window() {
    let Ok(instance) = message_window::module_instance() else {
        if let Some(reply) = lock_state().reply.take() {
            let _ = reply.send(BTreeMap::new());
        }
        return;
    };
    let _ = message_window::register_class::<PluginV3HotkeyWindow>(instance, CLASS_NAME);
    let Ok(window) = message_window::create_message_only_window(instance, CLASS_NAME, WINDOW_NAME) else {
        let _ = message_window::unregister_class(instance, CLASS_NAME);
        if let Some(reply) = lock_state().reply.take() {
            let _ = reply.send(BTreeMap::new());
        }
        return;
    };
    lock_state().window = Some(window.0 as isize);
    apply_windows(window);
    message_window::run_message_loop();
    {
        let mut state = lock_state();
        state.window = None;
        for index in 0..state.registered.len() {
            let _ = win32::hotkey::unregister(window, FIRST_HOTKEY_ID + index as i32);
        }
        state.registered.clear();
        if let Some(reply) = state.reply.take() {
            let _ = reply.send(BTreeMap::new());
        }
    }
    let _ = message_window::destroy_window(window);
    let _ = message_window::unregister_class(instance, CLASS_NAME);
}

#[cfg(windows)]
fn apply_windows(window: HWND) {
    let mut state = lock_state();
    for index in 0..state.registered.len() {
        let _ = win32::hotkey::unregister(window, FIRST_HOTKEY_ID + index as i32);
    }
    state.registered.clear();
    let wanted = if crate::coexist::yielding() { Vec::new() } else { state.wanted.clone() };
    let (registered, os_conflicts) = apply_registered(wanted, |binding, index| {
        let id = FIRST_HOTKEY_ID + index as i32;
        win32::hotkey::register(window, id, binding.modifiers, binding.key_code).is_ok()
    });
    state.registered = registered;
    if let Some(reply) = state.reply.take() {
        let _ = reply.send(os_conflicts);
    }
}

#[cfg(windows)]
fn pressed(id: usize) {
    let binding = id
        .checked_sub(FIRST_HOTKEY_ID as usize)
        .and_then(|index| lock_state().registered.get(index).cloned());
    if let Some(binding) = binding {
        fire(binding.plugin_id, binding.command);
    }
}

#[cfg(windows)]
struct PluginV3HotkeyWindow;

#[cfg(windows)]
impl WindowMessages for PluginV3HotkeyWindow {
    fn handle(window: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> Option<LRESULT> {
        if message == WM_HOTKEY && crate::shortcut_capture::capture_hotkey_message(lparam.0) {
            return Some(LRESULT(0));
        }
        match message {
            WM_HOTKEY => pressed(wparam.0),
            REFRESH_MESSAGE => apply_windows(window),
            _ => return None,
        }
        Some(LRESULT(0))
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
fn apply_platform(wanted: Vec<Binding>) -> BTreeMap<String, Vec<String>> {
    let mut state = lock_state();
    state.wanted.clone_from(&wanted);
    state.registered = wanted;
    BTreeMap::new()
}

#[cfg(not(any(windows, target_os = "macos")))]
fn clear_platform() {
    let mut state = lock_state();
    state.wanted.clear();
    state.registered.clear();
    state.conflicts.clear();
}

#[cfg(test)]
#[path = "keybindings_tests.rs"]
mod tests;
