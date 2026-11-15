use super::*;
use serde_json::json;

const ID: &str = "session-7f3c2a10-5b8e-4d21-9c6f-0a1b2c3d4e5f";

fn fixture() -> Value {
    json!({"version": 7, "record": {
        "identity": {"formatVersion": 4, "cwd": "D:\\work\\demo"},
        "rows": {
            "title": {"ver": 1, "val": "Fix the login page"},
            "sessionListMetadata": {"ver": 1, "val": {"blank": false, "lastPromptAt": 1000}},
            "turnBoundary": {"ver": 2, "val": {"openTurnStartSeq": 5}},
            "turnOutline": {"ver": 2, "val": {"turns": [{"prompt": "why does it fail", "response": "Looking at it."}]}},
            "modelSelection": {"ver": 2, "val": {"lastUsed": {"model": "deepseek-v4", "reasoningEffort": "high"}}},
            "userQuestions": {"ver": 2, "val": {"questions": {"active": []}}},
            "contextPressure": {"ver": 5, "val": {"surfaceTokens": 4200}}
        }
    }})
}

fn state(value: &Value) -> Option<TurnState> {
    parse_checkpoint(value, ID, 1100).map(|(_, state)| state)
}

#[test]
fn reads_a_known_checkpoint() {
    let (summary, state) = parse_checkpoint(&fixture(), ID, 1100).unwrap();
    assert_eq!(state, TurnState::Working);
    assert_eq!(summary.provider, PROVIDER);
    assert_eq!(summary.title.as_deref(), Some("Fix the login page"));
    assert_eq!(summary.cwd.as_deref(), Some(r"D:\work\demo"));
    assert_eq!(summary.model.as_deref(), Some("deepseek-v4"));
    assert_eq!(summary.effort.as_deref(), Some("high"));
    assert_eq!(summary.last_prompt.as_deref(), Some("why does it fail"));
    assert_eq!(summary.last_message.as_deref(), Some("Looking at it."));
    assert_eq!(summary.turn_started_at, Some(1000));
    assert_eq!(summary.context_tokens, Some(4200));
}

#[test]
fn open_questions_wait_closed_turns_finish_and_unknown_versions_are_skipped() {
    let mut value = fixture();
    value["record"]["rows"]["userQuestions"]["val"]["questions"]["active"] = json!([{"state": "open"}]);
    assert_eq!(state(&value), Some(TurnState::AwaitingUser));
    value["record"]["rows"]["userQuestions"]["val"]["questions"]["active"][0]["state"] = json!("continued");
    assert_eq!(state(&value), Some(TurnState::Working));
    value["record"]["rows"]["turnBoundary"]["val"]["openTurnStartSeq"] = Value::Null;
    assert_eq!(state(&value), Some(TurnState::Done));
    value["record"]["rows"]["sessionListMetadata"]["val"]["blank"] = json!(true);
    assert_eq!(state(&value), None);
    let mut value = fixture();
    value["version"] = json!(99);
    assert_eq!(state(&value), None);
    let mut value = fixture();
    value["record"]["rows"]["turnBoundary"]["ver"] = json!(3);
    assert_eq!(state(&value), None);
}

fn temp_home(name: &str) -> PathBuf {
    let home = std::env::temp_dir().join(format!("fuyu-dsh-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&home);
    fs::create_dir_all(&home).unwrap();
    home
}

fn write(root: &Path, id: &str, title: &str, log: bool) {
    let dir = root.join("storages/session_projcache/sessions");
    fs::create_dir_all(&dir).unwrap();
    let mut value = fixture();
    value["record"]["rows"]["title"]["val"] = json!(title);
    fs::write(dir.join(format!("{id}.json")), value.to_string()).unwrap();
    if log {
        let session = root.join("sessions/--D-work-demo--").join(id);
        fs::create_dir_all(&session).unwrap();
        fs::write(session.join(LOGS[1]), b"").unwrap();
    }
}

fn now() -> i64 {
    system_time_to_unix_millis(SystemTime::now()).unwrap()
}

fn no_env(_: &str) -> Option<OsString> {
    None
}

#[test]
fn lists_logged_sessions_once_from_the_newest_store() {
    let home = temp_home("stores");
    let shared = home.join(".dsh");
    let isolated = home.join("AppData/Roaming/dsh-desktop/harness");
    write(&shared, ID, "old", true);
    std::thread::sleep(std::time::Duration::from_millis(20));
    write(&isolated, ID, "new", true);
    write(&shared, "session-deleted", "gone", false);
    let listed = sessions_in(roots(&home, no_env), now(), 60_000, true);
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].title.as_deref(), Some("new"));
    assert_eq!(listed[0].phase, "running");
    fs::remove_dir_all(&home).unwrap();
}

