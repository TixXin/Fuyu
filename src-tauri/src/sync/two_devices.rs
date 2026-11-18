use serde_json::{json, Map, Value};
use std::fs;

use super::{
    backend::{is_ignored_name, is_safe_path, Backend},
    backend_folder::FolderBackend,
    base,
    config::SyncCategory,
    layout::{self, Note},
    merge,
    round::{Options, Outcome, RoundResult},
    settings_meta::{PRESETS_KEY, SETTINGS_KEY},
    test_devices::{find, record, temp, todo, Device},
    Hlc, Tombstone,
};

fn done(result: &RoundResult) -> &[(SyncCategory, Outcome)] {
    match result {
        RoundResult::Done { categories, .. } => categories,
        other => panic!("the round did not finish: {other:?}"),
    }
}

fn outcome(result: &RoundResult, category: SyncCategory) -> Outcome {
    done(result).iter().find(|(kind, _)| *kind == category).map(|(_, outcome)| outcome.clone()).expect("category ran")
}

fn pair(name: &str) -> (std::path::PathBuf, Device, Device) {
    let root = temp(name);
    let folder = root.join("cloud");
    fs::create_dir_all(&folder).expect("cloud folder");
    (folder, Device::new("deva", &root), Device::new("devb", &root))
}

fn settle(folder: &std::path::Path, a: &mut Device, b: &mut Device) {
    done(&a.sync(folder));
    done(&b.sync(folder));
    done(&a.sync(folder));
}

#[test]
fn an_added_todo_reaches_the_other_device() {
    let (folder, mut a, mut b) = pair("add");
    let stamp = a.stamp();
    a.todos.data["todos"] = json!([todo("t1", "Buy milk", &stamp)]);
    settle(&folder, &mut a, &mut b);
    assert_eq!(b.todo_ids(), vec!["t1"]);
    assert_eq!(b.todos.data["todos"][0]["updatedAt"], json!(stamp.to_string()));
    assert!(folder.join("fuyu-sync/meta.json").is_file());
    assert!(folder.join("fuyu-sync/devices/deva/todos.json").is_file());
    let RoundResult::Done { devices, .. } = b.sync(&folder) else { panic!("round") };
    assert_eq!(devices.iter().map(|device| device.device_id.as_str()).collect::<Vec<_>>(), vec!["deva", "devb"]);
}

#[test]
fn an_edit_and_a_delete_travel_both_ways() {
    let (folder, mut a, mut b) = pair("edit");
    let (one, two) = (a.stamp(), a.stamp());
    a.todos.data["todos"] = json!([todo("t1", "One", &one), todo("t2", "Two", &two)]);
    settle(&folder, &mut a, &mut b);
    let edited = b.stamp();
    b.todos.data["todos"][0] = todo("t1", "One, edited", &edited);
    done(&b.sync(&folder));
    done(&a.sync(&folder));
    assert_eq!(a.todos.data["todos"][0]["title"], "One, edited");
    let gone = a.stamp();
    a.todos.data["todos"] = json!([a.todos.data["todos"][0].clone()]);
    a.todos.data["tombstones"] = serde_json::to_value(vec![Tombstone::new("t2", gone)]).expect("tombstones");
    settle(&folder, &mut a, &mut b);
    assert_eq!(b.todo_ids(), vec!["t1"]);
    assert_eq!(b.todos.data["tombstones"][0]["id"], "t2");
}

#[test]
fn when_both_edit_the_same_todo_the_later_edit_wins_everywhere() {
    let (folder, mut a, mut b) = pair("concurrent");
    let first = a.stamp();
    a.todos.data["todos"] = json!([todo("t1", "Draft", &first)]);
    settle(&folder, &mut a, &mut b);
    let early = a.stamp();
    b.clock.wall = a.clock.wall + 5_000;
    let late = b.stamp();
    a.todos.data["todos"][0] = todo("t1", "From A", &early);
    b.todos.data["todos"][0] = todo("t1", "From B", &late);
    done(&a.sync(&folder));
    done(&b.sync(&folder));
    done(&a.sync(&folder));
    assert_eq!(a.todos.data["todos"][0]["title"], "From B");
    assert_eq!(b.todos.data["todos"][0]["title"], "From B");
}

