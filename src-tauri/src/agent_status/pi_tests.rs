use super::*;
use crate::agent_status::sessions::TurnState;

const HEADER: &str = r#"{"type":"session","version":3,"id":"01a1e859-1111-2222-3333-444455556666","timestamp":"2026-11-17T07:11:58.928Z","cwd":"C:\\Users\\ivan\\AppData\\Roaming\\PiDeck\\chat-workspace"}"#;
const MODEL: &str = r#"{"type":"model_change","id":"mc1","parentId":null,"timestamp":"2026-11-17T07:11:59.000Z","provider":"anthropic","modelId":"claude-sonnet-4-5"}"#;
const EFFORT: &str = r#"{"type":"thinking_level_change","id":"tl1","parentId":"mc1","timestamp":"2026-11-17T07:11:59.100Z","thinkingLevel":"high"}"#;
const INFO: &str = r#"{"type":"session_info","id":"si1","parentId":"tl1","timestamp":"2026-11-17T07:11:59.200Z","name":"重命名标题"}"#;
const PROMPT: &str = r#"{"type":"message","id":"m1","parentId":"si1","timestamp":"2026-11-17T07:12:00.000Z","message":{"role":"user","content":[{"type":"text","text":"修复登录超时"}]}}"#;
const CALL: &str = r#"{"type":"message","id":"m2","parentId":"m1","timestamp":"2026-11-17T07:12:01.000Z","message":{"role":"assistant","content":[{"type":"text","text":"先读一下文件。"},{"type":"toolCall","id":"call_1","name":"edit","arguments":{"path":"src/auth/login.ts"}}]},"stopReason":"toolUse","usage":{"input":1200,"output":80,"cacheRead":300,"cacheWrite":20,"totalTokens":1600}}"#;
const RESULT: &str = r#"{"type":"message","id":"m3","parentId":"m2","timestamp":"2026-11-17T07:12:02.000Z","message":{"role":"toolResult","toolCallId":"call_1","toolName":"edit","content":[{"type":"text","text":"Updated"}],"isError":false}}"#;
const REPLY: &str = r#"{"type":"message","id":"m4","parentId":"m3","timestamp":"2026-11-17T07:12:03.000Z","message":{"role":"assistant","content":[{"type":"text","text":"登录超时已修复。\n✓"}]},"stopReason":"stop","usage":{"input":1500,"output":40,"totalTokens":1540}}"#;

fn lines(records: &[&str]) -> String {
    records.join("\n")
}

#[test]
fn reads_a_finished_pi_turn_with_model_effort_and_tokens() {
    let parsed = parse_pi_tail(&lines(&[HEADER, MODEL, EFFORT, INFO, PROMPT, CALL, RESULT, REPLY]));
    assert_eq!(parsed.state, TurnState::Done);
    assert_eq!(parsed.custom_title.as_deref(), Some("重命名标题"));
    assert_eq!(parsed.model.as_deref(), Some("Sonnet 4.5"));
    assert_eq!(parsed.effort.as_deref(), Some("high"));
    assert_eq!(parsed.context_tokens, Some(1540));
    assert_eq!(parsed.last_prompt.as_deref(), Some("修复登录超时"));
    assert!(parsed.turn_started_at.is_some());
    assert_eq!(parsed.last_message.as_deref(), Some("登录超时已修复。"));
    assert_eq!(parsed.reply_marker, Some("done"));
}

#[test]
fn reads_a_running_pi_turn_and_tool_call() {
    let parsed = parse_pi_tail(&lines(&[HEADER, MODEL, PROMPT, CALL])).settle();
    assert_eq!(parsed.state, TurnState::Working);
    let tool = parsed.current_tool.expect("tool");
    assert_eq!(tool.name, "edit");
    assert_eq!(tool.detail.as_deref(), Some("login.ts"));

    let after_result = parse_pi_tail(&lines(&[HEADER, MODEL, PROMPT, CALL, RESULT])).settle();
    assert_eq!(after_result.state, TurnState::Working);
    assert_eq!(after_result.last_prompt.as_deref(), Some("修复登录超时"));
}

fn temp_home(name: &str) -> PathBuf {
    let home = std::env::temp_dir().join(format!("fuyu-pi-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&home);
    fs::create_dir_all(&home).unwrap();
    home
}

#[test]
fn lists_pi_sessions_from_encoded_workspace_folders() {
    let home = temp_home("sessions");
    let workspace = home.join(".pi/agent/sessions/c-users-ivan-chat-workspace");
    fs::create_dir_all(&workspace).unwrap();
    fs::write(
        workspace.join("2026-11-17T07-11-58_01a1e859-1111-2222-3333-444455556666.jsonl"),
        lines(&[HEADER, MODEL, EFFORT, PROMPT, CALL]),
    )
    .unwrap();
    fs::write(
        workspace.join("2026-11-17T07-15-00_01a1e859-9999.jsonl"),
        lines(&[HEADER]),
    )
    .unwrap();

    let now = crate::agent_status::snapshot::current_unix_millis();
    let listed = sessions_in_dir(PROVIDER, &home.join(".pi/agent/sessions"), None, now, 60_000);
    assert_eq!(listed.len(), 1);
    let s = &listed[0];
    assert_eq!(s.provider, "pi");
    assert_eq!(s.session_id, "01a1e859-1111-2222-3333-444455556666");
    assert_eq!(s.cwd.as_deref(), Some(r"C:\Users\ivan\AppData\Roaming\PiDeck\chat-workspace"));
    assert_eq!((s.title.as_deref(), s.title_source), (Some("修复登录超时"), Some("prompt")));
    assert_eq!(s.model.as_deref(), Some("Sonnet 4.5"));
    assert_eq!(s.effort.as_deref(), Some("high"));
    assert_eq!(s.phase, "running");
    assert_eq!(s.context_tokens, Some(1600));
    let _ = fs::remove_dir_all(&home);
}

#[test]
fn installs_the_pi_extension_only_when_pi_is_present() {
    let home = temp_home("ext");
    let fuyu = home.join("FuyuData");
    let running = fuyu.join(crate::agent_status::AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status = fuyu.join(crate::agent_status::AGENT_STATUS_SCRIPT_FILE_NAME);
    let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
    let no_vars = |_: &str| None;

    install_with(&env, &no_vars).unwrap();
    assert_eq!(state_with(&env, &no_vars), HookInstallState::Absent);
    assert!(!home.join(".pi").exists());

    fs::create_dir_all(home.join(".pi/agent")).unwrap();
    assert_eq!(state_with(&env, &no_vars), HookInstallState::NotInstalled);
    install_with(&env, &no_vars).unwrap();
    let ext = home.join(".pi/agent/extensions").join(EXTENSION_FILE_NAME);
    let text = fs::read_to_string(&ext).unwrap();
    assert!(!text.contains("__FUYU_DIR__"));
    assert!(text.contains("\"/pi/permission\""));
    assert!(text.contains("export default function fuyuIslandExtension(pi)"));
    assert_eq!(state_with(&env, &no_vars), HookInstallState::Current);

    fs::write(&ext, "export default function () {}").unwrap();
    assert_eq!(state_with(&env, &no_vars), HookInstallState::Outdated);
    let _ = fs::remove_dir_all(&home);
}
