use std::{fs, path::PathBuf};

use super::data_dirs::{copy_data_dirs, STATE_FILE};
use super::{renamed_credential, MigrationState};

const OLD: &str = "com.focusd.island";
const NEW: &str = "com.tixxin.fuyu";

fn bases(name: &str) -> (PathBuf, [PathBuf; 2]) {
    let root = std::env::temp_dir().join(format!("fuyu-rename-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    let bases = [root.join("Roaming"), root.join("Local")];
    for base in &bases {
        fs::create_dir_all(base).expect("base");
    }
    (root, bases)
}

fn write(path: PathBuf, text: &str) {
    fs::create_dir_all(path.parent().expect("parent")).expect("dir");
    fs::write(path, text).expect("write");
}

fn old_install(bases: &[PathBuf; 2]) {
    write(bases[0].join(OLD).join("todos.json"), "todos");
    write(bases[0].join(OLD).join("plugins").join("me.x").join("fuyu-plugin.json"), "{}");
    write(bases[1].join(OLD).join("EBWebView").join("Default").join("Local Storage").join("leveldb").join("000003.log"), "storage");
    write(bases[1].join(OLD).join("EBWebView").join("Default").join("Cache").join("data_0"), "cache");
    write(bases[1].join(OLD).join("EBWebView").join("Default").join("Code Cache").join("js").join("x"), "cache");
}

#[test]
fn the_old_folders_are_copied_once_without_the_webview_caches() {
    let (root, bases) = bases("copy");
    old_install(&bases);
    assert!(copy_data_dirs(&bases, OLD, NEW, "{\"from\":\"old\"}").expect("copy"));
    assert_eq!(fs::read_to_string(bases[0].join(NEW).join("todos.json")).expect("todos"), "todos");
    assert!(bases[0].join(NEW).join("plugins").join("me.x").join("fuyu-plugin.json").is_file());
    assert_eq!(fs::read_to_string(bases[0].join(NEW).join(STATE_FILE)).expect("state"), "{\"from\":\"old\"}");
    let profile = bases[1].join(NEW).join("EBWebView").join("Default");
    assert!(profile.join("Local Storage").join("leveldb").join("000003.log").is_file());
    assert!(!profile.join("Cache").exists() && !profile.join("Code Cache").exists());
    assert!(bases[0].join(OLD).join("todos.json").is_file() && bases[1].join(OLD).join("EBWebView").is_dir());
    assert!(!bases[0].join(format!("{NEW}.migrating")).exists() && !bases[1].join(format!("{NEW}.migrating")).exists());

    write(bases[0].join(OLD).join("todos.json"), "newer in the old version");
    assert!(!copy_data_dirs(&bases, OLD, NEW, "{}").expect("second start"));
    assert_eq!(fs::read_to_string(bases[0].join(NEW).join("todos.json")).expect("todos"), "todos");
    let _ = fs::remove_dir_all(root);
}

#[test]
fn a_copy_cut_short_is_thrown_away_and_done_again() {
    let (root, bases) = bases("half");
    old_install(&bases);
    write(bases[0].join(format!("{NEW}.migrating")).join("todos.json"), "half");
    write(bases[1].join(NEW).join("EBWebView").join("stale"), "half");
    assert!(copy_data_dirs(&bases, OLD, NEW, "{}").expect("copy"));
    assert_eq!(fs::read_to_string(bases[0].join(NEW).join("todos.json")).expect("todos"), "todos");
    assert!(!bases[1].join(NEW).join("EBWebView").join("stale").exists());
    assert!(!bases[0].join(format!("{NEW}.migrating")).exists());
    let _ = fs::remove_dir_all(root);
}

#[test]
fn nothing_is_copied_without_old_data_or_over_a_fresh_start() {
    let (root, bases) = bases("none");
    assert!(!copy_data_dirs(&bases, OLD, NEW, "{}").expect("no old data"));
    assert!(!bases[0].join(NEW).exists());
    old_install(&bases);
    write(bases[0].join(NEW).join("todos.json"), "fresh");
    assert!(!copy_data_dirs(&bases, OLD, NEW, "{}").expect("fresh start"));
    assert_eq!(fs::read_to_string(bases[0].join(NEW).join("todos.json")).expect("todos"), "fresh");
    let _ = fs::remove_dir_all(root);
}

#[test]
fn credentials_move_to_the_new_service_names_and_others_stay_put() {
    assert_eq!(renamed_credential("device-key.com.focusd.island.bark").as_deref(), Some("device-key.com.tixxin.fuyu.bark"));
    assert_eq!(renamed_credential("deepl.com.focusd.island.translation").as_deref(), Some("deepl.com.tixxin.fuyu.translation"));
    assert_eq!(
        renamed_credential("token.com.focusd.island.plugin.dev.focusd.github-issues").as_deref(),
        Some("token.com.tixxin.fuyu.plugin.dev.focusd.github-issues"),
    );
    assert_eq!(renamed_credential("me@qq.com.com.focusd.island.qq-mail").as_deref(), Some("me@qq.com.com.tixxin.fuyu.qq-mail"));
    assert_eq!(renamed_credential("x.com.focusd.island").as_deref(), Some("x.com.tixxin.fuyu"));
    for other in ["git:https://github.com", "x.com.focusd.islander", "com.focusd.island.bark", "x.com.tixxin.fuyu.bark"] {
        assert_eq!(renamed_credential(other), None, "{other}");
    }
}

#[test]
fn the_state_file_reads_what_older_or_newer_builds_wrote() {
    let state: MigrationState = serde_json::from_str(r#"{"from":"com.focusd.island","copiedAt":5,"later":1}"#).expect("state");
    assert_eq!(state, MigrationState { from: OLD.into(), copied_at: 5, ..Default::default() });
    let text = serde_json::to_string(&MigrationState { credentials: true, hooks: true, old_install: Some("removed".into()), ..Default::default() }).expect("json");
    assert!(text.contains("\"credentials\":true") && text.contains("\"oldInstall\":\"removed\""));
}
