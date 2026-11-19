use std::{fs, path::PathBuf};

use super::clock::{Clock, Hlc, MAX_FORWARD_DRIFT_MS};
use super::device::{is_valid_id, load_or_create, FILE_NAME};
use super::record::{bury, is_expired, prune, unbury, Tombstone, TOMBSTONE_KEEP_MS};

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-sync-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("temp dir");
    dir
}

fn stamp(ms: u64, counter: u32, device: &str) -> Hlc {
    Hlc { ms, counter, device: device.into() }
}

#[test]
fn timestamps_order_by_time_then_counter_then_device_and_so_do_their_strings() {
    let ordered = [
        stamp(5, 0, "b"),
        stamp(5, 1, "a"),
        stamp(5, 1, "b"),
        stamp(40, 0, "a"),
        stamp(1_762_300_000_000, 0, "a"),
        stamp(1_762_300_000_000, 999_999, "a"),
    ];
    for pair in ordered.windows(2) {
        assert!(pair[0] < pair[1], "{:?} < {:?}", pair[0], pair[1]);
        assert!(pair[0].to_string() < pair[1].to_string(), "{} < {}", pair[0], pair[1]);
    }
}

#[test]
fn timestamps_read_back_as_written_and_refuse_anything_else() {
    let original = stamp(1_762_300_000_000, 7, "0a1b2c3d4e5f6789");
    let text = original.to_string();
    assert_eq!(text, "001762300000000-000007-0a1b2c3d4e5f6789");
    assert_eq!(text.parse::<Hlc>(), Ok(original.clone()));
    let json = serde_json::to_string(&original).expect("encode");
    assert_eq!(json, format!("\"{text}\""));
    assert_eq!(serde_json::from_str::<Hlc>(&json).expect("decode"), original);
    for bad in ["", "1-2-a", "001762300000000-000007-", "001762300000000-00000x-a", "001762300000000-000007-UPPER", "x01762300000000-000007-a"] {
        assert!(bad.parse::<Hlc>().is_err(), "{bad}");
    }
}

#[test]
fn the_clock_moves_forward_even_when_the_wall_clock_goes_back() {
    let mut clock = Clock::new("a");
    let first = clock.tick(1_000);
    let second = clock.tick(1_000);
    let after_rollback = clock.tick(400);
    let later = clock.tick(2_000);
    assert_eq!(first, stamp(1_000, 0, "a"));
    assert_eq!(second, stamp(1_000, 1, "a"));
    assert_eq!(after_rollback, stamp(1_000, 2, "a"));
    assert_eq!(later, stamp(2_000, 0, "a"));
}

#[test]
fn a_full_counter_borrows_the_next_millisecond() {
    let mut clock = Clock::new("a");
    clock.observe(&stamp(1_000, 999_999, "b"), 1_000);
    assert_eq!(clock.tick(1_000), stamp(1_001, 0, "a"));
}

#[test]
fn seeing_a_newer_stamp_makes_the_next_local_stamp_newer_still() {
    let mut clock = Clock::new("a");
    clock.tick(1_000);
    let remote = stamp(5_000, 3, "b");
    clock.observe(&remote, 1_000);
    let next = clock.tick(1_000);
    assert!(next > remote);
    assert_eq!(next, stamp(5_000, 4, "a"));
    clock.observe(&stamp(10, 0, "b"), 1_000);
    assert!(clock.tick(1_000) > next);
}

#[test]
fn a_stamp_far_in_the_future_does_not_drag_the_clock_along() {
    let mut clock = Clock::new("a");
    clock.observe(&stamp(1_000 + MAX_FORWARD_DRIFT_MS + 1, 0, "b"), 1_000);
    assert_eq!(clock.tick(1_000), stamp(1_000, 0, "a"));
}

#[test]
fn tombstones_replace_older_ones_for_the_same_id_and_can_be_lifted() {
    let mut tombstones = Vec::new();
    bury(&mut tombstones, "x", stamp(1, 0, "a"));
    bury(&mut tombstones, "x", stamp(2, 0, "b"));
    assert_eq!(tombstones, vec![Tombstone::new("x", stamp(2, 0, "b"))]);
    assert_eq!(tombstones[0].device_id, "b");
    assert!(unbury(&mut tombstones, "x"));
    assert!(!unbury(&mut tombstones, "x"));
    assert!(tombstones.is_empty());
}

#[test]
fn tombstones_expire_after_ninety_days() {
    let now = 200 * 24 * 60 * 60 * 1000;
    let fresh = Tombstone::new("fresh", stamp(now - TOMBSTONE_KEEP_MS, 0, "a"));
    let old = Tombstone::new("old", stamp(now - TOMBSTONE_KEEP_MS - 1, 0, "a"));
    assert!(!is_expired(&fresh, now));
    assert!(is_expired(&old, now));
    let mut tombstones = vec![fresh.clone(), old];
    assert!(prune(&mut tombstones, now));
    assert_eq!(tombstones, vec![fresh]);
    assert!(!prune(&mut tombstones, now));
}

#[test]
fn tombstones_use_camel_case_keys() {
    let text = serde_json::to_string(&Tombstone::new("x", stamp(1, 0, "a"))).expect("encode");
    assert_eq!(text, r#"{"id":"x","deletedAt":"000000000000001-000000-a","deviceId":"a"}"#);
}

#[test]
fn the_device_id_is_made_once_and_kept() {
    let dir = temp_dir("device");
    let first = load_or_create(&dir).expect("create");
    assert!(is_valid_id(&first));
    assert_eq!(first.len(), 16);
    assert_eq!(load_or_create(&dir).expect("read"), first);
    let other = temp_dir("device-other");
    assert_ne!(load_or_create(&other).expect("create"), first);
}

#[test]
fn a_damaged_device_file_is_set_aside_and_replaced() {
    let dir = temp_dir("device-damaged");
    fs::write(dir.join(FILE_NAME), "{\"deviceId\":\"NOT VALID\"}").expect("write");
    let id = load_or_create(&dir).expect("create");
    assert!(is_valid_id(&id));
    let names: Vec<String> = fs::read_dir(&dir).expect("list").flatten().map(|entry| entry.file_name().to_string_lossy().into_owned()).collect();
    assert!(names.iter().any(|name| name.contains("damaged")), "{names:?}");
}

#[test]
fn an_old_config_with_the_removed_plugin_pages_group_still_loads() {
    let dir = temp_dir("removed-group");
    let old = r#"{"version":1,"folder":"/Users/demo/Sync","categories":["settings","todos"],"optionalGroups":["pluginPages","qqMail"]}"#;
    fs::write(dir.join(super::config::FILE_NAME), old).expect("old config");
    let loaded = super::config::load(&dir);
    assert_eq!(loaded.folder.as_deref(), Some("/Users/demo/Sync"));
    assert_eq!(loaded.categories.len(), 2);
    assert_eq!(loaded.optional_groups, vec!["qqMail".to_string()]);
}
