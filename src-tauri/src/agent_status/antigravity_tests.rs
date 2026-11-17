use super::*;
use std::time::{Duration, SystemTime};

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-antigravity-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn save(app_dir: &Path, name: &str, input: &str, ago_ms: u64) {
    let dir = app_dir.join(SAVED_DIR);
    fs::create_dir_all(&dir).unwrap();
    let path = dir.join(name);
    fs::write(&path, input).unwrap();
    let file = fs::File::options().write(true).open(&path).unwrap();
    file.set_modified(SystemTime::now() - Duration::from_millis(ago_ms)).unwrap();
}

const CLI_STOP: &str = r#"{"conversationId":"a2706318","cwd":"C:\\work\\demo","workspacePaths":["C:/work/demo"],"hookEventName":"Stop","fullyIdle":true,"terminationReason":"NO_TOOL_CALL","lastUserInput":"Reply with the single word: pong","modelName":"gemini-3.8-flash-high"}"#;
const INPUT: &str = r#"{"conversationId":"c1","workspacePaths":["D:\\work\\demo"],"modelName":"Gemini 3.8 Flash","lastUserInput":"fix the login page"}"#;

#[test]
fn the_newest_hook_input_of_each_conversation_decides() {
    let app_dir = temp_dir("sessions");
    let now = system_time_to_unix_millis(SystemTime::now()).unwrap();
    save(&app_dir, "running-1.json", INPUT, 5_000);
    save(&app_dir, "stop-2.json", INPUT, 1_000);
    save(&app_dir, "running-3.json", &INPUT.replace("c1", "c2").replace(r"D:\\work", "file:///D:/work"), 1_000);
    save(&app_dir, "running-4.json", &INPUT.replace("c1", "c3"), 2 * 60 * 60 * 1000);
    save(&app_dir, "other-5.json", INPUT, 1_000);
    let mut listed = sessions(&app_dir, now, 60 * 60 * 1000);
    listed.sort_by(|a, b| a.session_id.cmp(&b.session_id));
    let phases: Vec<(&str, &str)> = listed.iter().map(|s| (s.session_id.as_str(), s.phase)).collect();
    assert_eq!(phases, [("c1", "completed"), ("c2", "running")]);
    let first = &listed[0];
    assert_eq!(first.provider, PROVIDER);
    assert_eq!(first.cwd.as_deref(), Some(r"D:\work\demo"));
    assert_eq!(first.title.as_deref(), Some("fix the login page"));
    assert_eq!(first.model.as_deref(), Some("Gemini 3.8 Flash"));
    assert_eq!(listed[1].cwd.as_deref(), Some(r"D:/work\demo"));
    assert!(!app_dir.join(SAVED_DIR).join("running-1.json").exists());
    save(&app_dir, "stop-6.json", CLI_STOP, 1_000);
    let cli = sessions(&app_dir, now, 60 * 60 * 1000).into_iter().find(|s| s.session_id == "a2706318").unwrap();
    assert_eq!((cli.phase, cli.cwd.as_deref()), ("completed", Some(r"C:\work\demo")));
    assert_eq!(cli.reply_marker, None);
    fs::remove_dir_all(&app_dir).unwrap();
}

#[test]
fn the_last_reply_comes_from_the_transcript() {
    let app_dir = temp_dir("transcript");
    let now = system_time_to_unix_millis(SystemTime::now()).unwrap();
    let transcript = app_dir.join("transcript_full.jsonl");
    let line = |kind: &str, content: &str| json!({ "type": kind, "status": "DONE", "content": content }).to_string();
    let lines = [
        line("USER_INPUT", "<USER_REQUEST>\nfix it\n</USER_REQUEST>"),
        line("PLANNER_RESPONSE", "Looking."),
        line("GENERIC", ""),
        line("PLANNER_RESPONSE", "Fixed the **login** page.\n\n✓"),
        line("PLANNER_RESPONSE", ""),
    ];
    fs::write(&transcript, lines.join("\n")).unwrap();
    let mut input: Value = serde_json::from_str(CLI_STOP).unwrap();
    input["transcriptPath"] = json!(transcript.to_string_lossy());
    save(&app_dir, "stop-1.json", &input.to_string(), 1_000);
    let listed = sessions(&app_dir, now, 60 * 60 * 1000);
    assert_eq!((listed[0].reply_marker, listed[0].last_message.as_deref()), (Some("done"), Some("Fixed the login page.")));
    assert_eq!(last_reply(&[lines[0].clone(), lines[1].clone(), line("USER_INPUT", "again")].join("\n")), None);
    fs::remove_dir_all(&app_dir).unwrap();
}

