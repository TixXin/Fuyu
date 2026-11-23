use std::{
    fs,
    io::Read,
    path::Path,
    time::UNIX_EPOCH,
};

use serde_json::{json, Map, Value};

use super::usage::{AgentUsage, UsageSource, UsageWindow};
use super::write_text_file;

#[cfg(windows)]
pub(super) const SCRIPT_FILE_NAME: &str = "fuyu-claude-statusline.ps1";
#[cfg(not(windows))]
pub(super) const SCRIPT_FILE_NAME: &str = "fuyu-claude-statusline.sh";
#[cfg(windows)]
const SCRIPT: &str = include_str!("hooks/fuyu-claude-statusline.ps1");
#[cfg(not(windows))]
const SCRIPT: &str = include_str!("hooks/fuyu-claude-statusline.sh");

pub(super) const NEXT_FILE_NAME: &str = "claude-statusline-next.txt";
pub(super) const SNAPSHOT_FILE_NAME: &str = "claude-statusline.json";
const MAX_SNAPSHOT_BYTES: u64 = 256 * 1024;

pub(super) fn install(settings_path: &Path, app_dir: &Path) -> Result<(), String> {
    write_script(app_dir)?;
    let mut config = read_settings(settings_path)?;
    let Some(root) = config.as_object_mut() else {
        return Err("Claude Code settings.json must contain a JSON object.".to_string());
    };
    let ours = command(&app_dir.join(SCRIPT_FILE_NAME));
    let current = root.get("statusLine").cloned();
    let previous = current.as_ref().and_then(|line| line["command"].as_str()).map(str::to_string);
    let next_path = app_dir.join(NEXT_FILE_NAME);
    match previous.as_deref() {
        Some(previous) if is_ours(previous) => {}
        Some(previous) => write_text_file(&next_path, previous)?,
        None => {
            if next_path.exists() {
                fs::remove_file(&next_path).map_err(|error| format!("Failed to remove {}: {error}", next_path.display()))?;
            }
        }
    }
    let mut line = match current {
        Some(Value::Object(line)) => line,
        _ => Map::new(),
    };
    if line.get("command").and_then(Value::as_str) == Some(ours.as_str()) && line.get("type").and_then(Value::as_str) == Some("command") {
        return Ok(());
    }
    line.insert("type".into(), json!("command"));
    line.insert("command".into(), json!(ours));
    root.insert("statusLine".into(), Value::Object(line));
    write_settings(settings_path, &config)
}

pub(super) fn uninstall(settings_path: &Path, app_dir: &Path) -> Result<(), String> {
    let next_path = app_dir.join(NEXT_FILE_NAME);
    let next = fs::read_to_string(&next_path).ok().map(|text| text.trim().to_string()).filter(|text| !text.is_empty());
    let Ok(text) = fs::read_to_string(settings_path) else { return Ok(()) };
    let mut config = parse(&text)?;
    if let Some(root) = config.as_object_mut() {
        let ours = root.get("statusLine").and_then(|line| line["command"].as_str()).is_some_and(is_ours);
        if ours {
            match &next {
                Some(next) => {
                    if let Some(Value::Object(line)) = root.get_mut("statusLine") {
                        line.insert("command".into(), json!(next));
                    }
                }
                None => {
                    root.remove("statusLine");
                }
            }
            write_settings(settings_path, &config)?;
        }
    }
    if next_path.exists() {
        fs::remove_file(&next_path).map_err(|error| format!("Failed to remove {}: {error}", next_path.display()))?;
    }
    Ok(())
}

pub(super) fn is_ours(command: &str) -> bool {
    command.contains("fuyu-claude-statusline")
}

pub(super) fn read_usage(app_dir: &Path) -> Option<AgentUsage> {
    let path = app_dir.join(SNAPSHOT_FILE_NAME);
    let file = fs::File::open(&path).ok()?;
    let updated_at = file
        .metadata()
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .and_then(|elapsed| i64::try_from(elapsed.as_millis()).ok());
    let mut text = String::new();
    file.take(MAX_SNAPSHOT_BYTES).read_to_string(&mut text).ok()?;
    parse_snapshot(&text, updated_at)
}

pub(super) fn parse_snapshot(text: &str, updated_at: Option<i64>) -> Option<AgentUsage> {
    let input = serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}')).ok()?;
    let limits = &input["rate_limits"];
    let five_hour = window(&limits["five_hour"]);
    let seven_day = window(&limits["seven_day"]);
    if five_hour.is_none() && seven_day.is_none() {
        return None;
    }
    Some(AgentUsage {
        updated_at,
        five_hour,
        seven_day,
        models: Vec::new(),
        plan: None,
        source: UsageSource::Statusline,
        error: None,
    })
}

fn window(value: &Value) -> Option<UsageWindow> {
    let used = value["used_percentage"].as_f64().filter(|used| used.is_finite())?;
    let resets_at = value["resets_at"]
        .as_f64()
        .filter(|seconds| seconds.is_finite() && *seconds > 0.0)
        .map(|seconds| (seconds * 1000.0).round() as i64);
    Some(UsageWindow { name: String::new(), used: used.clamp(0.0, 100.0), resets_at })
}

fn read_settings(path: &Path) -> Result<Value, String> {
    match fs::read_to_string(path) {
        Ok(text) if !text.trim().is_empty() => parse(&text),
        _ => Ok(json!({})),
    }
}

fn parse(text: &str) -> Result<Value, String> {
    serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}'))
        .map_err(|error| format!("Failed to parse Claude Code settings.json: {error}"))
}

fn write_settings(path: &Path, config: &Value) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config)
        .map_err(|error| format!("Failed to serialize Claude Code settings.json: {error}"))?;
    write_text_file(path, &json)
}

#[cfg(windows)]
fn write_script(app_dir: &Path) -> Result<(), String> {
    write_text_file(&app_dir.join(SCRIPT_FILE_NAME), &super::normalize_windows_line_endings(SCRIPT))
}

#[cfg(not(windows))]
fn write_script(app_dir: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let path = app_dir.join(SCRIPT_FILE_NAME);
    write_text_file(&path, &SCRIPT.replace("\r\n", "\n"))?;
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755))
        .map_err(|error| format!("Failed to make {} runnable: {error}", path.display()))
}

fn command(script: &Path) -> String {
    super::claude_hooks::claude_code_powershell_command(script, &[])
}

#[cfg(test)]
#[path = "claude_statusline_tests.rs"]
mod tests;
