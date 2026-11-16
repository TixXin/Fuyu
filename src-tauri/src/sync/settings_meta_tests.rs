use serde_json::{json, Map, Value};

use super::{load, restamp, save, whitelist, Hlc, Mode, RecordStamps, Rule, SettingsMeta, Whitelist, PRESETS_KEY, SETTINGS_KEY};
use crate::sync::Clock;

const WALL: u64 = 1_800_000_000_000;

fn keys(entries: &[(&str, Value)]) -> Map<String, Value> {
    entries.iter().map(|(key, value)| (key.to_string(), Value::String(value.to_string()))).collect()
}

fn settings(theme: &str, panel_width: u32, projects: Value) -> Value {
    json!({ "themeMode": theme, "panelWidth": panel_width, "musicEnabled": true, "todoProjects": projects })
}

fn base() -> Map<String, Value> {
    keys(&[
        (SETTINGS_KEY, settings("dark", 560, json!([{ "id": "p1", "name": "Work" }, { "id": "p2", "name": "Home" }]))),
        ("fuyu-locale", json!("zh-CN")),
        ("fuyu-save-directory", json!("/Users/me/notes")),
        (PRESETS_KEY, json!([{ "id": "a", "name": "A", "settings": { "themeMode": "dark", "panelWidth": 500 } }, { "id": "b", "name": "B", "settings": {} }])),
    ])
}

fn first(clock: &mut Clock) -> SettingsMeta {
    let old = base();
    let meta = restamp(whitelist(), Some(&old), &old, &SettingsMeta::default(), clock, WALL);
    restamp(whitelist(), Some(&old), &old, &meta, clock, WALL + 1)
}

fn with(mut map: Map<String, Value>, key: &str, value: Value) -> Map<String, Value> {
    map.insert(key.to_string(), Value::String(value.to_string()));
    map
}

#[test]
fn the_real_whitelist_parses() {
    let list = whitelist();
    assert!(matches!(list.keys.get(PRESETS_KEY), Some(Rule::Whole(Mode::ById))));
    assert_eq!(list.field_mode(SETTINGS_KEY, "panelWidth"), Mode::Local);
    assert_eq!(list.field_mode(SETTINGS_KEY, "themeMode"), Mode::Sync);
    assert_eq!(list.field_mode(SETTINGS_KEY, "musicEnabled"), Mode::FirstMergeOnly);
    assert_eq!(list.field_mode(SETTINGS_KEY, "notAField"), Mode::Local);
    assert!(Whitelist::parse("{\"keys\":{\"x\":\"maybe\"}}").is_err());
}

#[test]
fn settings_already_there_get_the_oldest_stamp_and_local_ones_get_none() {
    let mut clock = Clock::new("dev1");
    let meta = first(&mut clock);
    assert_eq!(meta.keys["fuyu-locale"], Hlc::from_millis(0, "dev1"));
    assert!(!meta.keys.contains_key("fuyu-save-directory"));
    let fields = &meta.fields[SETTINGS_KEY];
    assert_eq!(fields["themeMode"], Hlc::from_millis(0, "dev1"));
    assert!(fields.contains_key("musicEnabled"));
    assert!(!fields.contains_key("panelWidth"));
    assert_eq!(meta.records["fuyu-settings/todoProjects"].items.len(), 2);
    assert_eq!(meta.records[PRESETS_KEY].items.len(), 2);
}

#[test]
fn without_an_earlier_file_nothing_counts_as_a_change() {
    let mut clock = Clock::new("dev1");
    let meta = restamp(whitelist(), None, &base(), &SettingsMeta::default(), &mut clock, WALL);
    assert!(super::all(&meta).all(|stamp| stamp.ms == 0));
    assert!(meta.records[PRESETS_KEY].tombstones.is_empty());
}

#[test]
fn changing_one_setting_only_moves_its_stamp() {
    let mut clock = Clock::new("dev1");
    let meta = first(&mut clock);
    let old = base();
    let new = with(old.clone(), SETTINGS_KEY, settings("light", 560, json!([{ "id": "p1", "name": "Work" }, { "id": "p2", "name": "Home" }])));
    let next = restamp(whitelist(), Some(&old), &new, &meta, &mut clock, WALL + 5);
    assert_eq!(next.fields[SETTINGS_KEY]["themeMode"].ms, WALL + 5);
    let unchanged: Vec<_> = super::all(&next).filter(|stamp| stamp.ms != 0).collect();
    assert_eq!(unchanged.len(), 1);
    assert_eq!(restamp(whitelist(), Some(&new), &new, &next, &mut clock, WALL + 9), next);
}

