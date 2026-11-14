mod state;

use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, OnceLock, PoisonError,
    },
    thread,
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::user_error::UserError;
pub use state::Priority;

const PRIORITY_FILE: &str = "dev-priority.json";
const CHANGED_EVENT: &str = "dev-priority-changed";
const POLL_INTERVAL: Duration = Duration::from_millis(100);

static APP: OnceLock<AppHandle> = OnceLock::new();
static PRIORITY: Mutex<Priority> = Mutex::new(Priority::ReleaseFirst);
static RELEASE_RUNNING: AtomicBool = AtomicBool::new(false);
static YIELDING: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DevPriorityState {
    priority: Priority,
    yielding: bool,
    release_running: bool,
}

pub(crate) fn yielding() -> bool {
    YIELDING.load(Ordering::SeqCst)
}

pub(crate) fn banner_visible(visible: bool) -> bool {
    visible && !yielding()
}

fn release_mutex() -> String {
    format!("{}-sim", crate::rename_migration::NEW_IDENTIFIER)
}

fn priority() -> Priority {
    *PRIORITY.lock().unwrap_or_else(PoisonError::into_inner)
}

fn priority_path() -> Option<PathBuf> {
    crate::home_dir::current().map(|home| home.join(PRIORITY_FILE))
}

fn current() -> DevPriorityState {
    DevPriorityState { priority: priority(), yielding: yielding(), release_running: RELEASE_RUNNING.load(Ordering::SeqCst) }
}

fn evaluate() -> (bool, bool) {
    let release_running = crate::win32::named_mutex::exists(&release_mutex());
    let yields = state::yields(crate::dev_lane::lane().is_some(), priority(), release_running);
    let seen = RELEASE_RUNNING.swap(release_running, Ordering::SeqCst) != release_running;
    let flipped = YIELDING.swap(yields, Ordering::SeqCst) != yields;
    (flipped, seen || flipped)
}

fn refresh_owners() {
    crate::clipboard_history::coexist_refresh();
    crate::translation::coexist_refresh();
    crate::screenshot::coexist_refresh();
    crate::agent_status::approval_hotkeys::coexist_refresh();
    crate::plugin_host::coexist_refresh();
}

fn settle() {
    let (flipped, changed) = evaluate();
    if flipped {
        refresh_owners();
    }
    if changed {
        if let Some(app) = APP.get() {
            let _ = app.emit(CHANGED_EVENT, current());
        }
    }
}

pub(crate) fn init(app: &AppHandle) {
    if crate::dev_lane::lane().is_none() {
        return;
    }
    let saved = priority_path().and_then(|path| std::fs::read_to_string(path).ok());
    *PRIORITY.lock().unwrap_or_else(PoisonError::into_inner) = state::saved_priority(saved.as_deref());
    let _ = APP.set(app.clone());
    evaluate();
    let _ = thread::Builder::new().name("coexist".into()).spawn(|| loop {
        thread::sleep(POLL_INTERVAL);
        settle();
    });
}

#[tauri::command]
pub fn get_dev_priority() -> DevPriorityState {
    current()
}

#[tauri::command]
pub fn set_dev_priority(priority: Priority) -> Result<DevPriorityState, UserError> {
    if crate::dev_lane::lane().is_none() {
        return Err(UserError::new("coexist.devOnly", "Only a development build has this switch."));
    }
    if let Some(path) = priority_path() {
        std::fs::write(&path, state::priority_file(priority))
            .map_err(|error| UserError::new("coexist.save", "Could not save the choice.").detail(error))?;
    }
    *PRIORITY.lock().unwrap_or_else(PoisonError::into_inner) = priority;
    if evaluate().0 {
        refresh_owners();
    }
    let now = current();
    if let Some(app) = APP.get() {
        let _ = app.emit(CHANGED_EVENT, now);
    }
    Ok(now)
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::coexist::get_dev_priority,
            crate::coexist::set_dev_priority,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
