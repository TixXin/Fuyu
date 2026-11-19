use std::{
    any::Any,
    fs::{self, OpenOptions},
    io::Write,
    panic::{self, AssertUnwindSafe},
    path::{Path, PathBuf},
    sync::Once,
    time::SystemTime,
};

const FILE_NAME: &str = "crash.log";
const MAX_BYTES: u64 = 64 * 1024;
const MAX_SUMMARY_CHARS: usize = 240;
const MAX_THREAD_CHARS: usize = 64;

static INSTALLED: Once = Once::new();

pub(crate) fn install() {
    INSTALLED.call_once(|| {
        let previous = panic::take_hook();
        panic::set_hook(Box::new(move |info| {
            let _ = panic::catch_unwind(AssertUnwindSafe(|| {
                if let Some(home) = super::current() {
                    let location = info.location().map(|loc| (loc.file(), loc.line(), loc.column()));
                    let line = format_panic_line(
                        &now_text(),
                        env!("CARGO_PKG_VERSION"),
                        std::thread::current().name(),
                        location,
                        payload_summary(info.payload()),
                    );
                    append_capped(&home.join(FILE_NAME), &line);
                }
            }));
            previous(info);
        }));
    });
}

pub(crate) fn now_text() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S%:z").to_string()
}

pub(crate) fn append_capped(path: &Path, line: &str) {
    if fs::metadata(path).is_ok_and(|metadata| metadata.len() > MAX_BYTES) {
        if let Ok(bytes) = fs::read(path) {
            let half = bytes.len() / 2;
            let cut = bytes
                .get(half..)
                .and_then(|tail| tail.iter().position(|&byte| byte == b'\n'))
                .map_or(bytes.len(), |at| half + at + 1);
            let _ = fs::write(path, bytes.get(cut..).unwrap_or_default());
        }
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = file.write_all(line.as_bytes());
    }
}

pub(crate) fn latest_crash_log(home: &Path) -> Option<PathBuf> {
    let candidates = [home.join(FILE_NAME), home.join(crate::webview_recovery::FILE_NAME), home.join(super::frontend_log::FILE_NAME)];
    let mut chosen: Option<(PathBuf, Option<SystemTime>)> = None;
    for candidate in candidates {
        let Ok(metadata) = fs::metadata(&candidate) else { continue };
        if !metadata.is_file() || metadata.len() == 0 {
            continue;
        }
        let modified = metadata.modified().ok();
        let replace = match &chosen {
            None => true,
            Some((_, previous)) => modified > *previous,
        };
        if replace {
            chosen = Some((candidate, modified));
        }
    }
    chosen.map(|(path, _)| path)
}

fn payload_summary(payload: &(dyn Any + Send)) -> &str {
    if let Some(text) = payload.downcast_ref::<&str>() {
        text
    } else if let Some(text) = payload.downcast_ref::<String>() {
        text.as_str()
    } else {
        "non-string panic payload"
    }
}

pub(super) fn sanitize_single_line(raw: &str, max_chars: usize) -> String {
    let mut out = String::new();
    let mut count = 0usize;
    let mut pending_space = false;
    let mut truncated = false;
    for ch in raw.chars() {
        if ch.is_control() || ch.is_whitespace() {
            if !out.is_empty() {
                pending_space = true;
            }
            continue;
        }
        if pending_space {
            if count + 1 > max_chars {
                truncated = true;
                break;
            }
            out.push(' ');
            count += 1;
            pending_space = false;
        }
        if count >= max_chars {
            truncated = true;
            break;
        }
        out.push(ch);
        count += 1;
    }
    if out.is_empty() {
        return "-".to_string();
    }
    if truncated {
        out.push_str("...");
    }
    out
}

