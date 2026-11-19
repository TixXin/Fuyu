use tauri::{Manager, WebviewWindow};

use super::panic_log::{append_capped, now_text, sanitize_single_line};

pub(crate) const FILE_NAME: &str = "frontend-errors.log";
const MAX_LABEL_CHARS: usize = 64;
const MAX_KIND_CHARS: usize = 24;
const MAX_MESSAGE_CHARS: usize = 240;
const MAX_STACK_CHARS: usize = 600;

#[tauri::command]
pub async fn report_frontend_error(window: WebviewWindow, kind: String, message: String, stack: Option<String>) {
    let Ok(home) = super::fuyu_home(window.app_handle().path()) else {
        return;
    };
    let line = format_line(&now_text(), env!("CARGO_PKG_VERSION"), window.label(), &kind, &message, stack.as_deref());
    append_capped(&home.join(FILE_NAME), &line);
}

fn kind_label(raw: &str) -> String {
    let kept: String = raw.chars().filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-').take(MAX_KIND_CHARS).collect();
    if kept.is_empty() {
        "other".to_string()
    } else {
        kept
    }
}

fn format_line(time: &str, version: &str, label: &str, kind: &str, message: &str, stack: Option<&str>) -> String {
    let window = sanitize_single_line(label, MAX_LABEL_CHARS).replace(' ', "_");
    let message = sanitize_single_line(message, MAX_MESSAGE_CHARS);
    let stack = sanitize_single_line(stack.unwrap_or_default(), MAX_STACK_CHARS);
    format!("{time} v{version} window={window} kind={} msg={message} stack={stack}\n", kind_label(kind))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn line_has_time_version_window_kind_and_single_line_message_and_stack() {
        let line = format_line(
            "2026-11-19 12:10:00+08:00",
            "0.3.11",
            "main",
            "render",
            "TypeError: Cannot read properties of undefined\n(reading 'title')",
            Some("at IslandShell (assets/IslandApp-abc.js:1:2345)\n    at IslandApp (assets/IslandApp-abc.js:1:9)"),
        );
        assert_eq!(
            line,
            "2026-11-19 12:10:00+08:00 v0.3.11 window=main kind=render msg=TypeError: Cannot read properties of undefined (reading 'title') stack=at IslandShell (assets/IslandApp-abc.js:1:2345) at IslandApp (assets/IslandApp-abc.js:1:9)\n"
        );
    }

    #[test]
    fn long_or_odd_input_is_cut_and_cannot_break_the_line() {
        let line = format_line("t", "1.0.0", "pin 3\n", "re nder\n=x", &"字".repeat(400), None);
        let message = format!("{}...", "字".repeat(MAX_MESSAGE_CHARS));
        assert_eq!(line, format!("t v1.0.0 window=pin_3 kind=renderx msg={message} stack=-\n"));
        assert_eq!(format_line("t", "1.0.0", "main", "\n", "", Some(" \n")), "t v1.0.0 window=main kind=other msg=- stack=-\n");
        let stack = format_line("t", "1.0.0", "main", "error", "x", Some(&"s".repeat(900)));
        assert!(stack.ends_with(&format!("stack={}...\n", "s".repeat(MAX_STACK_CHARS))));
        assert_eq!(stack.matches('\n').count(), 1);
    }
}
