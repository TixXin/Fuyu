use serde_json::json;
use std::{fs, path::PathBuf};

use super::model::{is_date, validate, TodosData, TodosFile, FILE_VERSION};
use super::store::{load, save, write_new, LoadError};

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("focusd-todos-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("temp dir");
    dir
}

fn sample() -> TodosFile {
    serde_json::from_value(json!({
        "version": FILE_VERSION,
        "revision": 3,
        "date": "2026-11-05",
        "todos": [{ "id": "a", "title": "写报告", "completed": false, "createdAt": 1762300000000u64 }],
        "scheduled": [{ "id": "s", "title": "later", "date": "2026-11-09", "createdAt": 0 }],
        "archives": [
            { "date": "2026-11-04", "todos": [], "dailyNote": "note", "savedAt": 0, "savedToDisk": false },
            { "date": "2026-11-03", "todos": [], "dailyNote": "", "savedAt": 1.5, "savedToDisk": true, "filePath": "D:\\x.md" }
        ],
        "dailyNote": "今天",
        "activeTodoId": "a"
    }))
    .expect("sample")
}

#[test]
fn todos_json_keeps_the_javascript_shape_and_numbers() {
    let file = sample();
    let text = serde_json::to_string(&file).expect("encode");
    assert!(text.contains("\"createdAt\":1762300000000"), "{text}");
    assert!(text.contains("\"savedAt\":1.5"));
    assert!(text.contains("\"activeTodoId\":\"a\""));
    assert_eq!(text.matches("filePath").count(), 1);
    let back: TodosFile = serde_json::from_str(&text).expect("decode");
    assert_eq!(back, file);
}

#[test]
fn validation_refuses_what_normalize_never_produces() {
    let base = sample().data;
    let broken = |change: fn(&mut TodosData)| {
        let mut data = base.clone();
        change(&mut data);
        validate(&data)
    };
    assert!(validate(&base).is_ok());
    assert!(broken(|data| data.todos[0].title = "  ".into()).is_err());
    assert!(broken(|data| data.todos[0].title = " padded".into()).is_err());
    assert!(broken(|data| data.todos[0].id.clear()).is_err());
    assert!(broken(|data| data.scheduled[0].date = "2026-02-30".into()).is_err());
    assert!(broken(|data| data.archives[0].date.clear()).is_err());
    assert!(broken(|data| data.active_todo_id = Some(String::new())).is_err());
    assert!(broken(|data| data.date = "not a date".into()).is_ok());
}

#[test]
fn dates_are_real_calendar_days() {
    assert!(is_date("2024-02-29"));
    assert!(!is_date("2025-02-29"));
    assert!(is_date("2000-02-29"));
    assert!(!is_date("1900-02-29"));
    assert!(!is_date("2026-13-01"));
    assert!(!is_date("2026-1-01"));
    assert!(!is_date("2026-01-0a"));
}

