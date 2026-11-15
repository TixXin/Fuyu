use super::*;

#[test]
fn the_remote_group_goes_in_once_beside_the_users_own() {
    let users = r#"{"mine":{"enabled":true,"Stop":[{"type":"command","command":"x"}]}}"#;
    let once = with_remote_hooks(users, None).unwrap();
    assert_eq!(with_remote_hooks(&once, None).unwrap(), once);
    let config: Value = serde_json::from_str(&once).unwrap();
    assert_eq!(config["mine"]["Stop"][0]["command"], "x");
    let group = &config[HOOK_NAME];
    assert_eq!(group["enabled"], true);
    assert!(group["SessionStart"][0]["command"].as_str().unwrap().contains("running-$c.json"));
    assert!(group["Stop"][0]["command"].as_str().unwrap().contains("stop-$c.json"));
    assert!(group.get("PreToolUse").is_none());
    assert!(with_remote_hooks("", None).is_ok());
    assert!(with_remote_hooks("[1]", None).is_err() && with_remote_hooks("{x", None).is_err());
}

#[test]
fn run_command_goes_to_the_island_through_the_forwarded_port_and_comes_out_without_it() {
    let approval = RemoteApproval {
        host: "zcm6".into(),
        path: "claude/permission-request".into(),
        question_path: "claude/ask-user-question".into(),
        activity_path: "claude/activity".into(),
        antigravity_path: "antigravity/pre-tool-use".into(),
    };
    let with = with_remote_hooks("{}", Some(&approval)).unwrap();
    assert_eq!(with_remote_hooks(&with, Some(&approval)).unwrap(), with);
    let config: Value = serde_json::from_str(&with).unwrap();
    let pre = &config[HOOK_NAME]["PreToolUse"][0];
    assert_eq!(pre["matcher"], "run_command");
    assert_eq!(pre["hooks"][0]["timeout"], APPROVAL_HOOK_TIMEOUT_SECONDS);
    let curl = pre["hooks"][0]["command"].as_str().unwrap();
    assert!(curl.starts_with("read N P H K 2>/dev/null < \"$HOME/.fuyu/approval-port\" && "));
    assert!(curl.contains("-f -m 145 ") && curl.contains("-H 'X-Fuyu-Remote: zcm6'"));
    assert!(curl.ends_with("--data-binary @- \"http://127.0.0.1:$N/antigravity/pre-tool-use\" || exit 0"));
    let without: Value = serde_json::from_str(&with_remote_hooks(&with, None).unwrap()).unwrap();
    assert!(without[HOOK_NAME].get("PreToolUse").is_none());
}

#[cfg(unix)]
#[test]
fn an_unreachable_island_leaves_run_command_to_antigravity() {
    let approval = RemoteApproval {
        host: "zcm6".into(),
        path: String::new(),
        question_path: String::new(),
        activity_path: String::new(),
        antigravity_path: "antigravity/pre-tool-use".into(),
    };
    let home = std::env::temp_dir().join(format!("fuyu-antigravity-remote-approval-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&home);
    std::fs::create_dir_all(&home).unwrap();
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(format!("echo '{{}}' | {{ {}; }}", approval_command(&approval)))
        .env("HOME", &home)
        .output()
        .unwrap();
    assert!(output.status.success());
    assert!(output.stdout.is_empty());
    let _ = std::fs::remove_dir_all(&home);
}

#[test]
fn the_pulled_files_and_the_mirror_reader_agree() {
    assert_eq!(REMOTE_FILES.checkpoint_dirs, [format!("{SAVED_DIR}/").as_str()]);
    assert!(REMOTE_FILES.find[0].starts_with(&format!("find {SAVED_DIR} ")));
}

#[cfg(unix)]
#[test]
fn the_saved_input_turns_into_a_remote_session() {
    use crate::agent_status::snapshot::system_time_to_unix_millis;
    use std::{fs, process::Command, time::SystemTime};
    let home = std::env::temp_dir().join(format!("fuyu-antigravity-remote-save-{}", std::process::id()));
    let _ = fs::remove_dir_all(&home);
    fs::create_dir_all(&home).unwrap();
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
