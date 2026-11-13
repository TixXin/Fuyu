use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use serde_json::{json, Value};

use super::markers::AGENT_RUNNING_STALE_AFTER_MS;
use super::session_scan::pick_title;
use super::sessions::{session_phase, AgentSessionSummary, TurnState};
use super::snapshot::system_time_to_unix_millis;
use super::title::{folder_title, prompt_title};
use super::write_text_file;

pub(super) const PROVIDER: &str = "antigravity";
pub(super) const APP: &str = "antigravity";
const SAVED_DIR: &str = "agent-antigravity";
const DATA_DIRS: [&str; 3] = ["antigravity", "antigravity-ide", "antigravity-cli"];
const HOOK_NAME: &str = "fuyu";
const MAX_AGE_MS: i64 = 24 * 60 * 60 * 1000;

struct Saved {
    at: i64,
    running: bool,
    input: Value,
    path: PathBuf,
}

pub(super) fn sessions(app_dir: &Path, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    let mut newest: HashMap<String, Saved> = HashMap::new();
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
            let _ = fs::remove_file(&path);
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
            Some(known) if known.at > at => {
                let _ = fs::remove_file(&path);
            }
            _ => {
                if let Some(older) = newest.insert(id, Saved { at, running, input, path }) {
                    let _ = fs::remove_file(older.path);
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
    let cwd = input["workspacePaths"]
        .as_array()
        .and_then(|paths| paths.iter().find_map(text))
        .map(|path| path.strip_prefix("file:///").map(str::to_string).unwrap_or(path));
    let prompt = input["lastUserInput"].as_str().and_then(prompt_title);
    let (title, title_source) = pick_title(None, None, prompt.clone(), cwd.as_deref().and_then(folder_title));
    let state = if saved.running { TurnState::Working } else { TurnState::Done };
    AgentSessionSummary {
        provider: PROVIDER,
        session_id,
        cwd,
        title,
        title_source,
        model: text(&input["modelName"]),
        effort: None,
        phase: session_phase(state, now - saved.at, AGENT_RUNNING_STALE_AFTER_MS),
        last_message: None,
        reply_marker: None,
        reply_asks: false,
        updated_at: saved.at,
        host: None,
        turn_started_at: None,
        last_prompt: prompt,
        current_tool: None,
        permission_mode: None,
        subagents: 0,
        background_tasks: 0,
        compacting: false,
        todos: None,
        closed: false,
        remote_host: None,
        context_tokens: None,
    }
}

fn text(value: &Value) -> Option<String> {
    value.as_str().filter(|text| !text.is_empty()).map(str::to_string)
}

fn hooks_path(home_dir: &Path) -> PathBuf {
    home_dir.join(".gemini").join("config").join("hooks.json")
}

pub(super) fn has_hooks(home_dir: &Path) -> bool {
    fs::read_to_string(hooks_path(home_dir)).is_ok_and(|text| super::is_island_hook_text(&text))
}

pub(super) fn install_hooks(home_dir: &Path, running_script_path: &Path) -> Result<(), String> {
    let gemini = home_dir.join(".gemini");
    if !DATA_DIRS.iter().any(|dir| gemini.join(dir).is_dir()) {
        return Ok(());
    }
    let path = hooks_path(home_dir);
    let mut config = match fs::read_to_string(&path) {
        Ok(content) if !content.trim().is_empty() => serde_json::from_str::<Value>(&content)
            .map_err(|error| format!("Failed to parse Antigravity hooks.json: {error}"))?,
        _ => json!({}),
    };
    let root = config
        .as_object_mut()
        .ok_or_else(|| "Antigravity hooks.json must contain a JSON object.".to_string())?;
    let handler = |phase: &str| {
        json!([{
            "type": "command",
            "command": format!("\"{}\" {PROVIDER} {phase}", running_script_path.display()),
            "timeout": 5
        }])
    };
    root.insert(
        HOOK_NAME.to_string(),
        json!({
            "enabled": true,
            "SessionStart": handler("running"),
            "PreInvocation": handler("running"),
            "Stop": handler("stop"),
        }),
    );
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
        fs::remove_dir_all(&app_dir).unwrap();
    }

    #[test]
    fn installs_its_own_hook_group_only_where_antigravity_lives() {
        let home = temp_dir("hooks");
        let script = Path::new(r"C:\Users\a b\.fuyu\fuyu-agent-running.cmd");
        install_hooks(&home, script).unwrap();
        assert!(!hooks_path(&home).exists());

        fs::create_dir_all(home.join(".gemini").join("antigravity-cli")).unwrap();
        fs::create_dir_all(hooks_path(&home).parent().unwrap()).unwrap();
        fs::write(hooks_path(&home), r#"{"mine":{"enabled":true,"Stop":[{"type":"command","command":"x"}]}}"#).unwrap();
        install_hooks(&home, script).unwrap();
        install_hooks(&home, script).unwrap();
        let config: Value = serde_json::from_str(&fs::read_to_string(hooks_path(&home)).unwrap()).unwrap();
        assert_eq!(config["mine"]["Stop"][0]["command"], "x");
        assert_eq!(config[HOOK_NAME]["enabled"], true);
        assert_eq!(
            config[HOOK_NAME]["PreInvocation"][0]["command"],
            r#""C:\Users\a b\.fuyu\fuyu-agent-running.cmd" antigravity running"#
        );
        assert_eq!(config[HOOK_NAME]["Stop"][0]["command"], r#""C:\Users\a b\.fuyu\fuyu-agent-running.cmd" antigravity stop"#);
        assert!(has_hooks(&home));
        fs::remove_dir_all(&home).unwrap();
    }
}
