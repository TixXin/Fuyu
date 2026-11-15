use super::*;
use crate::agent_status::{codebuddy, qoder, qwen, AGENT_RUNNING_SCRIPT_FILE_NAME, AGENT_STATUS_SCRIPT_FILE_NAME};

fn temp_home(name: &str) -> PathBuf {
    let home = std::env::temp_dir().join(format!("fuyu-compat-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&home);
    fs::create_dir_all(&home).unwrap();
    home
}

fn lines(records: &[Value]) -> String {
    records.iter().map(Value::to_string).collect::<Vec<_>>().join("\n")
}

const QWEN_USER: &str = r#"{"uuid":"u1","parentUuid":null,"sessionId":"q1","timestamp":"2026-11-15T05:00:00.000Z","type":"user","cwd":"/work/app","version":"0.27.4","message":{"role":"user","parts":[{"text":"修一下登录页的样式"}]}}"#;
const QWEN_TITLE: &str = r#"{"uuid":"t1","parentUuid":"u1","sessionId":"q1","timestamp":"2026-11-15T05:00:01.000Z","type":"system","subtype":"custom_title","cwd":"/work/app","version":"0.27.4","systemPayload":{"customTitle":"登录页样式","titleSource":"auto"}}"#;
const QWEN_CALL: &str = r#"{"uuid":"a1","parentUuid":"t1","sessionId":"q1","timestamp":"2026-11-15T05:00:02.000Z","type":"assistant","cwd":"/work/app","version":"0.27.4","model":"qwen3-coder-plus","message":{"role":"model","parts":[{"text":"先看看文件。"},{"functionCall":{"name":"run_shell_command","args":{"command":"ls src"}}}]},"usageMetadata":{"promptTokenCount":1200}}"#;
const QWEN_RESULT: &str = r#"{"uuid":"r1","parentUuid":"a1","sessionId":"q1","timestamp":"2026-11-15T05:00:03.000Z","type":"tool_result","cwd":"/work/app","version":"0.27.4","message":{"role":"user","parts":[{"functionResponse":{"name":"run_shell_command","response":{"output":"a"}}}]}}"#;
const QWEN_DONE: &str = r#"{"uuid":"a2","parentUuid":"r1","sessionId":"q1","timestamp":"2026-11-15T05:00:04.000Z","type":"assistant","cwd":"/work/app","version":"0.27.4","model":"qwen3-coder-plus","message":{"role":"model","parts":[{"text":"thinking","thought":true},{"text":"改好了。"}]}}"#;

#[test]
fn reads_a_qwen_session() {
    let tail = [QWEN_USER, QWEN_TITLE, QWEN_CALL, QWEN_RESULT, QWEN_DONE].join("\n");
    let parsed = parse_tail(Records::Qwen, &tail);
    assert_eq!(parsed.session_id.as_deref(), Some("q1"));
    assert_eq!(parsed.cwd.as_deref(), Some("/work/app"));
    assert_eq!(parsed.title.as_deref(), Some("登录页样式"));
    assert_eq!(parsed.custom_title, None);
    assert_eq!(parsed.model.as_deref(), Some("qwen3-coder-plus"));
    assert_eq!(parsed.last_prompt.as_deref(), Some("修一下登录页的样式"));
    assert!(parsed.turn_started_at.is_some());
    assert_eq!(parsed.last_message.as_deref(), Some("改好了。"));
    assert_eq!(parsed.state, TurnState::Done);
    assert_eq!(parsed.context_tokens, Some(1200));

    let running = parse_tail(Records::Qwen, &[QWEN_USER, QWEN_CALL].join("\n"));
    assert_eq!(running.state, TurnState::Working);
    let tool = running.current_tool.unwrap();
    assert_eq!((tool.name.as_str(), tool.detail.as_deref()), ("run_shell_command", Some("ls src")));
    assert_eq!(parse_tail(Records::Qwen, &[QWEN_CALL, QWEN_RESULT].join("\n")).state, TurnState::Working);

    let renamed = QWEN_TITLE.replace("\"auto\"", "\"manual\"");
    let parsed = parse_tail(Records::Qwen, &[QWEN_USER, &renamed].join("\n"));
    assert_eq!((parsed.title, parsed.custom_title.as_deref()), (None, Some("登录页样式")));
}

#[test]
fn unwraps_codebuddy_envelopes() {
    let wrapped = json!({ "type": "item", "uuid": "x", "timestamp": "2026-11-15T05:00:00Z", "sessionId": "c1", "payload": { "type": "message", "role": "user", "content": [] } });
    let record = unwrap_envelope(wrapped);
    assert_eq!(record["type"], "message");
    assert_eq!(record["sessionId"], "c1");
    assert!(record["timestamp"].as_i64().is_some());
    let bare = json!({ "type": "message", "role": "user" });
    assert_eq!(unwrap_envelope(bare.clone()), bare);
}

fn codebuddy_records() -> Vec<Value> {
    let wrap = |payload: Value| json!({ "type": "item", "uuid": "x", "timestamp": "2026-11-15T05:00:00Z", "payload": payload });
    vec![
        wrap(json!({ "type": "message", "role": "user", "sessionId": "c1", "cwd": "/work/api", "content": [{ "type": "input_text", "text": "<system-reminder>ctx</system-reminder>" }, { "type": "input_text", "text": "给接口加个缓存" }] })),
        json!({ "type": "ai-title", "aiTitle": "接口缓存", "sessionId": "c1" }),
        wrap(json!({ "type": "function_call", "name": "Bash", "callId": "b0", "arguments": "{\"command\":\"npm test\"}", "sessionId": "c1", "providerData": { "requestModelName": "hunyuan-t1" } })),
        wrap(json!({ "type": "message", "role": "assistant", "status": "completed", "sessionId": "c1", "content": [{ "type": "output_text", "text": "加好了。" }], "providerData": { "requestModelName": "hunyuan-t1" } })),
    ]
}

#[test]
fn reads_a_codebuddy_session() {
    let records = codebuddy_records();
    let parsed = parse_tail(Records::CodeBuddy, &lines(&records));
    assert_eq!(parsed.session_id.as_deref(), Some("c1"));
    assert_eq!(parsed.title.as_deref(), Some("接口缓存"));
    assert_eq!(parsed.model.as_deref(), Some("hunyuan-t1"));
    assert_eq!(parsed.last_prompt.as_deref(), Some("给接口加个缓存"));
    assert_eq!(parsed.last_message.as_deref(), Some("加好了。"));
    assert_eq!(parsed.state, TurnState::Done);

    let running = parse_tail(Records::CodeBuddy, &lines(&records[..3]));
    assert_eq!(running.state, TurnState::Working);
    assert_eq!(running.current_tool.map(|tool| tool.name), Some("Bash".to_string()));

    let renamed = json!({ "type": "custom-title", "customTitle": "我的缓存", "sessionId": "c1" });
    let parsed = parse_tail(Records::CodeBuddy, &lines(&[records[0].clone(), renamed]));
    assert_eq!(parsed.custom_title.as_deref(), Some("我的缓存"));
}

#[test]
fn lists_sessions_from_every_layout() {
    let home = temp_home("layouts");
    let app = home.join("app");
    fs::create_dir_all(&app).unwrap();

    let qoder_project = home.join(".qoder-cn").join("projects").join("-work-site");
    fs::create_dir_all(&qoder_project).unwrap();
    let claude_user = json!({ "type": "user", "sessionId": "d1", "cwd": "/work/site", "timestamp": "2026-11-15T05:00:00Z", "message": { "role": "user", "content": "把首页改成深色" } });
    let claude_reply = json!({ "type": "assistant", "sessionId": "d1", "cwd": "/work/site", "message": { "role": "assistant", "model": "qwen3-coder", "content": [{ "type": "text", "text": "改好了" }], "stop_reason": "end_turn" } });
    fs::write(qoder_project.join("d1.jsonl"), lines(&[claude_user, claude_reply])).unwrap();
    fs::write(qoder_project.join("d1-session.json"), r#"{"title":"首页深色","working_dir":"/work/site"}"#).unwrap();
    fs::write(qoder_project.join("agent-x1.jsonl"), "{}").unwrap();

    let qwen_chats = home.join(".qwen").join("projects").join("work-app").join("chats");
    fs::create_dir_all(&qwen_chats).unwrap();
    fs::write(qwen_chats.join("q1.jsonl"), [QWEN_USER, QWEN_TITLE, QWEN_DONE].join("\n")).unwrap();

    let codebuddy_project = home.join(".codebuddy").join("projects").join("work-api");
    fs::create_dir_all(&codebuddy_project).unwrap();
    fs::write(codebuddy_project.join("c1.jsonl"), lines(&codebuddy_records())).unwrap();

    assert_eq!(session_files(&qoder::SPEC, &home).len(), 1);
    let roots = ScanRoots { home_dir: &home, local_app_dir: Some(&app) };
    let now = crate::agent_status::snapshot::current_unix_millis();
    let window = 60 * 60 * 1000;

    let listed = sessions(&qoder::SPEC, &roots, now, window);
    assert_eq!(listed.len(), 1);
    let session = &listed[0];
    assert_eq!((session.provider, session.session_id.as_str()), ("qoder", "d1"));
    assert_eq!(session.title.as_deref(), Some("首页深色"));
    assert_eq!(session.cwd.as_deref(), Some("/work/site"));
    assert_eq!(session.last_prompt.as_deref(), Some("把首页改成深色"));
    assert_eq!(session.phase, "completed");

    let listed = sessions(&qwen::SPEC, &roots, now, window);
    assert_eq!(listed.iter().map(|session| (session.provider, session.title.as_deref())).collect::<Vec<_>>(), [("qwen", Some("登录页样式"))]);
    let listed = sessions(&codebuddy::SPEC, &roots, now, window);
    assert_eq!(listed.iter().map(|session| (session.session_id.as_str(), session.title.as_deref())).collect::<Vec<_>>(), [("c1", Some("接口缓存"))]);
    assert_eq!(listed[0].cwd.as_deref(), Some("/work/api"));

    let mirror = ScanRoots { home_dir: &home, local_app_dir: None };
    assert!(sessions(&qwen::SPEC, &mirror, now, window).is_empty());
    fs::remove_dir_all(&home).unwrap();
}

fn env_for(home: &Path) -> (PathBuf, PathBuf) {
    (
        home.join(".fuyu").join(AGENT_RUNNING_SCRIPT_FILE_NAME),
        home.join(".fuyu").join(AGENT_STATUS_SCRIPT_FILE_NAME),
    )
}

#[test]
fn installs_hooks_into_every_present_home() {
    let home = temp_home("hooks");
    let (running, status) = env_for(&home);
    let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
    assert_eq!(hooks_state(&qoder::SPEC, &env), HookInstallState::Absent);
    install_hooks(&qoder::SPEC, &env).unwrap();
    assert!(!home.join(".qoder").exists());

    fs::create_dir_all(home.join(".qoder")).unwrap();
    fs::create_dir_all(home.join(".qoder-cn")).unwrap();
    fs::write(home.join(".qoder").join("settings.json"), r#"{"model":"auto","hooks":{"Stop":[{"hooks":[{"type":"command","command":"mine"}]}]}}"#).unwrap();
    assert_eq!(hooks_state(&qoder::SPEC, &env), HookInstallState::NotInstalled);
    install_hooks(&qoder::SPEC, &env).unwrap();
    install_hooks(&qoder::SPEC, &env).unwrap();
    assert_eq!(hooks_state(&qoder::SPEC, &env), HookInstallState::Current);

    let config = read_settings(&home.join(".qoder").join("settings.json")).unwrap();
    assert_eq!(config["model"], "auto");
    assert_eq!(config["hooks"]["Stop"][0]["hooks"][0]["command"], "mine");
    let command = |entry: &Value| entry["hooks"][0]["command"].as_str().unwrap().to_string();
    let permission = config["hooks"]["PermissionRequest"].as_array().unwrap();
    assert_eq!(permission.len(), 2);
    assert!(command(&permission[0]).contains("qoder notification"));
    assert!(command(&permission[1]).contains("qoder permission"));
    assert_eq!(permission[1]["hooks"][0]["timeout"], APPROVAL_HOOK_TIMEOUT_SECONDS);
    assert!(command(&config["hooks"]["StopFailure"][0]).contains("qoder failed"));
    assert!(read_settings(&home.join(".qoder-cn").join("settings.json")).unwrap()["hooks"]["UserPromptSubmit"].is_array());

    let mut stale = config.clone();
    stale["hooks"]["StopFailure"] = json!([]);
    fs::write(home.join(".qoder").join("settings.json"), stale.to_string()).unwrap();
    assert_eq!(hooks_state(&qoder::SPEC, &env), HookInstallState::Outdated);
    fs::remove_dir_all(&home).unwrap();
}

#[test]
fn codebuddy_waits_on_the_permission_prompt_notification() {
    let home = temp_home("codebuddy");
    let (running, status) = env_for(&home);
    let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
    fs::create_dir_all(home.join(".codebuddy")).unwrap();
    install_hooks(&codebuddy::SPEC, &env).unwrap();
    let config = read_settings(&home.join(".codebuddy").join("settings.json")).unwrap();
    let notification = &config["hooks"]["Notification"][0];
    assert_eq!(notification["matcher"], "permission_prompt");
    assert!(notification["hooks"][0]["command"].as_str().unwrap().contains("codebuddy notification"));
    let permission = config["hooks"]["PermissionRequest"].as_array().unwrap();
    assert_eq!(permission.len(), 1);
    assert!(permission[0]["hooks"][0]["command"].as_str().unwrap().contains("codebuddy permission"));
    fs::remove_dir_all(&home).unwrap();
}

#[test]
fn prompt_files_follow_each_home() {
    let home = Path::new("/h");
    assert_eq!(
        prompt_files(&qoder::SPEC, home),
        [home.join(".qoder").join("AGENTS.md"), home.join(".qoder-cn").join("AGENTS.md")]
    );
    assert_eq!(prompt_files(&qwen::SPEC, home), [home.join(".qwen").join("QWEN.md")]);
    assert_eq!(prompt_files(&codebuddy::SPEC, home), [home.join(".codebuddy").join("CODEBUDDY.md")]);
}

const OTHER: Compat = Compat {
    provider: "other",
    label: "Other",
    homes: &[Home { dir: ".other", env: "FUYU_TEST_OTHER_HOME" }],
    chats: None,
    records: Records::Claude,
    prompt_file: "AGENTS.md",
    waiting: Waiting::PermissionPrompt,
    hooks_file: "hooks/fuyu-island.json",
    reply: Reply::PreToolUse("Bash"),
    aliases: &[("sessionId", "session_id"), ("conversation_id", "session_id")],
};

#[test]
fn renames_declared_stdin_fields_without_overwriting() {
    let mut camel = json!({ "sessionId": "s1", "toolName": "Bash" });
    alias_input(&OTHER, &mut camel);
    assert_eq!(camel["session_id"], "s1");
    let mut both = json!({ "session_id": "kept", "conversation_id": "c1" });
    alias_input(&OTHER, &mut both);
    assert_eq!(both["session_id"], "kept");
}

#[test]
fn claims_payloads_by_their_keys_or_transcript() {
    let home = std::env::temp_dir().join("fuyu-compat-claims");
    let mine = json!({ "session_id": "s", "transcript_path": home.join(".other/sessions/s/updates.jsonl").to_string_lossy() });
    let claude = json!({ "session_id": "s", "transcript_path": home.join(".claude/projects/p/s.jsonl").to_string_lossy() });
    assert!(claims(&OTHER, &mine, Some(&home)));
    assert!(!claims(&OTHER, &claude, Some(&home)));
    assert!(claims(&OTHER, &json!({ "sessionId": "s", "session_id": "s" }), None));
    assert!(!claims(&OTHER, &json!({ "session_id": "s" }), None));
    let claude_body = claude.to_string();
    assert_eq!(claimed_elsewhere(claude_body.as_bytes(), Some(&home)), None);
}

#[test]
fn hooks_follow_the_declared_file_and_reply() {
    let home = temp_home("declared");
    let running = home.join(".fuyu").join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status = home.join(".fuyu").join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
    let entries = hook_entries(&OTHER, &env);
    assert!(entries.iter().all(|(event, _)| *event != "PermissionRequest"));
    let approval = entries.iter().find(|(event, entry)| *event == "PreToolUse" && entry["matcher"] == "Bash").unwrap();
    assert!(approval.1["hooks"][0]["command"].as_str().unwrap().contains("other permission"));
    let none = Compat { reply: Reply::None, ..OTHER };
    assert!(hook_entries(&none, &env).iter().all(|(_, entry)| !entry["hooks"][0]["command"].as_str().unwrap_or_default().contains("permission")));

    fs::create_dir_all(home.join(".other")).unwrap();
    assert_eq!(hooks_state(&OTHER, &env), HookInstallState::NotInstalled);
    install_hooks(&OTHER, &env).unwrap();
    assert_eq!(hooks_state(&OTHER, &env), HookInstallState::Current);
    assert!(home.join(".other/hooks/fuyu-island.json").is_file());
    assert!(!home.join(".other/settings.json").exists());
    fs::remove_dir_all(&home).unwrap();
}
