use serde::{Deserialize, Serialize};
use std::{
    fs::OpenOptions,
    io::Write,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex, OnceLock, PoisonError,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Listener, Manager};

pub(super) const FIRST_FRAME_EVENT: &str = "clipboard-popup-first-frame";
const ENV: &str = "FUYU_CLIPBOARD_TRACE";
const FILE_NAME: &str = "clipboard-open-trace.log";
const MAX_BYTES: u64 = 256 * 1024;
const ARRIVAL_MAX_AGE: Duration = Duration::from_secs(2);
const FRAME_MAX_AGE: Duration = Duration::from_secs(10);

static ENABLED: OnceLock<bool> = OnceLock::new();
static LISTENING: OnceLock<()> = OnceLock::new();
static ARRIVED: Mutex<Option<Instant>> = Mutex::new(None);
static SHOWN: Mutex<Option<(u64, Instant)>> = Mutex::new(None);
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Serialize)]
pub(super) struct OpenedPayload {
    trace: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FirstFrame {
    since_opened_ms: f64,
}

fn enabled() -> bool {
    *ENABLED.get_or_init(|| std::env::var(ENV).is_ok_and(|value| value.trim() == "1"))
}

pub(super) fn message_arrived() {
    if enabled() {
        *ARRIVED.lock().unwrap_or_else(PoisonError::into_inner) = Some(Instant::now());
    }
}

struct Active {
    id: u64,
    origin: Instant,
    last: Instant,
    outcome: &'static str,
    marks: Vec<(&'static str, f64)>,
}

pub(super) struct Trace(Option<Active>);

impl Trace {
    pub(super) fn begin(app: &AppHandle) -> Self {
        if !enabled() {
            return Self(None);
        }
        listen_for_first_frame(app);
        let now = Instant::now();
        let origin = ARRIVED
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .take()
            .filter(|arrived| now.duration_since(*arrived) < ARRIVAL_MAX_AGE)
            .unwrap_or(now);
        let mut active = Active { id: NEXT_ID.fetch_add(1, Ordering::Relaxed), origin, last: origin, outcome: "open", marks: Vec::new() };
        active.marks.push(("message", millis(now.duration_since(origin))));
        active.last = now;
        Self(Some(active))
    }

    pub(super) fn mark(&mut self, label: &'static str) {
        if let Some(active) = self.0.as_mut() {
            let now = Instant::now();
            active.marks.push((label, millis(now.duration_since(active.last))));
            active.last = now;
        }
    }

    pub(super) fn hiding(&mut self) {
        if let Some(active) = self.0.as_mut() {
            active.outcome = "hide";
        }
    }

    pub(super) fn shown(&self) {
        if let Some(active) = self.0.as_ref() {
            *SHOWN.lock().unwrap_or_else(PoisonError::into_inner) = Some((active.id, Instant::now()));
        }
    }

    pub(super) fn opened_payload(&self) -> OpenedPayload {
        OpenedPayload { trace: self.0.is_some() }
    }

    pub(super) fn finish(self, app: &AppHandle) {
        if let Some(active) = self.0 {
            let total = millis(active.last.duration_since(active.origin));
            append(app, &format_open(active.id, active.outcome, &active.marks, total));
        }
    }
}

fn listen_for_first_frame(app: &AppHandle) {
    if LISTENING.set(()).is_err() {
        return;
    }
    let handle = app.clone();
    app.listen_any(FIRST_FRAME_EVENT, move |event| {
        let Ok(frame) = serde_json::from_str::<FirstFrame>(event.payload()) else {
            return;
        };
        let shown = SHOWN.lock().unwrap_or_else(PoisonError::into_inner).take();
        let Some((id, at)) = shown.filter(|(_, at)| at.elapsed() < FRAME_MAX_AGE) else {
            return;
        };
        append(&handle, &format_frame(id, frame.since_opened_ms, millis(at.elapsed())));
    });
}

fn millis(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1000.0
}

fn format_open(id: u64, outcome: &str, marks: &[(&str, f64)], total: f64) -> String {
    let parts: Vec<String> = marks.iter().map(|(label, ms)| format!("{label}={ms:.1}")).collect();
    format!("open#{id} {outcome} {} total={total:.1}", parts.join(" "))
}

fn format_frame(id: u64, page: f64, since_show: f64) -> String {
    format!("open#{id} first-frame page={page:.1} since-show={since_show:.1}")
}

fn append(app: &AppHandle, line: &str) {
    let Ok(dir) = crate::home_dir::fuyu_home(app.path()) else {
        return;
    };
    let path = dir.join(FILE_NAME);
    let full = std::fs::metadata(&path).is_ok_and(|meta| meta.len() > MAX_BYTES);
    let stamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let opened = if full { OpenOptions::new().create(true).write(true).truncate(true).open(&path) } else { OpenOptions::new().create(true).append(true).open(&path) };
    if let Ok(mut file) = opened {
        let _ = writeln!(file, "{stamp} {line}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_line_lists_each_step_and_total() {
        let marks = [("message", 0.26), ("queued", 12.04), ("show", 7.0)];
        assert_eq!(format_open(3, "open", &marks, 19.29), "open#3 open message=0.3 queued=12.0 show=7.0 total=19.3");
    }

    #[test]
    fn frame_line_has_page_and_since_show() {
        assert_eq!(format_frame(3, 41.26, 55.0), "open#3 first-frame page=41.3 since-show=55.0");
    }

    #[test]
    fn first_frame_payload_is_camel_case() {
        let frame: FirstFrame = serde_json::from_str(r#"{"sinceOpenedMs":12.5}"#).unwrap();
        assert!((frame.since_opened_ms - 12.5).abs() < f64::EPSILON);
    }

    #[test]
    fn opened_payload_says_whether_tracing() {
        assert_eq!(serde_json::to_string(&OpenedPayload { trace: false }).unwrap(), r#"{"trace":false}"#);
    }
}
