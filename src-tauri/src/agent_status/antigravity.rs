use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use serde_json::{json, Value};

use super::claude_hooks::APPROVAL_HOOK_TIMEOUT_SECONDS;
use super::codex_hooks::{agent_running_command_with, agent_status_command};
use super::harness::{Harness, HookEnv, Hooks, StatusLight};
use super::hooks_state::HookInstallState;
use super::markers::AGENT_RUNNING_STALE_AFTER_MS;
use super::reply_text::reply_ending;
use super::session_scan::{pick_title, read_tail};
use super::sessions::{session_phase, AgentSessionSummary, TurnState};
use super::snapshot::system_time_to_unix_millis;
use super::title::{folder_title, prompt_title};
use super::tool_call::{antigravity_tool_call, ToolCall};
use super::{write_text_file, AGENT_APPROVAL_SCRIPT_FILE_NAME};

pub(super) const PROVIDER: &str = "antigravity";
pub(super) const APP: &str = "antigravity";
const SAVED_DIR: &str = "agent-antigravity";
const DATA_DIRS: [&str; 3] = ["antigravity", "antigravity-ide", "antigravity-cli"];
const HOOK_NAME: &str = "fuyu";
pub(super) const APPROVED_TOOLS: &str = "run_command";
const MAX_AGE_MS: i64 = 24 * 60 * 60 * 1000;
const EFFORTS: [&str; 6] = ["minimal", "low", "medium", "high", "xhigh", "max"];

pub(super) const HARNESS: Harness = Harness {
    id: PROVIDER,
    hooks: Some(Hooks {
        install: install_hooks,
        check: hooks_state,
    }),
    status_light: Some(StatusLight {
        running_marker: "agent-antigravity-running.flag",
        running_hold: "agent-antigravity-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: Some(super::antigravity_remote::read_sessions),
    remote: Some(super::antigravity_remote::REMOTE_FILES),
};

struct Saved {
    at: i64,
    running: bool,
    input: Value,
    path: PathBuf,
}

pub(super) fn sessions(app_dir: &Path, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    let mut newest: HashMap<String, Saved> = HashMap::new();
    let discard = |path: &Path| {
        if super::may_change_hook_files() {
            let _ = fs::remove_file(path);
        }
    };
    for entry in fs::read_dir(app_dir.join(SAVED_DIR)).into_iter().flatten().flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let running = match name.split_once('-') {
            Some(("running", rest)) if rest.ends_with(".json") => true,
            Some(("stop", rest)) if rest.ends_with(".json") => false,
            _ => continue,
        };
        let Some(at) = entry.metadata().ok().and_then(|meta| meta.modified().ok()).and_then(system_time_to_unix_millis) else {
            continue;
        };
        if now - at > MAX_AGE_MS {
            discard(&path);
            continue;
        }
        let Some(input) = fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}').trim()).ok())
        else {
            continue;
        };
        let Some(id) = text(&input["conversationId"]) else {
            continue;
        };
        match newest.get(&id) {
            Some(known) if known.at > at => discard(&path),
            _ => {
                if let Some(older) = newest.insert(id, Saved { at, running, input, path }) {
                    discard(&older.path);
                }
            }
        }
    }
    newest
        .into_iter()
        .filter(|(_, saved)| now - saved.at <= window_ms)
        .map(|(id, saved)| summary(id, &saved, now))
        .collect()
}

fn summary(session_id: String, saved: &Saved, now: i64) -> AgentSessionSummary {
    let input = &saved.input;
    let cwd = text(&input["cwd"]).or_else(|| {
        input["workspacePaths"]
            .as_array()
            .and_then(|paths| paths.iter().find_map(text))
            .map(|path| path.strip_prefix("file:///").map(str::to_string).unwrap_or(path))
    });
    let prompt = input["lastUserInput"].as_str().and_then(prompt_title);
    let (title, title_source) = pick_title(None, None, prompt.clone(), cwd.as_deref().and_then(folder_title));
    let state = if saved.running { TurnState::Working } else { TurnState::Done };
    let transcript = transcript(input);
    let reply = transcript.as_deref().and_then(last_reply).map(|reply| reply_ending(&reply)).unwrap_or_default();
    let (model, effort) = text(&input["modelName"]).map(|name| model_and_effort(&name)).unzip();
    AgentSessionSummary {
        provider: PROVIDER,
        session_id,
        cwd,
        title,
        title_source,
        model,
        effort: effort.flatten(),
        phase: session_phase(state, now - saved.at, AGENT_RUNNING_STALE_AFTER_MS),
        last_message: reply.message,
        reply_marker: reply.marker,
        reply_asks: reply.asks,
        updated_at: saved.at,
        host: None,
        turn_started_at: None,
        last_prompt: prompt,
        current_tool: transcript.as_deref().filter(|_| saved.running).and_then(running_tool),
        permission_mode: None,
        subagents: 0,
        background_tasks: 0,
        compacting: false,
        todos: None,
        closed: false,
        remote_host: None,
        parent_id: None,
        context_tokens: transcript.as_deref().and_then(context_tokens),
    }
}

fn transcript(input: &Value) -> Option<String> {
    text(&input["transcriptPath"]).and_then(|path| read_tail(Path::new(&path)))
}

