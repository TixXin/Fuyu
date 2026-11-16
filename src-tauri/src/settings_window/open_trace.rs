use std::{
    fs::OpenOptions,
    io::Write,
    sync::{
        atomic::{AtomicU64, Ordering},
        OnceLock,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

const ENV: &str = "FUYU_WINDOW_TRACE";
const FILE_NAME: &str = "window-open-trace.log";
const MAX_BYTES: u64 = 256 * 1024;

static ENABLED: OnceLock<bool> = OnceLock::new();
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

fn enabled() -> bool {
    *ENABLED.get_or_init(|| std::env::var(ENV).is_ok_and(|value| value.trim() == "1"))
}

struct Active {
    window: &'static str,
    id: u64,
    kind: &'static str,
    origin: Instant,
    last: Instant,
    marks: Vec<(&'static str, f64)>,
}

pub(crate) struct WindowTrace(Option<Active>);

impl WindowTrace {
    pub(crate) fn begin(window: &'static str, kind: &'static str) -> Self {
        if !enabled() {
            return Self(None);
        }
        let now = Instant::now();
        Self(Some(Active {
            window,
            id: NEXT_ID.fetch_add(1, Ordering::Relaxed),
            kind,
            origin: now,
            last: now,
            marks: Vec::new(),
        }))
    }

    pub(crate) fn mark(&mut self, step: &'static str) {
        if let Some(active) = self.0.as_mut() {
            let now = Instant::now();
            active.marks.push((step, millis(now.duration_since(active.last))));
            active.last = now;
        }
    }

    pub(crate) fn finish(self, app: &AppHandle, via: Option<&str>) {
        if let Some(active) = self.0 {
            let total = millis(active.last.duration_since(active.origin));
            let line = format_line(active.window, active.id, active.kind, &active.marks, total, via);
            append(app, &line);
        }
    }
}

fn millis(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1000.0
}

fn format_line(window: &str, id: u64, kind: &str, marks: &[(&str, f64)], total: f64, via: Option<&str>) -> String {
    let mut line = format!("{window}#{id} {kind}");
    for (step, ms) in marks {
        line.push_str(&format!(" {step}={ms:.1}"));
    }
    line.push_str(&format!(" total={total:.1}"));
    if let Some(via) = via {
        line.push_str(&format!(" via={via}"));
    }
    line
}

fn append(app: &AppHandle, line: &str) {
    let Ok(dir) = crate::home_dir::fuyu_home(app.path()) else {
        return;
    };
    let path = dir.join(FILE_NAME);
    let full = std::fs::metadata(&path).is_ok_and(|meta| meta.len() > MAX_BYTES);
    let stamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let opened = if full {
        OpenOptions::new().create(true).write(true).truncate(true).open(&path)
    } else {
        OpenOptions::new().create(true).append(true).open(&path)
    };
    if let Ok(mut file) = opened {
        let _ = writeln!(file, "{stamp} {line}");
    }
}

#[cfg(test)]
mod tests {
    use super::format_line;

    #[test]
    fn a_created_window_lists_each_step_and_who_showed_it() {
        let marks = [("built", 412.26), ("ready", 380.04), ("show", 5.2)];
        assert_eq!(
            format_line("settings", 3, "create", &marks, 797.5, Some("frontend")),
            "settings#3 create built=412.3 ready=380.0 show=5.2 total=797.5 via=frontend"
        );
    }

    #[test]
    fn a_reused_window_has_no_via() {
        assert_eq!(format_line("settings", 4, "reuse", &[("show", 2.04)], 2.04, None), "settings#4 reuse show=2.0 total=2.0");
    }
}
