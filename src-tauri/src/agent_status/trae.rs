use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use serde_json::{json, Value};

use super::claude_hooks::{
    claude_code_match_all_hook_entry, command_hook_entry, install_claude_code_hook_events,
    uninstall_nested_json_hooks, APPROVAL_HOOK_TIMEOUT_SECONDS,
};
use super::codex_hooks::{agent_running_command_with, agent_status_command};
use super::harness::{Harness, HookEnv, Hooks, ScanRoots, StatusLight};
use super::hooks_state::{hook_entries_state, HookInstallState};
use super::markers::AGENT_RUNNING_STALE_AFTER_MS;
use super::reply_text::reply_ending;
use super::session_scan::pick_title;
use super::sessions::{session_phase, AgentSessionSummary, TurnState};
use super::snapshot::system_time_to_unix_millis;
use super::title::{folder_title, prompt_title, shorten};
use super::tool_call::ToolCall;
use super::{write_text_file, AGENT_APPROVAL_SCRIPT_FILE_NAME, AGENT_RUNNING_NOTIFICATION_ARG};

pub(super) const PROVIDER: &str = "trae";
pub(super) const CN_PROVIDER: &str = "traeCn";
pub(super) const APP: &str = "trae";
pub(super) const CN_APP: &str = "trae cn";
pub(super) const APPROVED_TOOLS: &str =
    "^(RunCommand|Bash|Write|Edit|MultiEdit|StrReplace|CreateFile|DeleteFile|WriteToFile|ReplaceInFile|mcp__.*)$";
const MAX_AGE_MS: i64 = 24 * 60 * 60 * 1000;
const DETAIL_MAX_CHARS: usize = 80;
const DETAIL_KEYS: [&str; 6] = ["command", "file_path", "path", "target_file", "query", "url"];

pub(super) struct Edition {
    pub(super) provider: &'static str,
    label: &'static str,
    dir: &'static str,
    saved_dir: &'static str,
}

pub(super) const TRAE: Edition = Edition { provider: PROVIDER, label: "TRAE", dir: ".trae", saved_dir: "agent-trae" };
pub(super) const TRAE_CN: Edition = Edition { provider: CN_PROVIDER, label: "TRAE CN", dir: ".trae-cn", saved_dir: "agent-traeCn" };

