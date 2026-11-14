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
use crate::win32::named_mutex::{self, Held};
pub use state::Priority;

const PRIORITY_FILE: &str = "dev-priority.json";
const CHANGED_EVENT: &str = "dev-priority-changed";
const DEV_FIRST_MUTEX: &str = "com.tixxin.fuyu.dev-first";
const RELEASE_YIELDED_MUTEX: &str = "com.tixxin.fuyu.release-yielded";
const POLL_INTERVAL: Duration = Duration::from_millis(100);
const RELEASE_POLL_INTERVAL: Duration = Duration::from_millis(500);
const LET_GO_PAUSE: Duration = Duration::from_millis(200);
const RETRY_AFTER: [Duration; 2] = [Duration::from_secs(1), Duration::from_secs(2)];

static APP: OnceLock<AppHandle> = OnceLock::new();
static PRIORITY: Mutex<Priority> = Mutex::new(Priority::ReleaseFirst);
static RELEASE_RUNNING: AtomicBool = AtomicBool::new(false);
static RELEASE_YIELDS: AtomicBool = AtomicBool::new(false);
static YIELDING: AtomicBool = AtomicBool::new(false);
static HELD: Mutex<Option<Held>> = Mutex::new(None);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DevPriorityState {
    priority: Priority,
    yielding: bool,
    release_running: bool,
    release_yields: bool,
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
    DevPriorityState {
        priority: priority(),
        yielding: yielding(),
        release_running: RELEASE_RUNNING.load(Ordering::SeqCst),
        release_yields: RELEASE_YIELDS.load(Ordering::SeqCst),
    }
}

fn hold(name: &str, wanted: bool) {
    let mut held = HELD.lock().unwrap_or_else(PoisonError::into_inner);
    if !wanted {
        held.take();
    } else if held.is_none() {
        *held = named_mutex::hold(name);
    }
}

fn evaluate() -> (bool, bool) {
    let priority = priority();
    hold(DEV_FIRST_MUTEX, priority == Priority::DevFirst);
    let release_running = named_mutex::exists(&release_mutex());
    let release_yields = release_running && named_mutex::exists(RELEASE_YIELDED_MUTEX);
    let yields = state::yields(true, priority, release_running);
    let seen = RELEASE_RUNNING.swap(release_running, Ordering::SeqCst) != release_running;
    let handed = RELEASE_YIELDS.swap(release_yields, Ordering::SeqCst) != release_yields;
    let flipped = YIELDING.swap(yields, Ordering::SeqCst) != yields;
    crate::agent_approval::serve_for_release(state::takes_over(priority, release_yields));
    (flipped || handed, seen || flipped || handed)
}

fn refresh_owners() {
    crate::clipboard_history::coexist_refresh();
    crate::translation::coexist_refresh();
    crate::screenshot::coexist_refresh();
    crate::agent_status::approval_hotkeys::coexist_refresh();
    crate::plugin_host::coexist_refresh();
}

fn refresh_again_later() {
    let _ = thread::Builder::new().name("coexist-retry".into()).spawn(|| {
        for pause in RETRY_AFTER {
            thread::sleep(pause);
            if !yielding() {
                refresh_owners();
            }
        }
    });
}

fn settle() {
    let (refresh, changed) = evaluate();
    if refresh {
        refresh_owners();
    }
    if changed {
        if let Some(app) = APP.get() {
            let _ = app.emit(CHANGED_EVENT, current());
        }
    }
}

fn development_data_exists() -> bool {
    let prefix = format!("{}.lane-", crate::rename_migration::NEW_IDENTIFIER);
    crate::home_dir::app_data_dir(crate::rename_migration::NEW_IDENTIFIER)
        .and_then(|dir| dir.parent().map(PathBuf::from))
        .and_then(|roaming| std::fs::read_dir(roaming).ok())
        .is_some_and(|entries| entries.flatten().any(|entry| entry.file_name().to_string_lossy().starts_with(&prefix)))
}

fn follow_development_build() {
    let asked = named_mutex::exists(DEV_FIRST_MUTEX);
    if YIELDING.swap(asked, Ordering::SeqCst) == asked {
        return;
    }
    if asked {
        refresh_owners();
        crate::agent_approval::pause();
        thread::sleep(LET_GO_PAUSE);
        hold(RELEASE_YIELDED_MUTEX, true);
    } else {
        hold(RELEASE_YIELDED_MUTEX, false);
        crate::agent_approval::resume();
        refresh_owners();
        refresh_again_later();
    }
}

fn init_release() {
    if !development_data_exists() {
        return;
    }
    if named_mutex::exists(DEV_FIRST_MUTEX) {
        YIELDING.store(true, Ordering::SeqCst);
        hold(RELEASE_YIELDED_MUTEX, true);
    }
    refresh_again_later();
    let _ = thread::Builder::new().name("coexist".into()).spawn(|| loop {
        thread::sleep(RELEASE_POLL_INTERVAL);
        follow_development_build();
    });
}

pub(crate) fn init(app: &AppHandle) {
    if crate::dev_lane::lane().is_none() {
        init_release();
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
