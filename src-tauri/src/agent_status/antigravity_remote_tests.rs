use super::*;
use crate::agent_status::snapshot::system_time_to_unix_millis;
use std::{fs, path::PathBuf, process::Command, time::SystemTime};

fn temp_home(name: &str) -> PathBuf {
    let home = std::env::temp_dir().join(format!("fuyu-antigravity-remote-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&home);
    fs::create_dir_all(&home).unwrap();
    home
}

#[test]
fn the_remote_group_goes_in_once_beside_the_users_own() {
    let users = r#"{"mine":{"enabled":true,"Stop":[{"type":"command","command":"x"}]}}"#;
    let once = with_remote_hooks(users).unwrap();
    assert_eq!(with_remote_hooks(&once).unwrap(), once);
    let config: Value = serde_json::from_str(&once).unwrap();
    assert_eq!(config["mine"]["Stop"][0]["command"], "x");
    let group = &config[HOOK_NAME];
    assert_eq!(group["enabled"], true);
    assert!(group["SessionStart"][0]["command"].as_str().unwrap().contains("running-$c.json"));
    assert!(group["Stop"][0]["command"].as_str().unwrap().contains("stop-$c.json"));
    assert!(group.get("PreToolUse").is_none());
    assert!(with_remote_hooks("").is_ok());
    assert!(with_remote_hooks("[1]").is_err() && with_remote_hooks("{x").is_err());
}

#[test]
fn the_pulled_files_and_the_mirror_reader_agree() {
    assert_eq!(REMOTE_FILES.checkpoint_dirs, [format!("{SAVED_DIR}/").as_str()]);
    assert!(REMOTE_FILES.find[0].starts_with(&format!("find {SAVED_DIR} ")));
}

#[cfg(unix)]
#[test]
fn the_saved_input_turns_into_a_remote_session() {
    let home = temp_home("save");
    let run = |state: &str, input: &str| {
        let mut child = Command::new("sh")
            .arg("-c")
            .arg(save_command(state))
            .env("HOME", &home)
            .stdin(std::process::Stdio::piped())
            .spawn()
            .unwrap();
        use std::io::Write;
        child.stdin.take().unwrap().write_all(input.as_bytes()).unwrap();
        assert!(child.wait().unwrap().success());
    };
    let input = r#"{"conversationId": "a2706318", "cwd": "/srv/demo", "lastUserInput": "ping", "modelName": "gemini"}"#;
    run("running", input);
    let saved = home.join(SAVED_DIR);
    assert!(saved.join("running-a2706318.json").is_file());
    let roots = ScanRoots { home_dir: &home, local_app_dir: None };
    let now = system_time_to_unix_millis(SystemTime::now()).unwrap();
    let listed = read_sessions(&roots, now, 60_000);
    assert_eq!(listed.len(), 1);
    assert_eq!((listed[0].session_id.as_str(), listed[0].phase), ("a2706318", "running"));
    run("stop", input);
    run("stop", r#"{"conversationId": "../x"}"#);
    let names: Vec<_> = fs::read_dir(&saved).unwrap().flatten().map(|entry| entry.file_name()).collect();
    assert_eq!(names, ["stop-a2706318.json"]);
    assert_eq!(read_sessions(&roots, now, 60_000)[0].phase, "completed");
    fs::remove_dir_all(&home).unwrap();
}
