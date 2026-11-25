use std::{
    collections::{HashMap, HashSet, VecDeque},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, MutexGuard, OnceLock,
    },
    thread,
    time::{Duration, Instant},
};

use tauri::{Manager, Runtime, Webview, WindowEvent};

use crate::{
    home_dir::panic_log::{self, append_capped, now_text},
    webview_gpu::{self, GpuMode},
    win32::webview_crash::{self, Failure, FailureKind},
};

pub(crate) const FILE_NAME: &str = "webview-crashes.log";
const LIMIT_WINDOW: Duration = Duration::from_secs(60);
const MAX_RELOADS: usize = 3;
const GPU_BURST_WINDOW: Duration = Duration::from_millis(1500);
const GPU_FALLBACK_LIMIT: usize = 3;
const RESTART_DELAY: Duration = Duration::from_millis(250);

static GPU_UNSTABLE: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RecoveryAction {
    Reload,
    GiveUp,
    SwitchToWarpAndRestart,
}

#[derive(Default)]
struct GpuTracker {
    incidents: VecDeque<Instant>,
    burst_started: Option<Instant>,
    burst_windows: HashSet<String>,
    restart_scheduled: bool,
    unstable: bool,
}

impl GpuTracker {
    fn record(&mut self, label: &str, now: Instant, already_warp: bool) -> RecoveryAction {
        if self.restart_scheduled {
            self.unstable = true;
            return RecoveryAction::GiveUp;
        }
        let same_burst = self
            .burst_started
            .is_some_and(|at| now.saturating_duration_since(at) < GPU_BURST_WINDOW)
            && !self.burst_windows.contains(label);
        if same_burst {
            self.burst_windows.insert(label.to_string());
        } else {
            self.burst_started = Some(now);
            self.burst_windows.clear();
            self.burst_windows.insert(label.to_string());
            self.incidents.retain(|at| now.saturating_duration_since(*at) < LIMIT_WINDOW);
            self.incidents.push_back(now);
        }
        if self.incidents.len() < GPU_FALLBACK_LIMIT {
            return RecoveryAction::Reload;
        }
        self.unstable = true;
        if already_warp {
            RecoveryAction::GiveUp
        } else {
            self.restart_scheduled = true;
            RecoveryAction::SwitchToWarpAndRestart
        }
    }
}

#[derive(Default)]
struct State {
    watched: HashMap<String, usize>,
    crashes: HashMap<String, VecDeque<Instant>>,
    gpu: GpuTracker,
}

fn state() -> MutexGuard<'static, State> {
    static STATE: OnceLock<Mutex<State>> = OnceLock::new();
    STATE.get_or_init(Mutex::default).lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub(crate) fn gpu_unstable() -> bool {
    GPU_UNSTABLE.load(Ordering::Relaxed)
}

pub(crate) fn attach<R: Runtime>(webview: &Webview<R>) {
    panic_log::install();
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
            let action = {
                let mut guard = state();
                match failure.kind {
                    FailureKind::GpuExited => {
                        let already_warp = webview_gpu::active_mode() == GpuMode::Warp;
                        let action = guard.gpu.record(&crashed, Instant::now(), already_warp);
                        if guard.gpu.unstable {
                            GPU_UNSTABLE.store(true, Ordering::Relaxed);
                        }
                        action
                    }
                    FailureKind::RendererExited | FailureKind::RendererUnresponsive => {
                        if record_crash(&mut guard.crashes, &crashed, Instant::now()) {
                            RecoveryAction::Reload
                        } else {
                            RecoveryAction::GiveUp
                        }
                    }
                }
            };
            if let Ok(home) = crate::home_dir::fuyu_home(app.path()) {
                append_capped(&home.join(FILE_NAME), &log_line(&now_text(), &crashed, failure, action));
                if action == RecoveryAction::SwitchToWarpAndRestart {
                    let reason = failure_reason(failure);
                    if let Ok(true) = webview_gpu::enable_auto_warp(&home, &reason) {
                        let restart_app = app.clone();
                        thread::spawn(move || {
                            thread::sleep(RESTART_DELAY);
                            restart_app.restart();
                        });
                    }
                }
            }
            action == RecoveryAction::Reload
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

fn kind_name(kind: FailureKind) -> &'static str {
    match kind {
        FailureKind::RendererExited => "render-process-exited",
        FailureKind::RendererUnresponsive => "render-process-unresponsive",
        FailureKind::GpuExited => "gpu-process-exited",
    }
}

