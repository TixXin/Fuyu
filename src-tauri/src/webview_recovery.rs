use std::{
    collections::{HashMap, VecDeque},
    fs::{self, OpenOptions},
    io::Write,
    path::Path,
    sync::{Mutex, MutexGuard, OnceLock},
    time::{Duration, Instant},
};

use tauri::{Manager, Runtime, Webview, WindowEvent};

use crate::win32::webview_crash::{self, Failure, FailureKind};

pub(crate) const FILE_NAME: &str = "webview-crashes.log";
const MAX_BYTES: u64 = 64 * 1024;
const LIMIT_WINDOW: Duration = Duration::from_secs(60);
const MAX_RELOADS: usize = 3;

#[derive(Default)]
struct State {
    watched: HashMap<String, usize>,
    crashes: HashMap<String, VecDeque<Instant>>,
}

fn state() -> MutexGuard<'static, State> {
    static STATE: OnceLock<Mutex<State>> = OnceLock::new();
    STATE.get_or_init(Mutex::default).lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub(crate) fn attach<R: Runtime>(webview: &Webview<R>) {
    let label = webview.label().to_string();
    let window = webview.window();
    let app = webview.app_handle().clone();
    let result = webview.with_webview(move |platform| {
        let watched = match webview_crash::webview_of(&platform.controller()) {
            Ok(watched) => watched,
            Err(error) => return eprintln!("crash recovery for {label}: {error}"),
        };
        if !mark_watched(&mut state().watched, &label, watched.identity()) {
            return;
        }
        let forget = label.clone();
        window.on_window_event(move |event| {
            if let WindowEvent::Destroyed = event {
                state().watched.remove(&forget);
            }
        });
        let crashed = label.clone();
        let watching = webview_crash::watch(watched, move |failure| {
            let reload = record_crash(&mut state().crashes, &crashed, Instant::now());
            if let Ok(home) = crate::home_dir::fuyu_home(app.path()) {
                append_capped(&home.join(FILE_NAME), &log_line(&now_text(), &crashed, failure, reload));
            }
            reload
        });
        if let Err(error) = watching {
            state().watched.remove(&label);
            eprintln!("crash recovery for {label}: {error}");
        }
    });
    if let Err(error) = result {
        eprintln!("crash recovery: {error}");
    }
}

fn mark_watched(watched: &mut HashMap<String, usize>, label: &str, identity: usize) -> bool {
    watched.insert(label.to_string(), identity) != Some(identity)
}

fn record_crash(crashes: &mut HashMap<String, VecDeque<Instant>>, label: &str, now: Instant) -> bool {
    let recent = crashes.entry(label.to_string()).or_default();
    recent.retain(|at| now.saturating_duration_since(*at) < LIMIT_WINDOW);
    recent.push_back(now);
    recent.len() <= MAX_RELOADS
}

fn now_text() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S%:z").to_string()
}

fn kind_name(kind: FailureKind) -> &'static str {
    match kind {
        FailureKind::RendererExited => "render-process-exited",
        FailureKind::RendererUnresponsive => "render-process-unresponsive",
    }
}

fn log_line(time: &str, label: &str, failure: Failure, reloaded: bool) -> String {
    let exit = failure.exit_code.map_or_else(|| "-".to_string(), |code| format!("{code:#010x}"));
    let action = if reloaded { "reloaded" } else { "gave-up" };
    format!("{time} {label} {} exit={exit} {action}\n", kind_name(failure.kind))
}

fn append_capped(path: &Path, line: &str) {
    if fs::metadata(path).is_ok_and(|metadata| metadata.len() > MAX_BYTES) {
        if let Ok(text) = fs::read_to_string(path) {
            let half = text.len() / 2;
            let cut = text.get(half..).and_then(|tail| tail.find('\n')).map_or(text.len(), |at| half + at + 1);
            let _ = fs::write(path, text.get(cut..).unwrap_or_default());
        }
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = file.write_all(line.as_bytes());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reloads_three_times_a_minute_then_gives_up() {
        let mut crashes = HashMap::new();
        let start = Instant::now();
        let at = |seconds| start + Duration::from_secs(seconds);
        assert!(record_crash(&mut crashes, "main", at(0)));
        assert!(record_crash(&mut crashes, "main", at(10)));
        assert!(record_crash(&mut crashes, "main", at(20)));
        assert!(!record_crash(&mut crashes, "main", at(30)));
        assert!(record_crash(&mut crashes, "settings", at(30)));
        assert!(record_crash(&mut crashes, "main", at(85)));
    }

    #[test]
    fn watches_each_webview_once_and_again_after_it_is_replaced() {
        let mut watched = HashMap::new();
        assert!(mark_watched(&mut watched, "settings", 1));
        assert!(!mark_watched(&mut watched, "settings", 1));
        assert!(mark_watched(&mut watched, "settings", 2));
        assert!(mark_watched(&mut watched, "pin-1", 2));
    }

    #[test]
    fn log_line_has_time_label_kind_and_exit_code() {
        let exited = Failure { kind: FailureKind::RendererExited, exit_code: Some(0x8000_0003_u32 as i32) };
        assert_eq!(
            log_line("2026-11-15 05:48:42+08:00", "main", exited, true),
            "2026-11-15 05:48:42+08:00 main render-process-exited exit=0x80000003 reloaded\n"
        );
        let hung = Failure { kind: FailureKind::RendererUnresponsive, exit_code: None };
        assert_eq!(log_line("t", "pin-2", hung, false), "t pin-2 render-process-unresponsive exit=- gave-up\n");
    }

    #[test]
    fn log_drops_the_older_half_when_it_grows_too_big() {
        let dir = std::env::temp_dir().join(format!("fuyu-webview-crashes-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join(FILE_NAME);
        let line = format!("{}\n", "x".repeat(99));
        fs::write(&path, line.repeat(700)).unwrap();
        append_capped(&path, "last\n");
        let text = fs::read_to_string(&path).unwrap();
        assert!(text.len() < 40 * 1024);
        assert!(text.ends_with(&format!("{line}last\n")));
        assert!(text.lines().all(|row| row == "last" || row.len() == 99));
        fs::remove_dir_all(&dir).unwrap();
    }
}
