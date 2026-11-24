use super::*;

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
    let legacy = r#"{"mine":{"enabled":true},"fuyu":{"enabled":true,"PreToolUse":[{"matcher":"run_command","hooks":[{"type":"command","command":"curl"}]}]}}"#;
    let cleaned: Value = serde_json::from_str(&with_remote_hooks(legacy).unwrap()).unwrap();
    assert!(cleaned[HOOK_NAME].get("PreToolUse").is_none());
    assert!(with_remote_hooks("").is_ok());
    assert!(with_remote_hooks("[1]").is_err() && with_remote_hooks("{x").is_err());
}

#[test]
fn the_pulled_files_and_the_mirror_reader_agree() {
    assert_eq!(
        REMOTE_FILES.checkpoint_dirs,
        [format!("{SAVED_DIR}/").as_str(), format!("{CLI_DIR}/annotations/").as_str()]
    );
    assert!(REMOTE_FILES.find[0].contains(&format!("find {SAVED_DIR} ")));
    assert!(REMOTE_FILES.find[0].contains(&format!("{CLI_DIR}/annotations/$c.pbtxt")));
    assert!(crate::agent_status::harness::is_mirrored_file(".gemini/antigravity-cli/annotations/a2706318.pbtxt"));
}

#[cfg(unix)]
#[test]
fn the_saved_input_turns_into_a_remote_session() {
    use crate::agent_status::snapshot::system_time_to_unix_millis;
    use std::{fs, process::Command, time::SystemTime};
    let home = std::env::temp_dir().join(format!("fuyu-antigravity-remote-save-{}", std::process::id()));
    let _ = fs::remove_dir_all(&home);
    fs::create_dir_all(home.join(CLI_DIR).join("annotations")).unwrap();
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
    fs::write(home.join(CLI_DIR).join("annotations").join("a2706318.pbtxt"), "title:\"Remote CLI Task\"").unwrap();
    let input = r#"{"conversationId": "a2706318", "cwd": "/srv/demo", "lastUserInput": "继续", "modelName": "gemini"}"#;
    run("running", input);
    let saved = home.join(SAVED_DIR);
    assert!(saved.join("running-a2706318.json").is_file());
    let roots = ScanRoots { home_dir: &home, local_app_dir: None };
    let now = system_time_to_unix_millis(SystemTime::now()).unwrap();
    let listed = read_sessions(&roots, now, 60_000);
    assert_eq!(listed.len(), 1);
    assert_eq!(
        (listed[0].session_id.as_str(), listed[0].phase, listed[0].title.as_deref(), listed[0].last_prompt.as_deref()),
        ("a2706318", "running", Some("Remote CLI Task"), Some("继续"))
    );
    run("stop", input);
    run("stop", r#"{"conversationId": "../x"}"#);
    let names: Vec<_> = fs::read_dir(&saved).unwrap().flatten().map(|entry| entry.file_name()).collect();
    assert_eq!(names, ["stop-a2706318.json"]);
    assert_eq!(read_sessions(&roots, now, 60_000)[0].phase, "completed");
    fs::remove_dir_all(&home).unwrap();
}