fn model_and_effort(name: &str) -> (String, Option<String>) {
    let effort = |level: &str| EFFORTS.contains(&level.to_ascii_lowercase().as_str()).then(|| level.to_ascii_lowercase());
    if let Some((model, level)) = name.strip_suffix(')').and_then(|rest| rest.rsplit_once(" (")) {
        if let Some(level) = effort(level) {
            return (model.trim().to_string(), Some(level));
        }
    }
    match name.rsplit_once('-') {
        Some((model, level)) if !name.contains(' ') => match effort(level) {
            Some(level) => (model.to_string(), Some(level)),
            None => (name.to_string(), None),
        },
        _ => (name.to_string(), None),
    }
}

fn records(tail: &str) -> impl Iterator<Item = Value> + '_ {
    tail.lines().rev().filter_map(|line| serde_json::from_str::<Value>(line).ok())
}

fn running_tool(tail: &str) -> Option<ToolCall> {
    for record in records(tail) {
        match record["type"].as_str() {
            Some("USER_INPUT") => return None,
            Some("PLANNER_RESPONSE") => {
                if let Some(call) = record["tool_calls"].as_array().and_then(|calls| calls.last()) {
                    return antigravity_tool_call(call);
                }
            }
            _ => {}
        }
    }
    None
}

fn context_tokens(tail: &str) -> Option<u64> {
    let usage = records(tail).find(|record| record["type"] == "PLANNER_RESPONSE" && record["input_tokens"].is_u64())?;
    let total: u64 = ["input_tokens", "cache_read_tokens", "output_tokens"].iter().filter_map(|key| usage[*key].as_u64()).sum();
    (total > 0).then_some(total)
}

fn last_reply(tail: &str) -> Option<String> {
    for record in records(tail) {
        match record["type"].as_str() {
            Some("USER_INPUT") => return None,
            Some("PLANNER_RESPONSE") if record["content"].as_str().is_some_and(|content| !content.trim().is_empty()) => {
                return text(&record["content"]);
            }
            _ => {}
        }
    }
    None
}

fn text(value: &Value) -> Option<String> {
    value.as_str().filter(|text| !text.is_empty()).map(str::to_string)
}

fn hooks_path(home_dir: &Path) -> PathBuf {
    home_dir.join(".gemini").join("config").join("hooks.json")
}

pub(super) fn prompt_files(home_dir: &Path) -> Vec<PathBuf> {
    if lives_here(home_dir) {
        vec![home_dir.join(".gemini").join("GEMINI.md")]
    } else {
        Vec::new()
    }
}

fn lives_here(home_dir: &Path) -> bool {
    let gemini = home_dir.join(".gemini");
    DATA_DIRS.iter().any(|dir| gemini.join(dir).is_dir())
}

fn hook_group(env: &HookEnv) -> Value {
    let handler = |command: String, timeout: i64| json!({ "type": "command", "command": command, "timeout": timeout });
    let running = |phase: &str| handler(agent_running_command_with(env.running_script, PROVIDER, phase), 5);
    let approval_script = env.status_script.with_file_name(AGENT_APPROVAL_SCRIPT_FILE_NAME);
    json!({
        "enabled": true,
        "SessionStart": [running("start")],
        "PreInvocation": [running("running")],
        "PreToolUse": [{
            "matcher": APPROVED_TOOLS,
            "hooks": [handler(agent_status_command(&approval_script, PROVIDER, "permission"), APPROVAL_HOOK_TIMEOUT_SECONDS)],
        }],
        "Stop": [running("stop"), handler(agent_status_command(env.status_script, PROVIDER, "completed"), 10)],
    })
}

fn read_config(path: &Path) -> Option<Value> {
    fs::read_to_string(path).ok().and_then(|text| serde_json::from_str::<Value>(&text).ok())
}

fn hooks_state(env: &HookEnv) -> HookInstallState {
    if !lives_here(env.home_dir) {
        return HookInstallState::Absent;
    }
    match read_config(&hooks_path(env.home_dir)) {
        Some(config) if config[HOOK_NAME] == hook_group(env) => HookInstallState::Current,
        Some(config) if super::is_island_hook_text(&config.to_string()) => HookInstallState::Outdated,
        _ => HookInstallState::NotInstalled,
    }
}

pub(super) fn install_hooks(env: &HookEnv) -> Result<(), String> {
    if !lives_here(env.home_dir) {
        return Ok(());
    }
    let path = hooks_path(env.home_dir);
    let mut config = match fs::read_to_string(&path) {
        Ok(content) if !content.trim().is_empty() => serde_json::from_str::<Value>(&content)
            .map_err(|error| format!("Failed to parse Antigravity hooks.json: {error}"))?,
        _ => json!({}),
    };
    let root = config
        .as_object_mut()
        .ok_or_else(|| "Antigravity hooks.json must contain a JSON object.".to_string())?;
    root.insert(HOOK_NAME.to_string(), hook_group(env));
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|error| format!("Failed to create {}: {error}", dir.display()))?;
    }
    let content = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Failed to serialize Antigravity hooks.json: {error}"))?;
    write_text_file(&path, &content)
}

#[cfg(test)]
mod tests {
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
}