#[test]
fn a_daily_note_changed_on_both_sides_keeps_both_texts() {
    let (folder, mut a, mut b) = pair("note");
    let stamp = a.stamp();
    a.todos.data["dailyNote"] = json!("plan");
    a.todos.data["dailyNoteUpdatedAt"] = json!(stamp.to_string());
    settle(&folder, &mut a, &mut b);
    assert_eq!(b.todos.data["dailyNote"], "plan");
    let (left, right) = (a.stamp(), b.stamp());
    a.todos.data["dailyNote"] = json!("plan\nfrom A");
    a.todos.data["dailyNoteUpdatedAt"] = json!(left.to_string());
    b.todos.data["dailyNote"] = json!("plan\nfrom B");
    b.todos.data["dailyNoteUpdatedAt"] = json!(right.to_string());
    done(&a.sync(&folder));
    done(&b.sync(&folder));
    done(&a.sync(&folder));
    let note = b.todos.data["dailyNote"].as_str().expect("note").to_string();
    assert!(note.contains("from A") && note.contains("from B"), "{note}");
    assert!(note.contains("———"), "{note}");
    assert_eq!(a.todos.data["dailyNote"], json!(note));
    done(&b.sync(&folder));
    assert_eq!(b.todos.data["dailyNote"], json!(note));
}

#[test]
fn a_note_edited_on_one_side_only_is_simply_taken() {
    let base = Note { text: "x".into(), updated_at: Hlc::from_millis(1, "deva") };
    let local = layout::Doc { notes: [("d".to_string(), base.clone())].into(), ..Default::default() };
    let remote = layout::Doc { notes: [("d".to_string(), Note { text: "x y".into(), updated_at: Hlc::from_millis(2, "devb") })].into(), ..Default::default() };
    let pinned = |_: &str| false;
    let rules = merge::Rules { first: false, pinned: &pinned };
    let merged = merge::merge(&local, &remote, Some(&local), &rules, &mut || panic!("no conflict"));
    assert_eq!(merged.notes["d"].text, "x y");
}

#[test]
fn the_first_merge_takes_the_union_and_backs_up_once() {
    let (folder, mut a, mut b) = pair("first");
    let (one, two) = (a.stamp(), b.stamp());
    a.todos.data["todos"] = json!([todo("a1", "From A", &one)]);
    b.todos.data["todos"] = json!([todo("b1", "From B", &two)]);
    done(&a.sync(&folder));
    assert_eq!(a.backups, 0);
    done(&b.sync(&folder));
    assert_eq!(b.todo_ids(), vec!["a1", "b1"]);
    assert_eq!(b.backups, 1);
    done(&a.sync(&folder));
    assert_eq!(a.todo_ids(), vec!["a1", "b1"]);
    done(&b.sync(&folder));
    assert_eq!(b.backups, 1);
}

#[test]
fn deleting_most_of_the_data_stops_and_asks_first() {
    let (folder, mut a, mut b) = pair("brake");
    let snippets: Vec<Value> = (0..10).map(|n| {
        let stamp = a.stamp();
        record(&format!("s{n}"), "text", &format!("text {n}"), &stamp)
    }).collect();
    a.snippets.items = snippets.clone();
    settle(&folder, &mut a, &mut b);
    assert_eq!(b.snippets.items.len(), 10);
    for item in &snippets[..8] {
        let stamp = a.stamp();
        a.snippets.tombstones.push(Tombstone::new(item["id"].as_str().expect("id"), stamp));
    }
    a.snippets.items = snippets[8..].to_vec();
    done(&a.sync(&folder));
    let result = b.sync(&folder);
    assert_eq!(outcome(&result, SyncCategory::Snippets), Outcome::NeedsConfirm { removed: 8, total: 10 });
    assert_eq!(b.snippets.items.len(), 10);
    let result = b.sync_with(&folder, Options { allow_deletions: true, allow_reset: false });
    assert!(matches!(outcome(&result, SyncCategory::Snippets), Outcome::Synced { .. }));
    assert_eq!(b.snippets.items.len(), 2);
}

