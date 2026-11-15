use std::{
    fs,
    path::{Path, PathBuf},
};

use super::store::{self, Request, BACKUP_DIR, KEEP, PENDING};

fn temp_home(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-update-backup-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn request<'a>(stamp: &'a str, at: i64, snapshot: &'a str) -> Request<'a> {
    Request { from_version: "0.3.9", to_version: "0.4.0", snapshot, now_millis: at, stamp }
}

fn seed(home: &Path) {
    fs::write(home.join("settings.json"), "{\"a\":1}").unwrap();
    fs::write(home.join("todos.json"), "[1,2]").unwrap();
    fs::write(home.join("local-api.json"), "{\"token\":\"secret\"}").unwrap();
    fs::write(home.join("agent-approval.json"), "{\"token\":\"secret\"}").unwrap();
    fs::create_dir_all(home.join("plugins-data/demo")).unwrap();
    fs::write(home.join("plugins-data/demo/state.json"), "x").unwrap();
    fs::create_dir_all(home.join("screenshots")).unwrap();
    fs::write(home.join("screenshots/1.png"), "png").unwrap();
}

#[test]
fn backs_up_data_files_but_not_tokens_or_caches() {
    let home = temp_home("create");
    seed(&home);
    let snapshot = r#"{"fuyu-settings":"{}","fuyu-settings-focus":"x","other":"y"}"#;
    store::create(&home, &request("20261115-100000", 1, snapshot)).unwrap();
    let id = "pre-update-0.3.9-20261115-100000";
    let dir = home.join(BACKUP_DIR).join(id);
    assert!(dir.join("files/settings.json").is_file());
    assert!(dir.join("files/todos.json").is_file());
    assert!(dir.join("files/plugins-data/demo/state.json").is_file());
    assert!(!dir.join("files/local-api.json").exists());
    assert!(!dir.join("files/agent-approval.json").exists());
    assert!(!dir.join("files/screenshots").exists());
    let keys = fs::read_to_string(dir.join("local-storage.json")).unwrap();
    assert!(keys.contains("fuyu-settings"));
    assert!(!keys.contains("fuyu-settings-focus"));
    assert!(!keys.contains("other"));
    let list = store::list(&home);
    let json = serde_json::to_value(&list).unwrap();
    assert_eq!(json["backups"][0]["id"], id);
    assert_eq!(json["backups"][0]["fromVersion"], "0.3.9");
    assert_eq!(json["backups"][0]["files"], 3);
    let _ = fs::remove_dir_all(&home);
}

#[test]
fn keeps_only_the_newest_three() {
    let home = temp_home("prune");
    seed(&home);
    for n in 0..5 {
        store::create(&home, &request(&format!("2026111{n}-000000"), n, "{}")).unwrap();
    }
    let list = serde_json::to_value(store::list(&home)).unwrap();
    let ids: Vec<&str> = list["backups"].as_array().unwrap().iter().map(|b| b["id"].as_str().unwrap()).collect();
    assert_eq!(ids.len(), KEEP);
    assert_eq!(ids[0], "pre-update-0.3.9-20261114-000000");
    let _ = fs::remove_dir_all(&home);
}

#[test]
fn rejects_snapshots_that_are_not_string_maps() {
    let home = temp_home("bad");
    let error = store::create(&home, &request("1", 1, r#"{"fuyu-settings":1}"#)).unwrap_err();
    assert_eq!(error.code(), "updateBackup.badSnapshot");
    assert_eq!(store::create(&home, &request("1", 1, "[]")).unwrap_err().code(), "updateBackup.badSnapshot");
    let _ = fs::remove_dir_all(&home);
}

#[test]
fn restore_puts_files_back_on_the_next_start() {
    let home = temp_home("restore");
    seed(&home);
    store::create(&home, &request("20261115-100000", 1, r#"{"fuyu-locale":"\"en\""}"#)).unwrap();
    let id = "pre-update-0.3.9-20261115-100000";
    fs::write(home.join("todos.json"), "broken").unwrap();
    fs::remove_file(home.join("plugins-data/demo/state.json")).unwrap();
    let keys = store::prepare_restore(&home, id).unwrap();
    assert_eq!(keys.get("fuyu-locale").map(String::as_str), Some("\"en\""));
    assert_eq!(fs::read_to_string(home.join("todos.json")).unwrap(), "broken");
    assert_eq!(serde_json::to_value(store::list(&home)).unwrap()["pendingRestore"], id);
    assert_eq!(store::apply_pending(&home).unwrap().as_deref(), Some(id));
    assert_eq!(fs::read_to_string(home.join("todos.json")).unwrap(), "[1,2]");
    assert_eq!(fs::read_to_string(home.join("plugins-data/demo/state.json")).unwrap(), "x");
    assert!(!home.join(BACKUP_DIR).join(PENDING).exists());
    assert_eq!(store::apply_pending(&home).unwrap(), None);
    let _ = fs::remove_dir_all(&home);
}

#[test]
fn damaged_or_unknown_backups_are_refused() {
    let home = temp_home("damaged");
    seed(&home);
    store::create(&home, &request("20261115-100000", 1, "{}")).unwrap();
    let id = "pre-update-0.3.9-20261115-100000";
    fs::write(home.join(BACKUP_DIR).join(id).join("files/todos.json"), "tampered").unwrap();
    assert_eq!(store::prepare_restore(&home, id).unwrap_err().code(), "updateBackup.corrupt");
    assert_eq!(store::prepare_restore(&home, "../escape").unwrap_err().code(), "updateBackup.notFound");
    assert_eq!(store::prepare_restore(&home, "pre-update-missing").unwrap_err().code(), "updateBackup.notFound");
    let _ = fs::remove_dir_all(&home);
}

#[test]
fn broken_plugin_files_newer_than_the_backup_are_reported() {
    let home = temp_home("broken");
    seed(&home);
    store::create(&home, &request("20261115-100000", 1, "{}")).unwrap();
    fs::write(home.join("plugins.broken-1.json"), "x").unwrap();
    let list = serde_json::to_value(store::list(&home)).unwrap();
    assert_eq!(list["brokenFiles"][0], "plugins.broken-1.json");
    let _ = fs::remove_dir_all(&home);
}