#[test]
fn keeps_the_conversation_title_when_later_turns_only_say_continue() {
    let root = temp_dir("titles");
    let app_dir = root.join("app");
    let ag_dir = root.join(".gemini").join("antigravity");
    fs::create_dir_all(ag_dir.join("annotations")).unwrap();
    let now = system_time_to_unix_millis(SystemTime::now()).unwrap();

    let hook = |id: &str, last_input: &str, transcript: &Path| {
        json!({
            "conversationId": id,
            "artifactDirectoryPath": ag_dir.join("brain").join(id).to_string_lossy(),
            "transcriptPath": transcript.to_string_lossy(),
            "cwd": "/work/fuyu",
            "lastUserInput": last_input,
            "modelName": "claude-sonnet-4-6",
        })
        .to_string()
    };
    let write_transcript = |id: &str, lines: &[Value]| -> PathBuf {
        let path = ag_dir.join("brain").join(id).join(".system_generated").join("logs").join("transcript_full.jsonl");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        let body: Vec<String> = lines.iter().map(Value::to_string).collect();
        fs::write(&path, body.join("\n")).unwrap();
        path
    };

    let t_named = write_transcript("named", &[json!({ "step_index": 0, "type": "USER_INPUT", "content": "<USER_REQUEST>\ninitial prompt\n</USER_REQUEST>" })]);
    fs::write(
        ag_dir.join("annotations").join("named.pbtxt"),
        "title:\"插件第三版设置页面重设计\"  last_user_view_time:{seconds:1794951360  nanos:398000000}",
    )
    .unwrap();
    save(&app_dir, "running-named.json", &hook("named", "继续", &t_named), 1_000);

    let t_octal = write_transcript("octal", &[json!({ "step_index": 0, "type": "USER_INPUT", "content": "hi" })]);
    fs::write(
        ag_dir.join("annotations").join("octal.pbtxt"),
        r#"title: "Fix \"login\" \345\217\221\347\211\210""#,
    )
    .unwrap();
    save(&app_dir, "running-octal.json", &hook("octal", "继续", &t_octal), 1_000);

    let t_fresh = write_transcript(
        "fresh",
        &[
            json!({ "step_index": 0, "type": "USER_INPUT", "content": "<USER_REQUEST>\n继续排查 issue #746\n</USER_REQUEST>\n<ADDITIONAL_METADATA>\ntime\n</ADDITIONAL_METADATA>" }),
            json!({ "step_index": 1, "type": "PLANNER_RESPONSE", "content": "working" }),
            json!({ "step_index": 2, "type": "USER_INPUT", "content": "<USER_REQUEST>\n继续\n</USER_REQUEST>" }),
        ],
    );
    save(&app_dir, "running-fresh.json", &hook("fresh", "继续", &t_fresh), 1_000);

    let t_archived = write_transcript("archived", &[json!({ "step_index": 0, "type": "USER_INPUT", "content": "old" })]);
    fs::write(
        ag_dir.join("annotations").join("archived.pbtxt"),
        "title:\"旧任务\" archived:true archival_status_timestamp:{seconds:1794933647 nanos:0}",
    )
    .unwrap();
    save(&app_dir, "stop-archived.json", &hook("archived", "继续", &t_archived), 1_000);

    let t_subagent = write_transcript(
        "subagent",
        &[json!({ "step_index": 0, "source": "SYSTEM", "type": "SYSTEM_MESSAGE", "content": "<SYSTEM_MESSAGE>\ndo D84.2\n</SYSTEM_MESSAGE>" })],
    );
    fs::write(ag_dir.join("annotations").join("subagent.pbtxt"), "last_user_view_time:{seconds:1}").unwrap();
    save(&app_dir, "stop-subagent.json", &hook("subagent", "", &t_subagent), 1_000);

    let mut listed = sessions(&app_dir, now, 60 * 60 * 1000);
    listed.sort_by(|a, b| a.session_id.cmp(&b.session_id));
    let got: Vec<_> = listed
        .iter()
        .map(|s| (s.session_id.as_str(), s.title.as_deref(), s.title_source, s.last_prompt.as_deref()))
        .collect();
    assert_eq!(
        got,
        [
            ("fresh", Some("继续排查 issue #746"), Some("prompt"), Some("继续")),
            ("named", Some("插件第三版设置页面重设计"), Some("agent"), Some("继续")),
            ("octal", Some("Fix \"login\" 发版"), Some("agent"), Some("继续")),
        ]
    );
    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn splits_the_thinking_level_off_the_model_and_reads_the_running_tool() {
    let split = |name: &str| model_and_effort(name);
    assert_eq!(split("gemini-3.8-flash-high"), ("gemini-3.8-flash".into(), Some("high".into())));
    assert_eq!(split("Gemini 3.8 Flash (Medium)"), ("Gemini 3.8 Flash".into(), Some("medium".into())));
    assert_eq!(split("Gemini 3.8 Flash"), ("Gemini 3.8 Flash".into(), None));
    assert_eq!(split("claude-opus-5-5"), ("claude-opus-5-5".into(), None));
    let call = |name: &str, args: Value| json!({ "type": "PLANNER_RESPONSE", "input_tokens": 3000, "cache_read_tokens": 15000,
        "output_tokens": 500, "tool_calls": [{ "name": name, "args": args }] }).to_string();
    let user = json!({ "type": "USER_INPUT", "content": "go" }).to_string();
    let generic = json!({ "type": "GENERIC", "status": "RUNNING" }).to_string();
    let tail = [user.clone(), call("view_file", json!({ "AbsolutePath": "/w/src/main.rs" })), call("run_command", json!({ "CommandLine": "cargo test" })), generic].join("\n");
    let tool = running_tool(&tail).unwrap();
    assert_eq!((tool.name.as_str(), tool.detail.as_deref()), ("run_command", Some("cargo test")));
    assert_eq!(context_tokens(&tail), Some(18_500));
    assert_eq!(running_tool(&[call("read_file", json!({ "Path": "a.rs" })), user].join("\n")), None);
    let read = running_tool(&call("read_file", json!({ "Path": "C:\\w\\a.rs" }))).unwrap();
    assert_eq!(read.detail.as_deref(), Some("a.rs"));
}

#[test]
fn installs_its_own_hook_group_only_where_antigravity_lives() {
    let home = temp_dir("hooks");
    let running = home.join(".fuyu").join(crate::agent_status::AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status = home.join(".fuyu").join(crate::agent_status::AGENT_STATUS_SCRIPT_FILE_NAME);
    let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
    install_hooks(&env).unwrap();
    assert!(!hooks_path(&home).exists());
    assert_eq!(hooks_state(&env), HookInstallState::Absent);

    fs::create_dir_all(home.join(".gemini").join("antigravity-cli")).unwrap();
    assert_eq!(hooks_state(&env), HookInstallState::NotInstalled);
    fs::create_dir_all(hooks_path(&home).parent().unwrap()).unwrap();
    fs::write(hooks_path(&home), r#"{"mine":{"enabled":true,"Stop":[{"type":"command","command":"x"}]}}"#).unwrap();
    install_hooks(&env).unwrap();
    install_hooks(&env).unwrap();
    assert_eq!(hooks_state(&env), HookInstallState::Current);
    let config: Value = serde_json::from_str(&fs::read_to_string(hooks_path(&home)).unwrap()).unwrap();
    assert_eq!(config["mine"]["Stop"][0]["command"], "x");
    let group = &config[HOOK_NAME];
    assert_eq!(group["enabled"], true);
    let command = |value: &Value| value["command"].as_str().unwrap().to_string();
    assert!(command(&group["SessionStart"][0]).contains("antigravity start"));
    assert!(command(&group["PreInvocation"][0]).contains("antigravity running"));
    assert!(command(&group["Stop"][0]).contains("antigravity stop"));
    assert!(command(&group["Stop"][1]).contains("fuyu-agent-status"));
    assert_eq!(group["PreToolUse"][0]["matcher"], APPROVED_TOOLS);
    let approval = &group["PreToolUse"][0]["hooks"][0];
    assert!(command(approval).contains("fuyu-agent-approval") && command(approval).contains("antigravity permission"));
    assert_eq!(approval["timeout"], APPROVAL_HOOK_TIMEOUT_SECONDS);

    let mut stale = config.clone();
    stale[HOOK_NAME]["PreToolUse"] = json!([]);
    fs::write(hooks_path(&home), stale.to_string()).unwrap();
    assert_eq!(hooks_state(&env), HookInstallState::Outdated);
    fs::remove_dir_all(&home).unwrap();
}