fn format_panic_line(
    time: &str,
    version: &str,
    thread: Option<&str>,
    location: Option<(&str, u32, u32)>,
    summary: &str,
) -> String {
    let thread_label = thread
        .map(|name| sanitize_single_line(name, MAX_THREAD_CHARS))
        .filter(|name| name != "-")
        .unwrap_or_else(|| "unnamed".to_string());
    let at = match location {
        Some((file, line, column)) => format!("{}:{line}:{column}", sanitize_single_line(file, 160)),
        None => "-".to_string(),
    };
    let message = sanitize_single_line(summary, MAX_SUMMARY_CHARS);
    format!("{time} v{version} thread={thread_label} at={at} msg={message}\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn formats_panic_line_with_single_line_sanitized_and_truncated_summary() {
        let line = format_panic_line(
            "2026-11-17 22:55:01+08:00",
            "0.3.11-beta.3",
            Some("clipboard\nworker"),
            Some(("src-tauri/src/clipboard_history/service.rs", 142, 9)),
            "index out of bounds:\r\n  the len is 0\tbut index is 1",
        );
        assert_eq!(
            line,
            "2026-11-17 22:55:01+08:00 v0.3.11-beta.3 thread=clipboard worker at=src-tauri/src/clipboard_history/service.rs:142:9 msg=index out of bounds: the len is 0 but index is 1\n"
        );

        let long_msg = "汉".repeat(300);
        let truncated = format_panic_line("t", "1.0.0", None, None, &long_msg);
        let expected_msg = format!("{}...", "汉".repeat(MAX_SUMMARY_CHARS));
        assert_eq!(truncated, format!("t v1.0.0 thread=unnamed at=- msg={expected_msg}\n"));
        assert_eq!(format_panic_line("t", "1.0.0", Some("   "), None, "\r\n\t "), "t v1.0.0 thread=unnamed at=- msg=-\n");
    }

    #[test]
    fn append_capped_preserves_newer_half_across_multibyte_utf8_lines() {
        let dir = std::env::temp_dir().join(format!("fuyu-panic-log-utf8-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join(FILE_NAME);
        let row = format!("{}\n", "崩".repeat(33));
        fs::write(&path, row.repeat(700)).unwrap();
        assert!(fs::metadata(&path).unwrap().len() > MAX_BYTES);
        append_capped(&path, "latest-entry\n");
        let text = fs::read_to_string(&path).unwrap();
        assert!(text.len() > 20 * 1024 && (text.len() as u64) < MAX_BYTES);
        assert!(text.ends_with(&format!("{row}latest-entry\n")));
        assert!(text.lines().all(|item| item == "latest-entry" || item == "崩".repeat(33)));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn latest_crash_log_picks_non_empty_newest_file() {
        let dir = std::env::temp_dir().join(format!("fuyu-crash-locate-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        assert_eq!(latest_crash_log(&dir), None);

        let crash = dir.join(FILE_NAME);
        fs::write(&crash, "").unwrap();
        assert_eq!(latest_crash_log(&dir), None);

        let webview = dir.join(crate::webview_recovery::FILE_NAME);
        fs::write(&webview, "gpu-process-exited\n").unwrap();
        OpenOptions::new()
            .write(true)
            .open(&webview)
            .unwrap()
            .set_modified(SystemTime::UNIX_EPOCH + Duration::from_secs(100))
            .unwrap();
        assert_eq!(latest_crash_log(&dir), Some(webview.clone()));

        fs::write(&crash, "panic line\n").unwrap();
        OpenOptions::new()
            .write(true)
            .open(&crash)
            .unwrap()
            .set_modified(SystemTime::UNIX_EPOCH + Duration::from_secs(200))
            .unwrap();
        assert_eq!(latest_crash_log(&dir), Some(crash));

        let frontend = dir.join(crate::home_dir::frontend_log::FILE_NAME);
        fs::write(&frontend, "render\n").unwrap();
        OpenOptions::new()
            .write(true)
            .open(&frontend)
            .unwrap()
            .set_modified(SystemTime::UNIX_EPOCH + Duration::from_secs(300))
            .unwrap();
        assert_eq!(latest_crash_log(&dir), Some(frontend));
        fs::remove_dir_all(&dir).unwrap();
    }
}
