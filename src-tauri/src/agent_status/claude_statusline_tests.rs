use std::fs;

use serde_json::{json, Value};

use super::{install, is_ours, parse_snapshot, read_usage, uninstall, NEXT_FILE_NAME, SCRIPT_FILE_NAME, SNAPSHOT_FILE_NAME};
use crate::agent_status::usage::{needs_fallback, newest, UsageSource};

fn temp_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-statusline-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn settings(path: &std::path::Path) -> Value {
    serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
}

#[test]
fn install_wraps_the_existing_status_line_and_uninstall_puts_it_back() {
    let dir = temp_dir("wrap");
    let settings_path = dir.join("settings.json");
    fs::write(&settings_path, json!({ "theme": "dark", "statusLine": { "type": "command", "command": "~/bin/my-line --x", "padding": 1 } }).to_string()).unwrap();

    install(&settings_path, &dir).unwrap();
    let wrapped = settings(&settings_path);
    let command = wrapped["statusLine"]["command"].as_str().unwrap();
    assert!(is_ours(command) && command.contains(SCRIPT_FILE_NAME), "{command}");
    assert_eq!(wrapped["statusLine"]["padding"], json!(1), "other status line fields stay");
    assert_eq!(wrapped["theme"], json!("dark"));
    assert_eq!(fs::read_to_string(dir.join(NEXT_FILE_NAME)).unwrap(), "~/bin/my-line --x");
    assert!(dir.join(SCRIPT_FILE_NAME).exists());

    install(&settings_path, &dir).unwrap();
    assert_eq!(fs::read_to_string(dir.join(NEXT_FILE_NAME)).unwrap(), "~/bin/my-line --x", "a second install keeps the user's own command, not ours");

    uninstall(&settings_path, &dir).unwrap();
    let restored = settings(&settings_path);
    assert_eq!(restored["statusLine"], json!({ "type": "command", "command": "~/bin/my-line --x", "padding": 1 }));
    assert!(!dir.join(NEXT_FILE_NAME).exists());
}

#[test]
fn without_a_status_line_install_adds_one_and_uninstall_removes_it() {
    let dir = temp_dir("none");
    let settings_path = dir.join("settings.json");
    fs::write(&settings_path, json!({ "hooks": {} }).to_string()).unwrap();
    install(&settings_path, &dir).unwrap();
    assert!(is_ours(settings(&settings_path)["statusLine"]["command"].as_str().unwrap()));
    assert!(!dir.join(NEXT_FILE_NAME).exists());
    uninstall(&settings_path, &dir).unwrap();
    assert_eq!(settings(&settings_path), json!({ "hooks": {} }));
}

#[test]
fn uninstall_leaves_a_status_line_someone_else_set_later() {
    let dir = temp_dir("other");
    let settings_path = dir.join("settings.json");
    fs::write(&settings_path, json!({ "statusLine": { "type": "command", "command": "old" } }).to_string()).unwrap();
    install(&settings_path, &dir).unwrap();
    fs::write(&settings_path, json!({ "statusLine": { "type": "command", "command": "another-tool" } }).to_string()).unwrap();
    uninstall(&settings_path, &dir).unwrap();
    assert_eq!(settings(&settings_path)["statusLine"]["command"], json!("another-tool"));
}

#[test]
fn the_snapshot_reads_both_windows_in_milliseconds() {
    let input = r#"{"session_id":"a","rate_limits":{"five_hour":{"used_percentage":23.5,"resets_at":1763900000},"seven_day":{"used_percentage":41,"resets_at":1764300000}}}"#;
    let usage = parse_snapshot(input, Some(5)).unwrap();
    assert_eq!(usage.source, UsageSource::Statusline);
    assert_eq!(usage.updated_at, Some(5));
    assert_eq!(usage.five_hour.as_ref().map(|window| (window.used, window.resets_at)), Some((23.5, Some(1_763_900_000_000))));
    assert_eq!(usage.seven_day.as_ref().map(|window| window.used), Some(41.0));
    assert!(parse_snapshot(r#"{"rate_limits":{}}"#, None).is_none());
    assert!(parse_snapshot("not json", None).is_none());

    let dir = temp_dir("read");
    fs::write(dir.join(SNAPSHOT_FILE_NAME), input).unwrap();
    assert!(read_usage(&dir).is_some_and(|usage| usage.updated_at.is_some()));
}

#[test]
fn the_newer_reading_wins_and_old_or_expired_readings_ask_the_api() {
    let input = |used: f64, reset: i64| format!(r#"{{"rate_limits":{{"five_hour":{{"used_percentage":{used},"resets_at":{reset}}}}}}}"#);
    let older = parse_snapshot(&input(10.0, 2_000), Some(1_000)).unwrap();
    let newer = parse_snapshot(&input(20.0, 2_000), Some(2_000)).unwrap();
    assert_eq!(newest(Some(older.clone()), Some(newer.clone())).unwrap().updated_at, Some(2_000));
    assert_eq!(newest(None, Some(older.clone())).unwrap().updated_at, Some(1_000));

    let now = 1_000_000_000;
    let fresh = parse_snapshot(&input(10.0, now / 1000 + 3_600), Some(now - 60_000)).unwrap();
    assert!(!needs_fallback(Some(&fresh), now));
    let old = parse_snapshot(&input(10.0, now / 1000 + 3_600), Some(now - 31 * 60_000)).unwrap();
    assert!(needs_fallback(Some(&old), now));
    let expired = parse_snapshot(&input(10.0, now / 1000 - 1), Some(now - 60_000)).unwrap();
    assert!(needs_fallback(Some(&expired), now));
    assert!(needs_fallback(None, now));
}