#[test]
fn reads_homes_named_by_the_environment_like_dsh_does() {
    let home = temp_home("env");
    let custom = home.join("data").join("dsh");
    let env = |value: &'static str| {
        move |name: &str| (name == "DSH_HOME").then(|| OsString::from(value))
    };
    let expected = home.join("data").join("dsh");
    let absolute = custom.to_string_lossy().into_owned();
    assert_eq!(roots(&home, |name: &str| (name == "DSH_HOME").then(|| OsString::from(&absolute)))[0], expected);
    assert_eq!(roots(&home, env("~/data/dsh"))[0], expected);
    assert_eq!(roots(&home, env("~"))[0], home);
    assert_eq!(roots(&home, env("  "))[0], home.join(".dsh"));
    assert_eq!(roots(&home, env("relative/dsh"))[0], home.join(".dsh"));
    let next = home.join("next-data");
    let next_text = next.to_string_lossy().into_owned();
    let both = roots(&home, |name: &str| match name {
        "DSH_HOME" => Some(OsString::from(&absolute)),
        "DSH_DESKTOP_NEXT_HOME" => Some(OsString::from(&next_text)),
        _ => None,
    });
    assert_eq!(&both[..2], &[expected, next]);
    write(&custom, ID, "moved", true);
    let listed = sessions_in(roots(&home, |name: &str| (name == "DSH_HOME").then(|| OsString::from(&absolute))), now(), 60_000, true);
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].title.as_deref(), Some("moved"));
    fs::remove_dir_all(&home).unwrap();
}

#[test]
fn follows_data_directories_chosen_inside_third_party_clients() {
    let home = temp_home("chosen");
    let app_data = app_data(&home);
    let next = home.join("next");
    let beta = home.join("beta");
    let stable = home.join("stable");
    let pointer = |dir: &str, file: &str, value: Value| {
        let dir = dir.split('/').fold(app_data.clone(), |path, part| path.join(part));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(file), value.to_string()).unwrap();
    };
    pointer("DSH NEXT/home", "desktop-next-location.json", json!({"home": next}));
    pointer("DSH NEXT/home", "desktop-next-last-home.json", json!({"home": next}));
    pointer("DSH Desktop Beta/home", "desktop-next-last-home.json", json!({"home": beta}));
    pointer("DSH Desktop/data-directory", "state.json", json!({"version": 1, "activeHome": stable}));
    let found = roots(&home, no_env);
    assert!(found.contains(&app_data.join("dshed").join("dsh")));
    assert_eq!(found.iter().filter(|root| **root == next).count(), 1);
    assert!(found.contains(&beta) && found.contains(&stable));
    pointer("DSH Desktop Beta/home", "desktop-next-location.json", json!({"home": "relative"}));
    pointer("DSH Desktop/data-directory", "state.json", json!("broken"));
    let found = roots(&home, no_env);
    assert!(!found.contains(&stable) && !found.iter().any(|root| root.ends_with("relative")));
    write(&next, ID, "from next", true);
    let listed = sessions_in(roots(&home, no_env), now(), 60_000, true);
    assert_eq!(listed[0].title.as_deref(), Some("from next"));
    fs::remove_dir_all(&home).unwrap();
}

#[test]
fn a_mirrored_home_reads_the_pulled_checkpoints_without_logs_or_local_folders() {
    let mirror = temp_home("mirror");
    write(&mirror.join(".dsh-home"), ID, "remote", false);
    write(&mirror.join(".dsh"), "session-other", "plain", false);
    let roots = ScanRoots { home_dir: &mirror, local_app_dir: None };
    let mut listed = read_sessions(&roots, now(), 60_000);
    listed.sort_by(|a, b| a.title.cmp(&b.title));
    assert_eq!(listed.len(), 2);
    assert_eq!(listed[0].title.as_deref(), Some("plain"));
    assert_eq!(listed[1].title.as_deref(), Some("remote"));
    assert_eq!(listed[1].phase, "running");
    fs::remove_dir_all(&mirror).unwrap();
}

#[test]
fn the_remote_lines_pull_checkpoints_into_the_mirrored_homes() {
    let remote = HARNESS.remote.as_ref().unwrap();
    let lines = remote.find.join("\n");
    assert!(lines.contains("dshc .dsh .dsh\n") && lines.contains("dshc \"$DSH_HOME\" .dsh-home"));
    for home in MIRRORED_HOMES {
        assert!(remote.checkpoint_dirs.contains(&format!("{home}/storages/session_projcache/sessions/").as_str()));
    }
}