fn failure_reason(failure: Failure) -> String {
    match failure.exit_code {
        Some(code) => format!("{} ({code:#010x})", kind_name(failure.kind)),
        None => kind_name(failure.kind).to_string(),
    }
}

fn action_name(action: RecoveryAction) -> &'static str {
    match action {
        RecoveryAction::Reload => "reloaded",
        RecoveryAction::GiveUp => "gave-up",
        RecoveryAction::SwitchToWarpAndRestart => "switch-to-warp-restart",
    }
}

fn log_line(time: &str, label: &str, failure: Failure, action: RecoveryAction) -> String {
    let exit = failure.exit_code.map_or_else(|| "-".to_string(), |code| format!("{code:#010x}"));
    format!("{time} {label} {} exit={exit} {}\n", kind_name(failure.kind), action_name(action))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

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
    fn gpu_tracker_deduplicates_multi_window_bursts_and_switches_to_warp_on_third_incident() {
        let mut tracker = GpuTracker::default();
        let start = Instant::now();
        let ms = |millis| start + Duration::from_millis(millis);
        assert_eq!(tracker.record("main", ms(0), false), RecoveryAction::Reload);
        assert_eq!(tracker.record("settings", ms(40), false), RecoveryAction::Reload);
        assert_eq!(tracker.record("clipboard", ms(80), false), RecoveryAction::Reload);
        assert!(!tracker.unstable);

        assert_eq!(tracker.record("settings", ms(900), false), RecoveryAction::Reload);
        assert_eq!(tracker.record("main", ms(920), false), RecoveryAction::Reload);
        assert!(!tracker.unstable);

        assert_eq!(tracker.record("settings", ms(1800), false), RecoveryAction::SwitchToWarpAndRestart);
        assert!(tracker.unstable);
        assert_eq!(tracker.record("main", ms(1820), false), RecoveryAction::GiveUp);
    }

    #[test]
    fn gpu_tracker_never_loops_restart_when_already_running_in_warp() {
        let mut tracker = GpuTracker::default();
        let start = Instant::now();
        let ms = |millis| start + Duration::from_millis(millis);
        assert_eq!(tracker.record("settings", ms(0), true), RecoveryAction::Reload);
        assert_eq!(tracker.record("settings", ms(800), true), RecoveryAction::Reload);
        assert_eq!(tracker.record("settings", ms(1600), true), RecoveryAction::GiveUp);
        assert!(tracker.unstable);
        assert!(!tracker.restart_scheduled);
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
            log_line("2026-11-15 05:48:42+08:00", "main", exited, RecoveryAction::Reload),
            "2026-11-15 05:48:42+08:00 main render-process-exited exit=0x80000003 reloaded\n"
        );
        let hung = Failure { kind: FailureKind::RendererUnresponsive, exit_code: None };
        assert_eq!(log_line("t", "pin-2", hung, RecoveryAction::GiveUp), "t pin-2 render-process-unresponsive exit=- gave-up\n");
        let gpu = Failure { kind: FailureKind::GpuExited, exit_code: Some(1) };
        assert_eq!(
            log_line("2026-11-17 08:12:00+08:00", "clipboard", gpu, RecoveryAction::SwitchToWarpAndRestart),
            "2026-11-17 08:12:00+08:00 clipboard gpu-process-exited exit=0x00000001 switch-to-warp-restart\n"
        );
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