#[test]
fn local_fields_and_key_order_do_not_count() {
    let mut clock = Clock::new("dev1");
    let meta = first(&mut clock);
    let old = base();
    let new = with(old.clone(), SETTINGS_KEY, json!({ "todoProjects": [{ "name": "Work", "id": "p1" }, { "id": "p2", "name": "Home" }], "musicEnabled": true, "panelWidth": 700, "themeMode": "dark" }));
    let new = with(new, "fuyu-save-directory", json!("/elsewhere"));
    let new = with(new, PRESETS_KEY, json!([{ "id": "a", "name": "A", "settings": { "themeMode": "dark", "panelWidth": 900 } }, { "id": "b", "name": "B", "settings": {} }]));
    assert_eq!(restamp(whitelist(), Some(&old), &new, &meta, &mut clock, WALL + 5), meta);
}

#[test]
fn presets_are_stamped_one_by_one_and_deletions_leave_a_tombstone() {
    let mut clock = Clock::new("dev1");
    let meta = first(&mut clock);
    let old = base();
    let renamed = with(old.clone(), PRESETS_KEY, json!([{ "id": "a", "name": "A2", "settings": { "themeMode": "dark", "panelWidth": 500 } }, { "id": "b", "name": "B", "settings": {} }]));
    let next = restamp(whitelist(), Some(&old), &renamed, &meta, &mut clock, WALL + 5);
    let presets = &next.records[PRESETS_KEY];
    assert_eq!(presets.items["a"].ms, WALL + 5);
    assert_eq!(presets.items["b"].ms, 0);
    assert_eq!(presets.order, meta.records[PRESETS_KEY].order);

    let deleted = with(old.clone(), PRESETS_KEY, json!([{ "id": "b", "name": "B", "settings": {} }]));
    let after = restamp(whitelist(), Some(&renamed), &deleted, &next, &mut clock, WALL + 9);
    let presets = &after.records[PRESETS_KEY];
    assert!(!presets.items.contains_key("a"));
    assert_eq!(presets.tombstones.len(), 1);
    assert_eq!(presets.tombstones[0].id, "a");
    assert_eq!(presets.order.as_ref().map(|stamp| stamp.ms), Some(WALL + 9));

    let back = restamp(whitelist(), Some(&deleted), &renamed, &after, &mut clock, WALL + 12);
    assert!(back.records[PRESETS_KEY].tombstones.is_empty());
}

#[test]
fn moving_a_project_only_moves_the_order_stamp() {
    let mut clock = Clock::new("dev1");
    let meta = first(&mut clock);
    let old = base();
    let new = with(old.clone(), SETTINGS_KEY, settings("dark", 560, json!([{ "id": "p2", "name": "Home" }, { "id": "p1", "name": "Work" }])));
    let next = restamp(whitelist(), Some(&old), &new, &meta, &mut clock, WALL + 5);
    let projects: &RecordStamps = &next.records["fuyu-settings/todoProjects"];
    assert!(projects.items.values().all(|stamp| stamp.ms == 0));
    assert_eq!(projects.order.as_ref().map(|stamp| stamp.ms), Some(WALL + 5));
}

#[test]
fn removing_a_key_is_a_change() {
    let mut clock = Clock::new("dev1");
    let meta = first(&mut clock);
    let old = base();
    let mut new = old.clone();
    new.remove("fuyu-locale");
    let next = restamp(whitelist(), Some(&old), &new, &meta, &mut clock, WALL + 5);
    assert_eq!(next.keys["fuyu-locale"].ms, WALL + 5);
}

#[test]
fn the_meta_file_round_trips_and_a_broken_one_starts_over() {
    let dir = std::env::temp_dir().join(format!("fuyu-settings-meta-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join(super::FILE_NAME);
    let mut clock = Clock::new("dev1");
    let meta = first(&mut clock);
    save(&path, &meta).unwrap();
    assert_eq!(load(&path), meta);
    std::fs::write(&path, "{ broken").unwrap();
    assert_eq!(load(&path), SettingsMeta::default());
    std::fs::remove_dir_all(&dir).unwrap();
}