#[test]
fn save_replaces_the_file_atomically_and_reads_it_back() {
    let dir = temp_dir("save");
    let path = dir.join("todos.json");
    assert_eq!(load(&path).expect("missing is fine"), None);
    let mut file = sample();
    save(&path, &file).expect("first save");
    file.revision += 1;
    file.data.daily_note = "changed".into();
    save(&path, &file).expect("second save");
    assert_eq!(load(&path).expect("load"), Some(file));
    assert!(!dir.join("todos.json.tmp").exists());
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn damaged_newer_or_invalid_files_are_errors_not_empty_data() {
    let dir = temp_dir("damaged");
    let path = dir.join("todos.json");
    fs::write(&path, "{ not json").expect("write");
    assert!(matches!(load(&path), Err(LoadError::Damaged(_))));
    let mut newer = serde_json::to_value(sample()).expect("value");
    newer["version"] = json!(FILE_VERSION + 1);
    newer["todos"] = json!({ "byId": {} });
    fs::write(&path, newer.to_string()).expect("write");
    assert!(matches!(load(&path), Err(LoadError::Newer(_))));
    let mut empty_title = serde_json::to_value(sample()).expect("value");
    empty_title["todos"][0]["title"] = json!("");
    fs::write(&path, empty_title.to_string()).expect("write");
    assert!(matches!(load(&path), Err(LoadError::Damaged(_))));
    let mut bad = sample();
    bad.data.todos[0].title = String::new();
    assert!(save(&path, &bad).is_err());
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn large_archives_round_trip() {
    let dir = temp_dir("large");
    let path = dir.join("todos.json");
    let mut file = sample();
    file.data.archives = (0..3000)
        .map(|day| {
            serde_json::from_value(json!({
                "date": format!("day-{day}"),
                "todos": (0..10).map(|n| json!({ "id": format!("{day}-{n}"), "title": format!("todo {n}"), "completed": n % 2 == 0, "createdAt": day * 10 + n })).collect::<Vec<_>>(),
                "dailyNote": "x".repeat(200),
                "savedAt": day,
                "savedToDisk": false
            }))
            .expect("archive")
        })
        .collect();
    save(&path, &file).expect("save");
    assert_eq!(load(&path).expect("load"), Some(file));
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn backups_never_overwrite() {
    let dir = temp_dir("backup");
    let path = dir.join("todos-migration-backup.json");
    write_new(&path, b"first").expect("first");
    assert!(write_new(&path, b"second").is_err());
    assert_eq!(fs::read_to_string(&path).expect("read"), "first");
    let _ = fs::remove_dir_all(dir);
}

mod migration_tests {
    use serde_json::json;
    use std::fs;

    use super::super::migration::{migrate, plan, prune_reimport_copies, source_hash, LocalTodoKeys, Plan};
    use super::super::model::TodosData;
    use super::super::service::{patched, TodosChange};
    use super::super::store::{load, LoadError};
    use super::{sample, temp_dir};

    fn keys(todos: &str) -> LocalTodoKeys {
        LocalTodoKeys { todos: Some(todos.into()), current_date: Some("2026-11-05".into()), ..Default::default() }
    }

    fn data(title: &str) -> TodosData {
        serde_json::from_value(json!({
            "date": "2026-11-05",
            "todos": [{ "id": "a", "title": title, "completed": false, "createdAt": 1 }],
            "scheduled": [], "archives": [], "dailyNote": "", "activeTodoId": null
        }))
        .expect("data")
    }

    fn backups(dir: &std::path::Path, prefix: &str) -> usize {
        fs::read_dir(dir).expect("list").filter(|entry| entry.as_ref().expect("entry").file_name().to_string_lossy().starts_with(prefix)).count()
    }

    #[test]
    fn the_plan_never_replaces_a_file_it_cannot_read_or_with_empty_storage() {
        let mut file = sample();
        file.migration = Some(serde_json::from_value(json!({ "version": 1, "fromAppVersion": "x", "at": 0, "sourceHash": "h" })).expect("migration"));
        let some = Ok(Some(file));
        assert_eq!(plan(&some, "h", false, false), Ok(Plan::UseFile));
        assert_eq!(plan(&some, "other", true, false), Ok(Plan::UseFile));
        assert_eq!(plan(&some, "other", false, false), Ok(Plan::Import { keep_old: true, reimport: true }));
        assert_eq!(plan(&some, "other", false, true), Ok(Plan::UseFile));
        assert_eq!(plan(&Ok(None), "h", true, false), Ok(Plan::Import { keep_old: false, reimport: false }));
        assert_eq!(plan(&Err(LoadError::Damaged("x".into())), "h", false, false), Ok(Plan::Import { keep_old: true, reimport: false }));
        assert!(plan(&Err(LoadError::Newer("x".into())), "h", false, false).is_err());
        assert!(plan(&Err(LoadError::Unreadable("x".into())), "h", false, false).is_err());
    }

    #[test]
    fn the_source_hash_changes_with_any_key_and_tells_missing_from_empty() {
        let base = keys("[]");
        assert_eq!(source_hash(&base), source_hash(&keys("[]")));
        assert_ne!(source_hash(&base), source_hash(&keys("[ ]")));
        let mut note = base.clone();
        note.daily_note = Some(String::new());
        assert_ne!(source_hash(&base), source_hash(&note));
    }

    #[test]
    fn first_run_imports_and_backs_up_then_later_runs_keep_the_file() {
        let dir = temp_dir("migrate-first");
        let (file, notice) = migrate(&dir, &keys("[raw]"), data("one"), "0.3.0").expect("migrate");
        assert_eq!(notice, None);
        assert_eq!(file.revision, 0);
        assert_eq!(file.migration.as_ref().map(|m| m.from_app_version.as_str()), Some("0.3.0"));
        let backup: serde_json::Value = serde_json::from_str(&fs::read_to_string(dir.join("todos-migration-backup.json")).expect("backup")).expect("json");
        assert_eq!(backup["keys"]["focusd-island-todos"], "[raw]");
        assert_eq!(backup["keys"]["focusd-island-daily-note"], serde_json::Value::Null);

        let (again, notice) = migrate(&dir, &keys("[raw]"), data("ignored"), "0.3.0").expect("again");
        assert_eq!((again.data.todos[0].title.as_str(), notice), ("one", None));
        let (cleared, _) = migrate(&dir, &LocalTodoKeys::default(), data("ignored"), "0.3.0").expect("cleared");
        assert_eq!(cleared.data.todos[0].title, "one");
        assert_eq!(backups(&dir, "todos.before-reimport-"), 0);
        assert_eq!(backups(&dir, "todos-migration-backup"), 1);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn storage_left_behind_by_a_failed_start_never_replaces_the_file() {
        let dir = temp_dir("migrate-stale-fallback");
        migrate(&dir, &keys("[v1]"), data("one"), "0.3.0").expect("migrate");
        let mut stale = keys("[stale]");
        stale.migrated = Some("{\"at\":1}".into());
        for _ in 0..2 {
            let (file, notice) = migrate(&dir, &stale, data("stale"), "0.3.0").expect("keep");
            assert_eq!((file.data.todos[0].title.as_str(), file.revision, notice), ("one", 0, None));
        }
        assert_eq!(backups(&dir, "todos.before-reimport-"), 0);
        assert_eq!(backups(&dir, "todos-migration-backup"), 2);
        let marker_only = LocalTodoKeys { migrated: Some("{}".into()), ..Default::default() };
        assert_eq!(migrate(&dir, &marker_only, data("x"), "0.3.0").expect("empty").0.data.todos[0].title, "one");
        assert_eq!(backups(&dir, "todos-migration-backup"), 2);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn changes_from_an_older_version_are_reimported_after_a_backup() {
        let dir = temp_dir("migrate-reimport");
        migrate(&dir, &keys("[v1]"), data("one"), "0.3.0").expect("migrate");
        let before = fs::read_to_string(dir.join("todos.json")).expect("file");
        let (file, notice) = migrate(&dir, &keys("[changed in 0.2.14]"), data("two"), "0.3.0").expect("reimport");
        assert_eq!((file.data.todos[0].title.as_str(), file.revision, notice), ("two", 1, Some("reimported")));
        let copies: Vec<_> = fs::read_dir(&dir).expect("list").map(|e| e.expect("entry").path()).filter(|p| p.to_string_lossy().contains("before-reimport")).collect();
        assert_eq!(copies.len(), 1);
        assert_eq!(fs::read_to_string(&copies[0]).expect("copy"), before);
        assert_eq!(backups(&dir, "todos-migration-backup"), 2);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn only_the_newest_reimport_copies_are_kept() {
        let dir = temp_dir("migrate-prune");
        fs::create_dir_all(&dir).expect("dir");
        for stamp in [5, 40, 100, 7, 300] {
            fs::write(dir.join(format!("todos.before-reimport-{stamp}.json")), "{}").expect("copy");
        }
        for other in ["todos.before-reimport-x.json", "todos-migration-backup-1.json", "todos.json"] {
            fs::write(dir.join(other), "{}").expect("other");
        }
        prune_reimport_copies(&dir);
        let mut left: Vec<String> = fs::read_dir(&dir).expect("list").map(|e| e.expect("entry").file_name().to_string_lossy().into_owned()).collect();
        left.sort();
        assert_eq!(
            left,
            [
                "todos-migration-backup-1.json",
                "todos.before-reimport-100.json",
                "todos.before-reimport-300.json",
                "todos.before-reimport-40.json",
                "todos.before-reimport-x.json",
                "todos.json"
            ]
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn switching_between_two_builds_does_not_reimport_their_old_copies() {
        let dir = temp_dir("migrate-two-builds");
        migrate(&dir, &keys("[release]"), data("one"), "0.3.0").expect("release");
        migrate(&dir, &keys("[dev]"), data("two"), "0.3.0").expect("dev");
        let path = dir.join("todos.json");
        let mut file: crate::todos::model::TodosFile = serde_json::from_str(&fs::read_to_string(&path).expect("file")).expect("json");
        file.data.todos[0].title = "made in dev".into();
        fs::write(&path, serde_json::to_string(&file).expect("encode")).expect("write");
        for build in ["[release]", "[dev]", "[release]"] {
            let (now, notice) = migrate(&dir, &keys(build), data("stale"), "0.3.0").expect("switch");
            assert_eq!((now.data.todos[0].title.as_str(), notice), ("made in dev", None));
        }
        assert_eq!(backups(&dir, "todos.before-reimport-"), 1);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn damaged_files_are_kept_and_newer_or_bad_data_change_nothing() {
        let dir = temp_dir("migrate-damaged");
        fs::write(dir.join("todos.json"), "{ half").expect("write");
        let (file, notice) = migrate(&dir, &keys("[]"), data("one"), "0.3.0").expect("migrate");
        assert_eq!((file.data.todos.len(), notice), (1, None));
        assert_eq!(backups(&dir, "todos.before-reimport-"), 1);

        let newer = json!({ "version": 99, "anything": true }).to_string();
        fs::write(dir.join("todos.json"), &newer).expect("write");
        assert!(migrate(&dir, &keys("[x]"), data("two"), "0.3.0").is_err());
        assert_eq!(fs::read_to_string(dir.join("todos.json")).expect("file"), newer);

        let other = temp_dir("migrate-invalid");
        assert!(migrate(&other, &keys("[x]"), data(""), "0.3.0").is_err());
        assert!(matches!(load(&other.join("todos.json")), Ok(None)));
        let _ = fs::remove_dir_all(dir);
        let _ = fs::remove_dir_all(other);
    }

    #[test]
    fn changes_replace_only_the_fields_they_carry() {
        let base = data("one");
        let change: TodosChange = serde_json::from_value(json!({ "dailyNote": "n" })).expect("change");
        let next = patched(&base, &change);
        assert_eq!((next.daily_note.as_str(), next.todos.len()), ("n", 1));
        let mut active = base.clone();
        active.active_todo_id = Some("a".into());
        let cleared: TodosChange = serde_json::from_value(json!({ "activeTodoId": null })).expect("change");
        assert_eq!(patched(&active, &cleared).active_todo_id, None);
        let untouched: TodosChange = serde_json::from_value(json!({})).expect("change");
        assert_eq!(patched(&active, &untouched).active_todo_id.as_deref(), Some("a"));
    }
}

mod call_tests {
    use serde_json::{json, Value};

    use super::super::calls::{new_todo_id, run, todos_reason};
    use super::super::model::TodosData;
    use super::super::service::{changed_fields, without_conflicts, OutsideChanges, TodosChange};

    fn data() -> TodosData {
        serde_json::from_value(json!({
            "date": "2026-11-05",
            "todos": [
                { "id": "a", "title": "first", "completed": false, "createdAt": 1 },
                { "id": "b", "title": "second", "completed": false, "createdAt": 2 }
            ],
            "scheduled": [{ "id": "s", "title": "later", "date": "2026-11-20", "createdAt": 5 }],
            "archives": [], "dailyNote": "", "activeTodoId": "a"
        }))
        .expect("data")
    }

    fn call(method: &str, params: Value) -> Result<(Value, Option<TodosData>), (u16, String)> {
        run(method, &params, &data(), "new-id", 99).map(|outcome| (outcome.result, outcome.next))
    }

    #[test]
    fn list_and_get_change_nothing() {
        let (list, next) = call("todos.list", Value::Null).expect("list");
        assert_eq!(next, None);
        assert_eq!(list["activeTodoId"], "a");
        assert_eq!(list["scheduled"][0]["id"], "s");
        assert_eq!(call("note.get", json!({})).expect("note").0, json!({ "date": "2026-11-05", "note": "" }));
    }

    #[test]
    fn add_puts_todos_on_top_or_on_a_later_day() {
        let (todo, next) = call("todos.add", json!({ "title": "  new  " })).expect("add");
        assert_eq!(todo, json!({ "id": "new-id", "title": "new", "completed": false, "createdAt": 99 }));
        assert_eq!(next.expect("next").todos[0].id, "new-id");
        let (later, next) = call("todos.add", json!({ "title": "x", "date": "2026-11-10" })).expect("later");
        assert_eq!(later["date"], "2026-11-10");
        let next = next.expect("next");
        assert_eq!(next.scheduled.iter().map(|todo| todo.id.as_str()).collect::<Vec<_>>(), vec!["new-id", "s"]);
        assert_eq!(next.todos.len(), 2);
        let today = call("todos.add", json!({ "title": "x", "date": "2026-11-05" })).expect("today").1.expect("next");
        assert_eq!(today.todos.len(), 3);
    }

    #[test]
    fn add_takes_an_optional_project() {
        let (todo, _) = call("todos.add", json!({ "title": "x", "project": "  工作  " })).expect("project");
        assert_eq!(todo["project"], "工作");
        let (later, _) = call("todos.add", json!({ "title": "x", "date": "2026-11-10", "project": "a".repeat(30) })).expect("later");
        assert_eq!(later["project"], "a".repeat(20));
        let (blank, _) = call("todos.add", json!({ "title": "x", "project": "  " })).expect("blank");
        assert!(blank.get("project").is_none());
        assert_eq!(call("todos.add", json!({ "title": "x", "project": 3 })).expect_err("number").0, 400);
    }

    #[test]
    fn add_refuses_bad_titles_and_dates() {
        for params in [json!({}), json!({ "title": "   " }), json!({ "title": 5 }), json!({ "title": "x".repeat(501) })] {
            assert!(call("todos.add", params).expect_err("title").1.contains("title"));
        }
        assert!(call("todos.add", json!({ "title": "x".repeat(500) })).is_ok());
        assert!(call("todos.add", json!({ "title": "😀".repeat(251) })).is_err());
        assert_eq!(call("todos.add", json!({ "title": "x", "date": "2026-1-5" })).expect_err("date").0, 400);
        assert_eq!(call("todos.add", json!({ "title": "x", "date": "2026-02-30" })).expect_err("date").0, 400);
        assert!(call("todos.add", json!({ "title": "x", "date": "2026-11-01" })).expect_err("past").1.contains("2026-11-05"));
    }

    #[test]
    fn update_and_remove_find_the_todo_and_clear_the_active_one() {
        assert_eq!(call("todos.update", json!({ "id": "zzz" })).expect_err("missing").0, 404);
        assert_eq!(call("todos.update", json!({ "id": 1 })).expect_err("number id").0, 404);
        assert_eq!(call("todos.update", json!({ "id": "a", "title": "" })).expect_err("title").0, 400);
        assert_eq!(call("todos.update", json!({ "id": "a", "completed": "yes" })).expect_err("bool").0, 400);
        let (todo, next) = call("todos.update", json!({ "id": "a", "title": " renamed ", "completed": true })).expect("update");
        assert_eq!((todo["title"].clone(), todo["completed"].clone()), (json!("renamed"), json!(true)));
        assert_eq!(next.expect("next").active_todo_id, None);
        let (_, next) = call("todos.update", json!({ "id": "b", "completed": true })).expect("other");
        assert_eq!(next.expect("next").active_todo_id.as_deref(), Some("a"));

        assert_eq!(call("todos.remove", json!({ "id": "zzz" })).expect_err("missing").0, 404);
        let (removed, next) = call("todos.remove", json!({ "id": "a" })).expect("remove");
        assert_eq!(removed, json!({ "id": "a" }));
        let next = next.expect("next");
        assert_eq!((next.todos.len(), next.active_todo_id), (1, None));
    }

    #[test]
    fn update_adds_focus_minutes_but_never_more_than_the_time_since_the_last_ones() {
        const MINUTE: u64 = 60_000;
        let start = 1_760_000_000_000u64;
        let add = |from: &TodosData, minutes: Value, now: u64| run("todos.update", &json!({ "id": "a", "addFocusMinutes": minutes }), from, "", now).map(|outcome| (outcome.result, outcome.next));

        let (todo, next) = add(&data(), json!(25), start).expect("first");
        assert_eq!((todo["focusMinutes"].clone(), todo["focusedAt"].clone()), (json!(25), json!(start)));
        let first = next.expect("next");
        assert_eq!((first.todos[0].focus_minutes, first.todos[1].focus_minutes), (Some(25), None));

        let (overlapping, _) = add(&first, json!(25), start + MINUTE).expect("overlapping");
        assert_eq!((overlapping["focusMinutes"].clone(), overlapping["focusedAt"].clone()), (json!(26), json!(start + MINUTE)));
        let (same_moment, _) = add(&first, json!(25), start).expect("same moment");
        assert_eq!((same_moment["focusMinutes"].clone(), same_moment["focusedAt"].clone()), (json!(25), json!(start)));
        let (back_to_back, _) = add(&first, json!(25), start + 25 * MINUTE - 2000).expect("back to back");
        assert_eq!(back_to_back["focusMinutes"], 50);
        let (much_later, _) = add(&first, json!(25), start + 90 * MINUTE).expect("later");
        assert_eq!(much_later["focusMinutes"], 50);
        let (clock_moved_back, _) = add(&first, json!(25), start - 60 * MINUTE).expect("clock");
        assert_eq!(clock_moved_back["focusMinutes"], 50);

        for bad in [json!(0), json!(-5), json!(1.5), json!(601), json!("25"), Value::Null] {
            assert_eq!(add(&data(), bad.clone(), start).expect_err("bad minutes").0, 400, "{bad}");
        }
        let plain = serde_json::to_string(&data()).expect("json");
        assert!(!plain.contains("focusedAt"));
    }

    #[test]
    fn several_todos_can_be_in_progress_and_the_newest_left_becomes_active() {
        let mut started = data();
        started.todos.push(serde_json::from_value(json!({ "id": "c", "title": "third", "completed": false, "createdAt": 3, "startedAt": 20 })).expect("c"));
        started.todos[0].started_at = Some(30.into());
        started.todos[1].started_at = Some(10.into());
        let text = serde_json::to_string(&started).expect("json");
        assert!(text.contains("\"startedAt\":30") && !text.contains("\"startedAt\":null"));
        let run_on = |method: &str, params: Value| run(method, &params, &started, "new-id", 99).expect("call").next.expect("next");

        let done = run_on("todos.update", json!({ "id": "a", "completed": true }));
        assert_eq!((done.todos[0].started_at.clone(), done.active_todo_id.as_deref()), (None, Some("c")));
        let removed = run_on("todos.remove", json!({ "id": "a" }));
        assert_eq!(removed.active_todo_id.as_deref(), Some("c"));
        let other = run_on("todos.update", json!({ "id": "b", "completed": true }));
        assert_eq!((other.todos[1].started_at.clone(), other.active_todo_id.as_deref()), (None, Some("a")));
    }

    #[test]
    fn other_days_come_from_the_archives_and_the_scheduled_list() {
        let mut history = data();
        history.archives = serde_json::from_value(json!([
            { "date": "2026-11-03", "todos": [{ "id": "x", "title": "old", "completed": true, "createdAt": 0 }], "dailyNote": "那天", "savedAt": 0, "savedToDisk": false },
            { "date": "2026-11-01", "todos": [], "dailyNote": " ", "savedAt": 0, "savedToDisk": false }
        ]))
        .expect("archives");
        let ask = |method: &str, params: Value| run(method, &params, &history, "", 0).map(|outcome| (outcome.result, outcome.next));

        let (today, next) = ask("todos.list", json!({ "date": "2026-11-05" })).expect("today");
        assert_eq!((today["todos"].as_array().map(Vec::len), next), (Some(2), None));
        let (past, _) = ask("todos.list", json!({ "date": "2026-11-03" })).expect("past");
        assert_eq!((past["todos"][0]["id"].clone(), past["archived"].clone()), (json!("x"), json!(true)));
        let (later, _) = ask("todos.list", json!({ "date": "2026-11-20" })).expect("later");
        assert_eq!((later["todos"].clone(), later["scheduled"][0]["id"].clone()), (json!([]), json!("s")));
        assert_eq!(ask("todos.list", json!({ "date": "2026-11-02" })).expect_err("none").0, 404);
        assert_eq!(ask("todos.list", json!({ "date": "11/03" })).expect_err("bad").0, 400);

        assert_eq!(ask("note.get", json!({ "date": "2026-11-03" })).expect("note").0["note"], json!("那天"));
        assert_eq!(ask("note.get", json!({})).expect("today").0, json!({ "date": "2026-11-05", "note": "" }));
        assert_eq!(ask("note.get", json!({ "date": "2026-11-20" })).expect_err("later").0, 400);

        let (days, _) = ask("todos.days", json!({ "from": "2026-11-01", "to": "2026-11-30" })).expect("days");
        assert_eq!(
            days["days"],
            json!([
                { "date": "2026-11-01", "total": 0, "completed": 0, "hasNote": false, "archived": true },
                { "date": "2026-11-03", "total": 1, "completed": 1, "hasNote": true, "archived": true },
                { "date": "2026-11-05", "total": 2, "completed": 0, "hasNote": false, "archived": false }
            ])
        );
        let (narrow, _) = ask("todos.days", json!({ "from": "2026-11-02", "to": "2026-11-04" })).expect("narrow");
        assert_eq!(narrow["days"].as_array().map(Vec::len), Some(1));
        assert_eq!(ask("todos.days", json!({ "from": "2026-11-09", "to": "2026-11-01" })).expect_err("order").0, 400);
        assert_eq!(ask("todos.days", json!({ "from": "2026-11-01" })).expect_err("missing").0, 400);
    }

    #[test]
    fn notes_are_replaced_or_appended_line_by_line() {
        let note = |params: Value| call("note.set", params).map(|(result, next)| (result["note"].clone(), next.expect("next").daily_note));
        assert_eq!(note(json!({ "note": "a\nb" })).expect("set").1, "a\nb");
        assert_eq!(note(json!({ "append": "line" })).expect("append").1, "line");
        for bad in [json!({}), json!({ "note": "a", "append": "b" }), json!({ "note": 1 })] {
            assert_eq!(call("note.set", bad).expect_err("bad").0, 400);
        }
        let mut with_note = data();
        with_note.daily_note = "first".into();
        let next = run("note.set", &json!({ "append": "second" }), &with_note, "", 0).expect("append").next.expect("next");
        assert_eq!(next.daily_note, "first\nsecond");
        let next = run("note.set", &json!({ "append": "" }), &with_note, "", 0).expect("empty").next.expect("next");
        assert_eq!(next.daily_note, "first");
    }

    #[test]
    fn the_reason_says_what_happened_to_the_todos() {
        let old = data();
        let changed = |change: fn(&mut TodosData)| {
            let mut new = data();
            change(&mut new);
            todos_reason(&old, &new)
        };
        assert_eq!(changed(|_| {}), None);
        assert_eq!(changed(|d| d.daily_note = "x".into()), None);
        assert_eq!(changed(|d| d.date = "2026-11-06".into()), Some("dayChanged"));
        assert_eq!(
            changed(|d| {
                let mut todo = d.todos[0].clone();
                todo.id = "c".into();
                d.todos.push(todo);
            }),
            Some("add")
        );
        assert_eq!(changed(|d| { d.todos.remove(0); }), Some("remove"));
        assert_eq!(changed(|d| d.todos.swap(0, 1)), Some("reorder"));
        assert_eq!(changed(|d| d.todos[0].completed = true), Some("update"));
        assert_eq!(changed(|d| d.active_todo_id = None), Some("update"));
        assert_eq!(changed(|d| d.scheduled.clear()), Some("remove"));
    }

    #[test]
    fn island_saves_keep_fields_a_plugin_changed_after_the_window_saw_them() {
        let outside = OutsideChanges { todos: 7, scheduled: 0, daily_note: 3, active_todo_id: 0 };
        let change = |base: Option<u64>| TodosChange {
            base_revision: base,
            todos: Some(vec![]),
            daily_note: Some("n".into()),
            date: Some("2026-11-06".into()),
            ..Default::default()
        };
        let (kept, conflicts) = without_conflicts(&change(Some(5)), &outside);
        assert_eq!(conflicts, vec!["todos"]);
        assert!(kept.todos.is_none() && kept.daily_note.is_some() && kept.date.is_some());
        let (kept, conflicts) = without_conflicts(&change(Some(2)), &outside);
        assert_eq!(conflicts, vec!["todos", "dailyNote"]);
        assert!(kept.daily_note.is_none());
        let (kept, conflicts) = without_conflicts(&change(Some(7)), &outside);
        assert!(conflicts.is_empty() && kept.todos.is_some());
        assert!(without_conflicts(&change(None), &outside).1.is_empty());
        let mut later = super::super::model::TodosData { daily_note: "x".into(), ..data() };
        later.todos.clear();
        assert_eq!(changed_fields(&data(), &later), vec!["todos", "dailyNote"]);
    }

    #[test]
    fn new_ids_look_like_crypto_random_uuid() {
        let id = new_todo_id().expect("id");
        assert_eq!(id.len(), 36);
        assert_eq!(&id[14..15], "4");
        assert!("89ab".contains(&id[19..20]));
        assert_ne!(id, new_todo_id().expect("id"));
    }
}

#[test]
fn a_todos_project_survives_a_save_and_none_adds_no_key() {
    let mut value = serde_json::to_value(sample()).expect("encode");
    value["todos"][0]["project"] = json!("论文");
    value["scheduled"][0]["project"] = json!("组会");
    let file: TodosFile = serde_json::from_value(value).expect("decode");
    assert_eq!(file.data.todos[0].project.as_deref(), Some("论文"));
    assert_eq!(file.data.scheduled[0].project.as_deref(), Some("组会"));
    let text = serde_json::to_string(&file).expect("encode");
    assert_eq!(text.matches("\"project\"").count(), 2, "{text}");
    assert!(!serde_json::to_string(&sample()).expect("encode").contains("project"));
}

#[test]
fn a_todos_priority_and_color_survive_a_save() {
    let mut value = serde_json::to_value(sample()).expect("encode");
    value["todos"][0]["priority"] = json!("high");
    value["todos"][0]["color"] = json!("blue");
    value["scheduled"][0]["priority"] = json!("low");
    let file: TodosFile = serde_json::from_value(value).expect("decode");
    assert_eq!(file.data.todos[0].priority.as_deref(), Some("high"));
    assert_eq!(file.data.todos[0].color.as_deref(), Some("blue"));
    assert_eq!(file.data.scheduled[0].priority.as_deref(), Some("low"));
    let text = serde_json::to_string(&file).expect("encode");
    assert_eq!(text.matches("\"priority\"").count(), 2, "{text}");
    assert_eq!(text.matches("\"color\"").count(), 1, "{text}");
    let plain = serde_json::to_string(&sample()).expect("encode");
    assert!(!plain.contains("priority") && !plain.contains("color"));
}

#[test]
fn legacy_todos_json_without_subtasks_note_or_focus_loads_and_omits_empty_fields() {
    let legacy = sample();
    assert!(legacy.data.todos[0].subtasks.is_empty());
    assert_eq!(legacy.data.todos[0].note, None);
    assert_eq!(legacy.data.todos[0].focus_minutes, None);
    let plain = serde_json::to_string(&legacy).expect("encode");
    assert!(!plain.contains("\"subtasks\":") && !plain.contains("\"note\":") && !plain.contains("\"focusMinutes\":"));
}

#[test]
fn subtasks_notes_and_focus_minutes_round_trip_and_validate_bounds() {
    let dir = temp_dir("subtasks");
    let path = dir.join("todos.json");
    let mut value = serde_json::to_value(sample()).expect("encode");
    value["todos"][0]["subtasks"] = json!([
        { "id": "s1", "title": "查资料", "completed": true },
        { "id": "s2", "title": "写初稿", "completed": false }
    ]);
    value["todos"][0]["note"] = json!("周五下班前发审阅");
    value["todos"][0]["focusMinutes"] = json!(50);
    let file: TodosFile = serde_json::from_value(value).expect("decode");
    save(&path, &file).expect("save");
    let loaded = load(&path).expect("load").expect("present");
    assert_eq!(loaded.data.todos[0].subtasks.len(), 2);
    assert!(loaded.data.todos[0].subtasks[0].completed);
    assert_eq!(loaded.data.todos[0].subtasks[1].title, "写初稿");
    assert_eq!(loaded.data.todos[0].note.as_deref(), Some("周五下班前发审阅"));
    assert_eq!(loaded.data.todos[0].focus_minutes, Some(50));

    let mut empty_sub_id = loaded.data.clone();
    empty_sub_id.todos[0].subtasks[0].id.clear();
    assert!(validate(&empty_sub_id).is_err());

    let mut blank_sub_title = loaded.data.clone();
    blank_sub_title.todos[0].subtasks[0].title = "   ".into();
    assert!(validate(&blank_sub_title).is_err());

    let mut too_many = loaded.data.clone();
    too_many.todos[0].subtasks = (0..51)
        .map(|index| super::model::TodoSubtask {
            id: format!("s-{index}"),
            title: format!("step {index}"),
            completed: false,
        })
        .collect();
    assert!(validate(&too_many).is_err());

    let mut long_note = loaded.data.clone();
    long_note.todos[0].note = Some("备".repeat(1001));
    assert!(validate(&long_note).is_err());

    let mut max_note = loaded.data.clone();
    max_note.todos[0].note = Some("备".repeat(1000));
    assert!(validate(&max_note).is_ok());

    let _ = fs::remove_dir_all(dir);
}

mod stamp_tests {
    use serde_json::json;
    use std::fs;

    use super::super::model::{TodosData, TodosFile, FILE_VERSION};
    use super::super::stamps::{fill_missing, restamp, upgrade};
    use super::super::store::{load, save};
    use super::temp_dir;
    use crate::sync::{Clock, Hlc};

    const WALL: u64 = 1_800_000_000_000;

    fn v1_text() -> String {
        json!({
            "version": 1, "revision": 4, "date": "2026-11-05",
            "todos": [
                { "id": "a", "title": "first", "completed": false, "createdAt": 1_762_300_000_000u64 },
                { "id": "b", "title": "second", "completed": false, "createdAt": 1_762_300_000_500u64 }
            ],
            "scheduled": [{ "id": "s", "title": "later", "date": "2026-11-20", "createdAt": 5 }],
            "archives": [{ "date": "2026-11-04", "todos": [{ "id": "old", "title": "done", "completed": true, "createdAt": 3 }], "dailyNote": "n", "savedAt": 1.5, "savedToDisk": false }],
            "dailyNote": "today", "activeTodoId": "a"
        })
        .to_string()
    }

    fn stamp(ms: u64, device: &str) -> Hlc {
        Hlc::from_millis(ms, device)
    }

    fn upgraded() -> TodosData {
        let mut file: TodosFile = serde_json::from_str(&v1_text()).expect("v1");
        upgrade(&mut file, "dev1");
        assert_eq!(file.version, FILE_VERSION);
        file.data
    }

    fn bare(mut data: TodosData) -> TodosData {
        for todo in &mut data.todos {
            todo.updated_at = None;
            todo.device_id = None;
        }
        for todo in &mut data.scheduled {
            todo.updated_at = None;
            todo.device_id = None;
        }
        for archive in &mut data.archives {
            archive.updated_at = None;
            archive.todos.iter_mut().for_each(|todo| (todo.updated_at, todo.device_id) = (None, None));
        }
        data.tombstones.clear();
        data
    }

    #[test]
    fn version_one_files_get_stamps_from_when_each_entry_was_made() {
        let data = upgraded();
        assert_eq!(data.todos[0].updated_at, Some(stamp(1_762_300_000_000, "dev1")));
        assert_eq!(data.todos[0].device_id.as_deref(), Some("dev1"));
        assert_eq!(data.scheduled[0].updated_at, Some(stamp(5, "dev1")));
        assert_eq!(data.archives[0].updated_at, Some(stamp(1, "dev1")));
        assert_eq!(data.archives[0].todos[0].updated_at, Some(stamp(3, "dev1")));
        assert_eq!(data.daily_note_updated_at, None);
        let text = serde_json::to_string(&data).expect("encode");
        assert!(text.contains("\"updatedAt\":\"001762300000000-000000-dev1\""), "{text}");
        assert!(!text.contains("tombstones"));
    }

    #[test]
    fn a_version_one_file_changed_once_keeps_every_other_stamp() {
        let dir = temp_dir("stamps-v1");
        let path = dir.join("todos.json");
        fs::write(&path, v1_text()).expect("write v1");
        let mut file = load(&path).expect("load").expect("present");
        upgrade(&mut file, "dev1");
        let before = file.data.clone();
        let mut clock = Clock::new("dev1");
        let mut change = bare(before.clone());
        change.todos[1].title = "second, edited".into();
        let after = restamp(&before, change, &mut clock, WALL);
        assert_eq!(after.todos[0], before.todos[0]);
        assert_eq!(after.scheduled, before.scheduled);
        assert_eq!(after.archives, before.archives);
        assert_eq!(after.daily_note_updated_at, None);
        assert_eq!(after.todos[1].updated_at, Some(stamp(WALL, "dev1")));
        file.data = after.clone();
        save(&path, &file).expect("save");
        let read_back = load(&path).expect("load").expect("present");
        assert_eq!(read_back.version, 2);
        assert_eq!(read_back.data, after);
    }

    #[test]
    fn nothing_changes_when_only_the_window_state_moves_or_the_same_data_comes_back() {
        let before = upgraded();
        let mut clock = Clock::new("dev1");
        assert_eq!(restamp(&before, bare(before.clone()), &mut clock, WALL), before);
        assert_eq!(restamp(&before, before.clone(), &mut clock, WALL), before);
        let mut moved = bare(before.clone());
        moved.active_todo_id = Some("b".into());
        let after = restamp(&before, moved, &mut clock, WALL);
        assert_eq!(after.todos, before.todos);
        assert_eq!(after.active_todo_id.as_deref(), Some("b"));
        assert_eq!(clock.tick(WALL), stamp(WALL, "dev1"));
    }

    #[test]
    fn stamps_sent_back_by_the_window_are_not_trusted() {
        let before = upgraded();
        let mut clock = Clock::new("dev1");
        let mut forged = before.clone();
        forged.todos[0].updated_at = Some(stamp(1, "other"));
        assert_eq!(restamp(&before, forged, &mut clock, WALL), before);
        let mut edited = before.clone();
        edited.todos[0].completed = true;
        edited.todos[0].updated_at = Some(stamp(9_999_999_999_999, "other"));
        assert_eq!(restamp(&before, edited, &mut clock, WALL).todos[0].updated_at, Some(stamp(WALL, "dev1")));
    }

    #[test]
    fn deleted_todos_leave_tombstones_that_lift_if_they_come_back() {
        let before = upgraded();
        let mut clock = Clock::new("dev1");
        let mut change = bare(before.clone());
        change.todos.remove(0);
        let after = restamp(&before, change, &mut clock, WALL);
        assert_eq!(after.tombstones.len(), 1);
        assert_eq!(after.tombstones[0].id, "a");
        assert_eq!(after.tombstones[0].device_id, "dev1");
        let back = restamp(&after, bare(before.clone()), &mut clock, WALL);
        assert!(back.tombstones.is_empty());
        assert!(back.todos[0].updated_at > before.todos[0].updated_at);
    }

    #[test]
    fn moving_a_todo_between_lists_or_into_an_archive_is_not_a_deletion() {
        let before = upgraded();
        let mut clock = Clock::new("dev1");
        let mut change = bare(before.clone());
        let todo = change.todos.remove(0);
        change.archives[0].todos.push(todo);
        let after = restamp(&before, change, &mut clock, WALL);
        assert!(after.tombstones.is_empty());
        assert_eq!(after.archives[0].todos[1].updated_at, Some(stamp(WALL, "dev1")));
        assert!(after.archives[0].updated_at > before.archives[0].updated_at);
        assert_eq!(after.archives[0].todos[0], before.archives[0].todos[0]);
    }

    #[test]
    fn the_daily_note_gets_a_stamp_only_when_its_text_changes() {
        let before = upgraded();
        let mut clock = Clock::new("dev1");
        let mut change = bare(before.clone());
        change.daily_note = "today, more".into();
        let after = restamp(&before, change, &mut clock, WALL);
        assert_eq!(after.daily_note_updated_at, Some(stamp(WALL, "dev1")));
        assert_eq!(after.todos, before.todos);
        let same = restamp(&after, bare(after.clone()), &mut clock, WALL + 5);
        assert_eq!(same.daily_note_updated_at, after.daily_note_updated_at);
    }

    #[test]
    fn old_tombstones_are_dropped_on_the_next_real_change() {
        let mut before = upgraded();
        crate::sync::record::bury(&mut before.tombstones, "gone", stamp(WALL - crate::sync::record::TOMBSTONE_KEEP_MS - 1, "dev1"));
        let mut clock = Clock::new("dev1");
        assert_eq!(restamp(&before, bare(before.clone()), &mut clock, WALL).tombstones.len(), 1);
        let mut change = bare(before.clone());
        change.daily_note = "edit".into();
        assert!(restamp(&before, change, &mut clock, WALL).tombstones.is_empty());
    }

    #[test]
    fn bad_stamps_from_the_window_are_ignored_instead_of_refusing_the_save() {
        let text = json!({ "id": "a", "title": "t", "completed": false, "createdAt": 1, "updatedAt": "nonsense", "deviceId": "x" });
        let todo: super::super::model::TodoItem = serde_json::from_value(text).expect("decode");
        assert_eq!(todo.updated_at, None);
        let mut data = upgraded();
        data.todos[0].updated_at = None;
        fill_missing(&mut data, "dev2");
        assert_eq!(data.todos[0].updated_at, Some(stamp(1_762_300_000_000, "dev2")));
    }
}

mod host_tests {
    use super::super::host::error_code;

    #[test]
    fn host_errors_use_the_service_codes() {
        assert_eq!(error_code(400), "bad-params");
        assert_eq!(error_code(404), "not-found");
        assert_eq!(error_code(503), "inactive");
        assert_eq!(error_code(500), "failed");
    }
}