pub(super) const HARNESS: Harness = Harness {
    id: TRAE.provider,
    hooks: Some(Hooks {
        install: |env| install_hooks(&TRAE, env),
        check: |env| hooks_state(&TRAE, env),
        uninstall: |env| uninstall_hooks(&TRAE, env),
    }),
    status_light: Some(StatusLight {
        running_marker: "agent-trae-running.flag",
        running_hold: "agent-trae-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: Some(|roots, now, window_ms| sessions(&TRAE, roots, now, window_ms)),
    remote: None,
};

pub(super) const CN_HARNESS: Harness = Harness {
    id: TRAE_CN.provider,
    hooks: Some(Hooks {
        install: |env| install_hooks(&TRAE_CN, env),
        check: |env| hooks_state(&TRAE_CN, env),
        uninstall: |env| uninstall_hooks(&TRAE_CN, env),
    }),
    status_light: Some(StatusLight {
        running_marker: "agent-traeCn-running.flag",
        running_hold: "agent-traeCn-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: Some(|roots, now, window_ms| sessions(&TRAE_CN, roots, now, window_ms)),
    remote: None,
};

pub(super) fn prompt_files(_home_dir: &Path) -> Vec<PathBuf> {
    Vec::new()
}

fn lives_here(edition: &Edition, home_dir: &Path) -> bool {
    home_dir.join(edition.dir).is_dir()
}

fn hooks_path(edition: &Edition, home_dir: &Path) -> PathBuf {
    home_dir.join(edition.dir).join("hooks.json")
}

pub(super) fn hook_entries(edition: &Edition, env: &HookEnv) -> Vec<(&'static str, Value)> {
    let provider = edition.provider;
    let save = |phase: &str| {
        claude_code_match_all_hook_entry(command_hook_entry(agent_running_command_with(env.running_script, provider, phase), 5))
    };
    let approval_script = env.status_script.with_file_name(AGENT_APPROVAL_SCRIPT_FILE_NAME);
    let mut approval = command_hook_entry(agent_status_command(&approval_script, provider, "permission"), APPROVAL_HOOK_TIMEOUT_SECONDS);
    approval["matcher"] = json!(APPROVED_TOOLS);
    let completed = claude_code_match_all_hook_entry(command_hook_entry(agent_status_command(env.status_script, provider, "completed"), 10));
    vec![
        ("UserPromptSubmit", save("running")),
        ("PreToolUse", save("running")),
        ("PreToolUse", approval),
        ("PostToolUse", save("running")),
        ("Stop", save("stop")),
        ("Stop", completed),
        ("Notification", save(AGENT_RUNNING_NOTIFICATION_ARG)),
    ]
}

fn read_config(path: &Path) -> Option<Value> {
    serde_json::from_str(fs::read_to_string(path).ok()?.trim_start_matches('\u{feff}')).ok()
}

pub(super) fn hooks_state(edition: &Edition, env: &HookEnv) -> HookInstallState {
    if !lives_here(edition, env.home_dir) {
        return HookInstallState::Absent;
    }
    match read_config(&hooks_path(edition, env.home_dir)) {
        Some(config) => hook_entries_state(&config["hooks"], &hook_entries(edition, env)),
        None => HookInstallState::NotInstalled,
    }
}

pub(super) fn install_hooks(edition: &Edition, env: &HookEnv) -> Result<(), String> {
    if !lives_here(edition, env.home_dir) {
        return Ok(());
    }
    let label = edition.label;
    let path = hooks_path(edition, env.home_dir);
    let mut config = match fs::read_to_string(&path) {
        Ok(content) if !content.trim().is_empty() => serde_json::from_str::<Value>(content.trim_start_matches('\u{feff}'))
            .map_err(|error| format!("Failed to parse {label} hooks.json: {error}"))?,
        _ => json!({}),
    };
    let root = config
        .as_object_mut()
        .ok_or_else(|| format!("{label} hooks.json must contain a JSON object."))?;
    root.entry("version").or_insert(json!(1));
    let hooks = root.entry("hooks").or_insert_with(|| json!({}));
    if !hooks.is_object() {
        *hooks = json!({});
    }
    let hooks = hooks
        .as_object_mut()
        .ok_or_else(|| format!("Failed to prepare {label} hooks object."))?;
    install_claude_code_hook_events(hooks, hook_entries(edition, env));
    let content = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Failed to serialize {label} hooks.json: {error}"))?;
    write_text_file(&path, &content)
}

pub(super) fn uninstall_hooks(edition: &Edition, env: &HookEnv) -> Result<(), String> {
    uninstall_nested_json_hooks(&hooks_path(edition, env.home_dir), edition.label, "hooks.json")
}

struct Saved {
    at: i64,
    running: bool,
    input: Value,
    path: PathBuf,
}

pub(super) fn sessions(edition: &Edition, roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    let Some(app_dir) = roots.local_app_dir else {
        return Vec::new();
    };
    let may_delete = super::may_change_hook_files();
    let mut by_session: HashMap<String, Vec<Saved>> = HashMap::new();
    for entry in fs::read_dir(app_dir.join(edition.saved_dir)).into_iter().flatten().flatten() {
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
            if may_delete {
                let _ = fs::remove_file(&path);
            }
            continue;
        }
        let Some(input) = read_config(&path) else { continue };
        let Some(id) = text(&input["session_id"]) else { continue };
        by_session.entry(id).or_default().push(Saved { at, running, input, path });
    }
    by_session
        .into_iter()
        .filter_map(|(id, mut saved)| {
            saved.sort_by(|a, b| a.at.cmp(&b.at).then_with(|| a.path.cmp(&b.path)));
            if may_delete {
                prune(&saved);
            }
            let newest = saved.last()?;
            (now - newest.at <= window_ms).then(|| summary(edition, id, &saved, now))
        })
        .collect()
}

fn prompt_of(input: &Value) -> Option<String> {
    if input["hook_event_name"] != "UserPromptSubmit" {
        return None;
    }
    input["prompt"].as_str().and_then(prompt_title)
}

fn reply_index(saved: &[Saved]) -> Option<usize> {
    saved
        .iter()
        .enumerate()
        .rev()
        .take_while(|(_, item)| prompt_of(&item.input).is_none())
        .find(|(_, item)| text(&item.input["last_assistant_message"]).is_some())
        .map(|(index, _)| index)
}

fn kept(saved: &[Saved]) -> Vec<usize> {
    let prompts: Vec<usize> = (0..saved.len()).filter(|index| prompt_of(&saved[*index].input).is_some()).collect();
    [prompts.first().copied(), prompts.last().copied(), reply_index(saved), saved.len().checked_sub(1)]
        .into_iter()
        .flatten()
        .collect()
}

fn prune(saved: &[Saved]) {
    let keep = kept(saved);
    for (index, item) in saved.iter().enumerate() {
        if !keep.contains(&index) {
            let _ = fs::remove_file(&item.path);
        }
    }
}

fn summary(edition: &Edition, session_id: String, saved: &[Saved], now: i64) -> AgentSessionSummary {
    let newest = &saved[saved.len() - 1];
    let prompts: Vec<&Saved> = saved.iter().filter(|item| prompt_of(&item.input).is_some()).collect();
    let first_prompt = prompts.first().and_then(|item| prompt_of(&item.input));
    let last_prompt = prompts.last().and_then(|item| prompt_of(&item.input));
    let cwd = saved.iter().rev().find_map(|item| cwd_of(&item.input));
    let (title, title_source) = pick_title(None, None, first_prompt, cwd.as_deref().and_then(folder_title));
    let state = if newest.running { TurnState::Working } else { TurnState::Done };
    let reply = reply_index(saved)
        .and_then(|index| text(&saved[index].input["last_assistant_message"]))
        .map(|reply| reply_ending(&reply))
        .unwrap_or_default();
    let current_tool = (newest.running && newest.input["hook_event_name"] == "PreToolUse")
        .then(|| tool_call(&newest.input))
        .flatten();
    AgentSessionSummary {
        provider: edition.provider,
        session_id,
        cwd,
        title,
        title_source,
        model: None,
        effort: None,
        phase: session_phase(state, now - newest.at, AGENT_RUNNING_STALE_AFTER_MS),
        last_message: reply.message,
        reply_marker: reply.marker,
        reply_asks: reply.asks,
        updated_at: newest.at,
        host: None,
        turn_started_at: prompts.last().map(|item| item.at),
        last_prompt,
        current_tool,
        permission_mode: None,
        subagents: 0,
        background_tasks: 0,
        compacting: false,
        todos: None,
        closed: false,
        remote_host: None,
        parent_id: None,
        context_tokens: None,
    }
}

fn cwd_of(input: &Value) -> Option<String> {
    text(&input["cwd"]).or_else(|| input["workspace_roots"].as_array().and_then(|roots| roots.iter().find_map(text)))
}

fn tool_call(input: &Value) -> Option<ToolCall> {
    let name = text(&input["tool_name"])?;
    let detail = DETAIL_KEYS
        .iter()
        .find_map(|key| input["tool_input"][*key].as_str())
        .map(short_detail)
        .and_then(|value| shorten(&value, DETAIL_MAX_CHARS));
    Some(ToolCall { name, detail })
}

fn short_detail(value: &str) -> String {
    let is_path = !value.contains(' ') && (value.contains('/') || value.contains('\\'));
    match value.rsplit(['/', '\\']).next().filter(|name| is_path && !name.is_empty()) {
        Some(name) => name.to_string(),
        None => value.to_string(),
    }
}

fn text(value: &Value) -> Option<String> {
    value.as_str().filter(|text| !text.is_empty()).map(str::to_string)
}

#[cfg(test)]
#[path = "trae_tests.rs"]
mod tests;