#[test]
fn a_missing_folder_skips_the_whole_round() {
    let (folder, mut a, _) = pair("missing");
    let stamp = a.stamp();
    a.todos.data["todos"] = json!([todo("t1", "Keep", &stamp)]);
    done(&a.sync(&folder));
    fs::remove_dir_all(&folder).expect("remove folder");
    assert!(matches!(a.sync(&folder), RoundResult::FolderMissing(_)));
    assert_eq!(a.todo_ids(), vec!["t1"]);
    assert!(!folder.exists());
}

#[test]
fn a_cleared_remote_asks_before_starting_over() {
    let (folder, mut a, _) = pair("cleared");
    done(&a.sync(&folder));
    fs::remove_dir_all(folder.join("fuyu-sync")).expect("clear remote");
    assert_eq!(a.sync(&folder), RoundResult::RemoteCleared);
    done(&a.sync_with(&folder, Options { allow_deletions: false, allow_reset: true }));
    assert!(folder.join("fuyu-sync/meta.json").is_file());
}

#[test]
fn a_newer_format_stops_only_what_it_touches() {
    let (folder, mut a, mut b) = pair("newer");
    settle(&folder, &mut a, &mut b);
    let path = folder.join("fuyu-sync/devices/devb/snippets.json");
    fs::write(&path, r#"{"schemaVersion":2,"category":"snippets","deviceId":"devb","entries":{}}"#).expect("newer file");
    let result = a.sync(&folder);
    assert_eq!(outcome(&result, SyncCategory::Snippets), Outcome::NewerVersion);
    assert!(matches!(outcome(&result, SyncCategory::Todos), Outcome::Synced { .. }));
    fs::write(folder.join(layout::META_FILE), r#"{"schemaVersion":2,"app":"fuyu"}"#).expect("newer meta");
    assert_eq!(a.sync(&folder), RoundResult::NewerVersion);
}

#[test]
fn an_unreadable_file_is_skipped() {
    let (folder, mut a, mut b) = pair("unreadable");
    let stamp = a.stamp();
    a.todos.data["todos"] = json!([todo("t1", "Fine", &stamp)]);
    settle(&folder, &mut a, &mut b);
    fs::create_dir_all(folder.join("fuyu-sync/devices/devc")).expect("third device");
    fs::write(folder.join("fuyu-sync/devices/devc/todos.json"), "{ half a file").expect("broken file");
    let RoundResult::Done { skipped, .. } = b.sync(&folder) else { panic!("round") };
    assert_eq!(skipped, vec!["fuyu-sync/devices/devc/todos.json".to_string()]);
    assert_eq!(b.todo_ids(), vec!["t1"]);
}

#[test]
fn todos_move_between_lists_and_archives_by_their_newest_place() {
    let (folder, mut a, mut b) = pair("archive");
    let stamp = a.stamp();
    a.todos.data["todos"] = json!([todo("t1", "Ship it", &stamp)]);
    settle(&folder, &mut a, &mut b);
    let moved = a.stamp();
    a.todos.data["todos"] = json!([]);
    a.todos.data["archives"] = json!([{ "date": "2026-11-14", "todos": [todo("t1", "Ship it", &moved)], "dailyNote": "old day", "savedAt": 5, "savedToDisk": true, "filePath": "/a/b.md", "updatedAt": moved.to_string() }]);
    settle(&folder, &mut a, &mut b);
    assert!(b.todo_ids().is_empty());
    let archive = &b.todos.data["archives"][0];
    assert_eq!(archive["date"], "2026-11-14");
    assert_eq!(archive["todos"][0]["id"], "t1");
    assert_eq!(archive["dailyNote"], "old day");
    assert_eq!(archive["savedToDisk"], false);
    assert!(archive.get("filePath").is_none());
}

fn settings_keys(theme: &str, music: bool, width: u32, projects: Value) -> Map<String, Value> {
    let settings = json!({ "themeMode": theme, "musicEnabled": music, "panelWidth": width, "todoProjects": projects });
    let mut keys = Map::new();
    keys.insert(SETTINGS_KEY.into(), Value::String(settings.to_string()));
    keys.insert("fuyu-locale".into(), Value::String("zh-CN".into()));
    keys
}

fn setting(device: &Device, field: &str) -> Value {
    let raw = device.settings.local.keys[SETTINGS_KEY].as_str().expect("settings");
    serde_json::from_str::<Value>(raw).expect("json")[field].clone()
}

#[test]
fn settings_merge_by_field_and_keep_local_ones_local() {
    let (folder, mut a, mut b) = pair("settings");
    a.set_settings(settings_keys("dark", false, 500, json!([{ "id": "p1", "name": "Work" }])));
    b.set_settings(settings_keys("light", true, 700, json!([])));
    done(&a.sync(&folder));
    done(&b.sync(&folder));
    assert_eq!(setting(&b, "themeMode"), "light");
    assert_eq!(setting(&b, "musicEnabled"), false);
    assert_eq!(setting(&b, "panelWidth"), 700);
    assert_eq!(setting(&b, "todoProjects"), json!([{ "id": "p1", "name": "Work" }]));
    a.set_settings(settings_keys("blue", true, 500, json!([{ "id": "p1", "name": "Work" }])));
    done(&a.sync(&folder));
    done(&b.sync(&folder));
    assert_eq!(setting(&b, "themeMode"), "blue");
    assert_eq!(setting(&b, "musicEnabled"), false, "a module switch only comes over on the first merge");
    assert_eq!(b.settings.local.meta.fields[SETTINGS_KEY]["themeMode"], a.settings.local.meta.fields[SETTINGS_KEY]["themeMode"]);
}

#[test]
fn presets_keep_the_local_only_fields_of_this_device() {
    let (folder, mut a, mut b) = pair("presets");
    let preset = |width: u32, theme: &str| json!([{ "id": "p", "name": "Night", "settings": { "themeMode": theme, "panelWidth": width } }]);
    let keys = |presets: Value| {
        let mut keys = Map::new();
        keys.insert(PRESETS_KEY.into(), Value::String(presets.to_string()));
        keys
    };
    a.set_settings(keys(preset(500, "dark")));
    settle(&folder, &mut a, &mut b);
    b.set_settings(keys(preset(800, "dark")));
    a.set_settings(keys(preset(500, "light")));
    done(&a.sync(&folder));
    done(&b.sync(&folder));
    let raw = b.presets.local.keys[PRESETS_KEY].as_str().expect("presets");
    let presets: Value = serde_json::from_str(raw).expect("json");
    assert_eq!(presets[0]["settings"]["themeMode"], "light");
    assert_eq!(presets[0]["settings"]["panelWidth"], 800);
}

#[test]
fn bookmarks_with_the_same_address_are_folded_into_one() {
    let (folder, mut a, mut b) = pair("links");
    let (one, two) = (a.stamp(), b.stamp());
    a.links.items = vec![json!({ "id": "la", "url": "https://x.dev/", "title": "A", "addedAt": 1, "sortKey": "m", "updatedAt": one.to_string() })];
    b.links.items = vec![json!({ "id": "lb", "url": "https://x.dev/", "title": "B", "addedAt": 2, "sortKey": "m", "updatedAt": two.to_string() }), json!({ "id": "lc", "url": "https://y.dev/", "title": "C", "addedAt": 3, "sortKey": "m", "updatedAt": two.to_string() })];
    settle(&folder, &mut a, &mut b);
    done(&b.sync(&folder));
    let ids = |device: &Device| device.links.items.iter().map(|link| link["id"].as_str().unwrap_or_default().to_string()).collect::<Vec<_>>();
    assert_eq!(ids(&a).len(), 2);
    assert_eq!(ids(&a), ids(&b));
    assert!(find(&a.links.items, "la").is_none());
    let keys: Vec<&str> = a.links.items.iter().map(|link| link["sortKey"].as_str().unwrap_or_default()).collect();
    assert!(keys[0] < keys[1], "{keys:?}");
}

#[test]
fn the_folder_backend_writes_through_a_hidden_temporary_file() {
    let root = temp("folder");
    let backend = FolderBackend::new(root.clone());
    backend.write("fuyu-sync/devices/deva/todos.json", b"{}").expect("write");
    let names: Vec<String> = fs::read_dir(root.join("fuyu-sync/devices/deva")).expect("dir").flatten().map(|entry| entry.file_name().to_string_lossy().into_owned()).collect();
    assert_eq!(names, vec!["todos.json".to_string()]);
    assert_eq!(backend.read("fuyu-sync/devices/deva/todos.json").expect("read"), Some(b"{}".to_vec()));
    assert_eq!(backend.read("fuyu-sync/nothing.json").expect("read"), None);
    fs::write(root.join("fuyu-sync/devices/deva/todos (1).json"), "x").expect("copy");
    fs::write(root.join("fuyu-sync/devices/.todos.json.fuyu-tmp"), "x").expect("tmp");
    let listed: Vec<String> = backend.list("fuyu-sync/devices/deva").expect("list").into_iter().map(|item| item.name).collect();
    assert_eq!(listed, vec!["todos.json".to_string()]);
    backend.delete("fuyu-sync/devices/deva/todos.json").expect("delete");
    assert!(backend.write("../escape.json", b"x").is_err());
    assert!(backend.read("/etc/passwd").is_err());
    let _ = fs::remove_dir_all(&root);
    assert!(backend.check().is_err());
}

#[test]
fn copies_from_cloud_drives_are_ignored() {
    for name in ["todos (1).json", "todos.sync-conflict-20261115.json", "todos (冲突副本).json", "todos-Conflict.json", "~$todos.json", ".todos.json.icloud", "todos.json.tmp"] {
        assert!(is_ignored_name(name), "{name}");
    }
    for name in ["todos.json", "deva", "a1b2c3d4e5f60718", "settings.json"] {
        assert!(!is_ignored_name(name), "{name}");
    }
    assert!(is_safe_path("fuyu-sync/meta.json"));
    assert!(!is_safe_path("fuyu-sync/../x") && !is_safe_path("a\\b") && !is_safe_path("") && !is_safe_path("a//b"));
}

#[test]
fn old_tombstones_are_pruned_and_a_changed_folder_starts_fresh() {
    let mut doc = layout::Doc::default();
    doc.tombstones.insert("old".into(), Hlc::from_millis(1, "deva"));
    doc.tombstones.insert("new".into(), Hlc::from_millis(super::record::TOMBSTONE_KEEP_MS, "deva"));
    merge::prune(&mut doc, super::record::TOMBSTONE_KEEP_MS + 10);
    assert_eq!(doc.tombstones.keys().collect::<Vec<_>>(), vec!["new"]);
    let dir = temp("forget");
    base::save(&dir, "todos", &doc).expect("save base");
    assert_eq!(base::load(&dir, "todos"), Some(doc));
    base::forget(&dir);
    assert_eq!(base::load(&dir, "todos"), None);
}

fn optional_keys(provider: &str) -> Map<String, Value> {
    let mut keys = Map::new();
    keys.insert("fuyu-translation-settings".into(), Value::String(json!({ "provider": provider, "direction": "auto" }).to_string()));
    let mail = json!({ "accounts": [{ "email": "me@example.com", "host": "imap.example.com", "enabled": true, "password": "hunter2", "authCode": "x" }] });
    keys.insert("fuyu-qq-mail-settings".into(), Value::String(mail.to_string()));
    keys
}

fn provider(device: &Device) -> Value {
    let raw = device.settings.local.keys["fuyu-translation-settings"].as_str().expect("translation");
    serde_json::from_str::<Value>(raw).expect("json")["provider"].clone()
}

#[test]
fn an_optional_group_stays_on_this_device_until_it_is_turned_on() {
    let (folder, mut a, mut b) = pair("optional");
    a.set_settings(optional_keys("deepl"));
    b.set_settings(optional_keys("google"));
    settle(&folder, &mut a, &mut b);
    assert_eq!(provider(&a), "deepl");
    assert_eq!(provider(&b), "google");
    let pushed = fs::read_to_string(folder.join("fuyu-sync/devices/devb/settings.json")).expect("pushed settings");
    assert!(pushed.contains("field:fuyu-translation-settings/direction"), "{pushed}");
    assert!(!pushed.contains("provider") && !pushed.contains("qq-mail"), "{pushed}");
    for device in [&mut a, &mut b] {
        device.settings.groups = vec!["qqMail".into(), "translationProvider".into()];
    }
    a.set_settings(optional_keys("openai"));
    settle(&folder, &mut a, &mut b);
    assert_eq!(provider(&b), "openai");
    let mail = a.settings.local.keys["fuyu-qq-mail-settings"].as_str().expect("mail").to_string();
    assert!(mail.contains("me@example.com") && !mail.contains("hunter2") && !mail.contains("authCode"), "{mail}");
    for device in ["deva", "devb"] {
        let pushed = fs::read_to_string(folder.join(format!("fuyu-sync/devices/{device}/settings.json"))).expect("pushed settings");
        assert!(pushed.contains("qq-mail") && !pushed.contains("hunter2"), "{pushed}");
    }
}

fn clip_item(id: &str, text: &str, favorite: bool, note: &str, pin_key: Option<&str>, stamp: Option<&Hlc>) -> crate::clipboard_history::ClipboardHistoryItem {
    let hash = crate::clipboard_history::text_clipboard_hash(text);
    let mut value = json!({
        "id": id,
        "kind": "text",
        "hash": hash,
        "createdAt": 1_000,
        "copiedAt": 1_000,
        "favorite": favorite,
        "note": note,
        "preview": text,
        "text": text,
    });
    if let Some(key) = pin_key {
        value["pinKey"] = json!(key);
    }
    if let Some(hlc) = stamp {
        value["updatedAt"] = json!(hlc.to_string());
        value["deviceId"] = json!(hlc.device);
    }
    serde_json::from_value(value).expect("clip item")
}

#[test]
fn clipboard_favorites_start_off_by_default_and_merge_by_content_hash_when_enabled() {
    assert!(!super::config::SyncConfig::default().enabled(SyncCategory::ClipFavorites));
    let (folder, mut a, mut b) = pair("clip-fav-hash");
    let s1 = a.stamp();
    a.favorites.items = vec![clip_item("100-a", "same phrase", true, "old note", None, Some(&s1))];
    settle(&folder, &mut a, &mut b);
    assert!(!folder.join("fuyu-sync/devices/deva/clip-favorites.json").exists());
    assert!(b.favorites.items.is_empty());

    a.favorites.enabled = true;
    b.favorites.enabled = true;
    b.clock.wall = a.clock.wall + 2_000;
    let s2 = b.stamp();
    let s3 = b.stamp();
    b.favorites.items = vec![
        clip_item("999-b", "same phrase", true, "newer note", None, Some(&s2)),
        clip_item("999-only-b", "only on B", true, "", None, Some(&s3)),
    ];
    settle(&folder, &mut a, &mut b);

    assert_eq!(a.favorites.items.iter().filter(|item| item.is_favorite()).count(), 2);
    assert_eq!(b.favorites.items.iter().filter(|item| item.is_favorite()).count(), 2);
    let a_same: Value = serde_json::to_value(a.favorites.items.iter().find(|item| item.id() == "100-a").expect("kept local id on A")).expect("json");
    let b_same: Value = serde_json::to_value(b.favorites.items.iter().find(|item| item.id() == "999-b").expect("kept local id on B")).expect("json");
    assert_eq!(a_same["note"], "newer note");
    assert_eq!(b_same["note"], "newer note");
}

#[test]
fn unfavoriting_and_deleting_clipboard_favorites_propagate_to_the_other_device() {
    let (folder, mut a, mut b) = pair("clip-fav-remove");
    a.favorites.enabled = true;
    b.favorites.enabled = true;
    let (s1, s2) = (a.stamp(), a.stamp());
    let first = clip_item("a-1", "unfav me", true, "", None, Some(&s1));
    let second = clip_item("a-2", "delete me", true, "", None, Some(&s2));
    let hash1 = crate::clipboard_history::text_clipboard_hash("unfav me");
    let hash2 = crate::clipboard_history::text_clipboard_hash("delete me");
    a.favorites.items = vec![first, second];
    settle(&folder, &mut a, &mut b);
    assert_eq!(b.favorites.items.len(), 2);

    b.clock.wall = a.clock.wall + 2_000;
    let unfav_at = b.stamp();
    let mut b_unfav: Value = serde_json::to_value(&b.favorites.items[0]).expect("json");
    let target_hash = b_unfav["hash"].as_str().expect("hash").to_string();
    b_unfav["favorite"] = json!(false);
    b_unfav["fromSync"] = json!(false);
    b_unfav.as_object_mut().expect("obj").remove("updatedAt");
    b.favorites.items[0] = serde_json::from_value(b_unfav).expect("item");
    b.favorites.tombstones.push(Tombstone::new(&target_hash, unfav_at));
    settle(&folder, &mut a, &mut b);

    let a_target: Value = serde_json::to_value(a.favorites.items.iter().find(|item| {
        serde_json::to_value(item).expect("v")["hash"] == target_hash
    }).expect("local copy kept on A")).expect("json");
    assert_eq!(a_target["favorite"], false);

    a.clock.wall = b.clock.wall + 2_000;
    let remaining_hash = if target_hash == hash1 { hash2 } else { hash1 };
    let del_at = a.stamp();
    a.favorites.items.retain(|item| serde_json::to_value(item).expect("v")["hash"] != remaining_hash);
    a.favorites.tombstones.push(Tombstone::new(&remaining_hash, del_at));
    settle(&folder, &mut a, &mut b);

    assert_eq!(a.favorites.items.iter().filter(|item| item.is_favorite()).count(), 0);
    assert_eq!(b.favorites.items.iter().filter(|item| item.is_favorite()).count(), 0);
}

#[test]
fn duplicate_pin_keys_resolve_by_hlc_and_sensitive_entries_never_leave_or_get_overwritten() {
    let (folder, mut a, mut b) = pair("clip-fav-pin-privacy");
    a.favorites.enabled = true;
    b.favorites.enabled = true;

    let early = a.stamp();
    b.clock.wall = a.clock.wall + 3_000;
    let late = b.stamp();

    let mut private_item: Value = serde_json::to_value(clip_item("priv-1", "internal memo", true, "local private", Some("P"), Some(&early))).expect("json");
    private_item["private"] = json!(true);
    let mut masked_item: Value = serde_json::to_value(clip_item("mask-1", "normal looking note", true, "masked local", None, Some(&early))).expect("json");
    masked_item["masked"] = json!(true);
    let secret_item = clip_item("sec-1", "sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789", true, "api key", None, Some(&early));

    a.favorites.items = vec![
        clip_item("a-k", "alpha command", true, "", Some("K"), Some(&early)),
        serde_json::from_value(private_item).expect("private"),
        serde_json::from_value(masked_item).expect("masked"),
        secret_item,
    ];
    let private_hash = crate::clipboard_history::text_clipboard_hash("internal memo");
    b.favorites.items = vec![clip_item("b-k", "beta command", true, "", Some("K"), Some(&late))];
    b.favorites.tombstones.push(Tombstone::new(&private_hash, late.clone()));

    settle(&folder, &mut a, &mut b);

    let pushed_a = fs::read_to_string(folder.join("fuyu-sync/devices/deva/clip-favorites.json")).expect("pushed clip-favorites");
    assert!(!pushed_a.contains("internal memo") && !pushed_a.contains("normal looking note") && !pushed_a.contains("sk-ant-api03"), "{pushed_a}");

    for device in [&a, &b] {
        let alpha: Value = serde_json::to_value(device.favorites.items.iter().find(|item| {
            serde_json::to_value(item).expect("v")["text"] == "alpha command"
        }).expect("alpha")).expect("json");
        let beta: Value = serde_json::to_value(device.favorites.items.iter().find(|item| {
            serde_json::to_value(item).expect("v")["text"] == "beta command"
        }).expect("beta")).expect("json");
        assert!(alpha.get("pinKey").is_none(), "{alpha}");
        assert_eq!(beta["pinKey"], "K");
    }

    let kept_private: Value = serde_json::to_value(a.favorites.items.iter().find(|item| item.id() == "priv-1").expect("private preserved")).expect("json");
    assert_eq!(kept_private["favorite"], true);
    assert_eq!(kept_private["note"], "local private");
    assert_eq!(kept_private["pinKey"], "P");
}
