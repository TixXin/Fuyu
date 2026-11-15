use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use serde::Serialize;

use super::{antigravity, claude_code, codebuddy, codex, dsh, opencode, qoder, qwen, trae, workbuddy, zcode};

const BLOCK_START: &str = "<!-- fuyu: reply marker v5 -->";
pub(super) const BLOCK_START_PREFIX: &str = "<!-- fuyu: reply marker";
const BLOCK_END: &str = "<!-- /fuyu: reply marker -->";
pub(super) const LEGACY_BLOCK_START_PREFIX: &str = "<!-- focusd-island: reply marker";
const LEGACY_BLOCK_END: &str = "<!-- /focusd-island: reply marker -->";

const BLOCK_BODY: &str = "\
## Reply status marker (added by Fuyu)

End every reply with one extra line that holds only one of these characters, so Fuyu can show what this session is waiting for:

- `↩` the next step is the user's: you asked a question, offered options or a next step (\"want me to…?\"), asked them to do something and tell you, or need their decision, approval or input
- `⋯` nothing is needed from the user yet: you ended the turn only to wait for a background task you started (a background command, a subagent, a monitor, a scheduled wake-up) that will wake you
- `✓` the work the user asked for is finished, nothing is left for them to answer or decide, and nothing you started is still running

When more than one fits, `↩` wins over `⋯`, and `⋯` over `✓`. When unsure, use `↩`.

Write the character alone on the last line, without backticks, and nothing after it. To stop, switch off \"Reply status marker\" in Fuyu's Settings → AI Agent, which removes this section.";

type PromptFiles = fn(&Path) -> Vec<PathBuf>;

pub(super) const PROMPT_FILES: &[(&str, PromptFiles)] = &[
    (codex::PROVIDER, codex::prompt_files),
    (claude_code::PROVIDER, claude_code::prompt_files),
    (workbuddy::PROVIDER, workbuddy::prompt_files),
    (antigravity::PROVIDER, antigravity::prompt_files),
    (dsh::PROVIDER, dsh::prompt_files),
    (opencode::PROVIDER, opencode::prompt_files),
    (qoder::PROVIDER, qoder::prompt_files),
    (codebuddy::PROVIDER, codebuddy::prompt_files),
    (qwen::PROVIDER, qwen::prompt_files),
    (trae::TRAE.provider, trae::prompt_files),
    (trae::TRAE_CN.provider, trae::prompt_files),
    (zcode::PROVIDER, zcode::prompt_files),
];

pub(super) const RULES_FILE: &str = "rules/fuyu-reply-marker.md";
pub(super) const LEGACY_RULES_FILE: &str = "rules/focusd-island-reply-marker.md";

pub(super) fn block() -> String {
    format!("{BLOCK_START}\n{BLOCK_BODY}\n{BLOCK_END}")
}

#[cfg(test)]
pub(super) fn rules_file() -> String {
    format!("{}\n", block())
}

fn find_block(text: &str) -> Option<(usize, usize)> {
    [(BLOCK_START_PREFIX, BLOCK_END), (LEGACY_BLOCK_START_PREFIX, LEGACY_BLOCK_END)].into_iter().find_map(|(prefix, end_marker)| {
        let start = text.find(prefix)?;
        let end = text[start..].find(end_marker)? + start + end_marker.len();
        Some((start, end))
    })
}

pub(super) fn is_rules_file(text: &str) -> bool {
    text.contains(BLOCK_START_PREFIX) || text.contains(LEGACY_BLOCK_START_PREFIX)
}

fn is_current(text: &str) -> bool {
    find_block(text).is_some_and(|(start, end)| text[start..end].replace("\r\n", "\n") == block())
}

fn without_one_block(text: &str) -> Option<String> {
    let (start, end) = find_block(text)?;
    let before = text[..start].trim_end();
    let after = text[end..].trim_start_matches(['\r', '\n']);
    let newline = if text.contains("\r\n") { "\r\n" } else { "\n" };
    Some(match (before.is_empty(), after.is_empty()) {
        (true, _) => after.to_string(),
        (false, true) => format!("{before}{newline}"),
        (false, false) => format!("{before}{newline}{newline}{after}"),
    })
}

pub(super) fn without_block(text: &str) -> String {
    let mut text = text.to_string();
    while let Some(next) = without_one_block(&text) {
        text = next;
    }
    text
}

pub(super) fn with_block(text: &str) -> String {
    let rest = without_block(text);
    let rest = rest.trim_end();
    let newline = if text.contains("\r\n") { "\r\n" } else { "\n" };
    let block = block().replace('\n', newline);
    if rest.is_empty() {
        format!("{block}{newline}")
    } else {
        format!("{rest}{newline}{newline}{block}{newline}")
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptFile {
    pub(super) agent: &'static str,
    pub(super) path: String,
    pub(super) target: Option<String>,
    pub(super) installed: bool,
    pub(super) outdated: bool,
    pub(super) error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyMarkerState {
    pub(super) installed: bool,
    pub(super) outdated: bool,
    pub(super) files: Vec<PromptFile>,
    pub(super) old_rules: Vec<String>,
    pub(super) content: String,
    pub(super) remotes: Vec<super::remote_setup::RemoteResult>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Change {
    Read,
    Enable,
    Disable,
    Upgrade,
}

enum Resolved {
    File(PathBuf),
    NotHere,
    Broken(String),
}

fn shown(path: &Path) -> String {
    let text = path.display().to_string();
    text.strip_prefix(r"\\?\").map(str::to_string).unwrap_or(text)
}

fn resolve(path: &Path) -> Resolved {
    if let Ok(target) = fs::canonicalize(path) {
        return Resolved::File(target);
    }
    if let Ok(link) = fs::read_link(path) {
        return Resolved::Broken(format!("{} is a link to {}, which does not exist", shown(path), shown(&link)));
    }
    match (path.parent().and_then(|dir| fs::canonicalize(dir).ok()), path.file_name()) {
        (Some(dir), Some(name)) if dir.is_dir() => Resolved::File(dir.join(name)),
        _ => Resolved::NotHere,
    }
}

fn read_text(path: &Path) -> Result<String, String> {
    match fs::read_to_string(path) {
        Ok(text) => Ok(text),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(error) => Err(format!("Failed to read {}: {error}", shown(path))),
    }
}

fn changed(text: &str, change: Change) -> Option<String> {
    let next = match change {
        Change::Read => return None,
        Change::Enable => with_block(text),
        Change::Disable => without_block(text),
        Change::Upgrade if find_block(text).is_some() => with_block(text),
        Change::Upgrade => return None,
    };
    (next != text).then_some(next)
}

fn sync_file(target: &Path, change: Change) -> (bool, bool, Option<String>) {
    let text = match read_text(target) {
        Ok(text) => text,
        Err(error) => return (false, false, Some(error)),
    };
    let (text, error) = match changed(&text, change) {
        Some(next) => match super::write_text_file(target, &next) {
            Ok(()) => (next, None),
            Err(error) => (text, Some(error)),
        },
        None => (text, None),
    };
    let installed = find_block(&text).is_some();
    (installed, installed && !is_current(&text), error)
}

fn sync(entries: &[(&'static str, PathBuf)], change: Change) -> Vec<PromptFile> {
    let mut done: HashMap<PathBuf, (bool, bool, Option<String>)> = HashMap::new();
    entries
        .iter()
        .filter_map(|(agent, path)| {
            let (target, (installed, outdated, error)) = match resolve(path) {
                Resolved::NotHere => return None,
                Resolved::Broken(error) => (None, (false, false, Some(error))),
                Resolved::File(target) => {
                    let result = done.entry(target.clone()).or_insert_with(|| sync_file(&target, change)).clone();
                    (Some(target), result)
                }
            };
            let target = target.filter(|_| path.is_symlink()).map(|target| shown(&target));
            Some(PromptFile { agent, path: shown(path), target, installed, outdated, error })
        })
        .collect()
}

fn entries(home_dir: &Path) -> Vec<(&'static str, PathBuf)> {
    PROMPT_FILES
        .iter()
        .flat_map(|(agent, files)| files(home_dir).into_iter().map(move |path| (*agent, path)))
        .collect()
}

fn old_rules(claude_dir: &Path) -> Vec<PathBuf> {
    [RULES_FILE, LEGACY_RULES_FILE]
        .into_iter()
        .map(|name| claude_dir.join(name))
        .filter(|path| read_text(path).is_ok_and(|text| is_rules_file(&text)))
        .collect()
}

fn remove_old_rules(claude_dir: &Path) -> Result<(), String> {
    for path in old_rules(claude_dir) {
        fs::remove_file(&path).map_err(|error| format!("Failed to delete {}: {error}", shown(&path)))?;
    }
    Ok(())
}

fn state(home_dir: &Path, change: Change) -> Result<ReplyMarkerState, String> {
    let claude_dir = claude_code::config_dir(home_dir);
    let files = sync(&entries(home_dir), change);
    if matches!(change, Change::Enable | Change::Disable) {
        remove_old_rules(&claude_dir)?;
    }
    let old_rules: Vec<String> = old_rules(&claude_dir).iter().map(|path| shown(path)).collect();
    let installed = !old_rules.is_empty() || files.iter().any(|file| file.installed);
    let outdated = installed
        && (!old_rules.is_empty() || files.iter().any(|file| file.outdated || (!file.installed && file.error.is_none())));
    Ok(ReplyMarkerState { installed, outdated, files, old_rules, content: block(), remotes: Vec::new() })
}

fn home_dir() -> Result<PathBuf, String> {
    crate::system::windows_home_dir()
}

pub(super) fn upgrade_installed() {
    let Ok(home) = home_dir() else { return };
    if let Ok(state) = state(&home, Change::Upgrade) {
        for error in state.files.iter().filter_map(|file| file.error.as_deref()) {
            eprintln!("failed to update the reply marker: {error}");
        }
    }
}

pub(super) fn repair() {
    let Ok(home) = home_dir() else { return };
    let Ok(current) = state(&home, Change::Read) else { return };
    if !current.installed {
        return;
    }
    match state(&home, Change::Enable) {
        Ok(state) => {
            for error in state.files.iter().filter_map(|file| file.error.as_deref()) {
                eprintln!("failed to repair the reply marker: {error}");
            }
        }
        Err(error) => eprintln!("failed to repair the reply marker: {error}"),
    }
}

#[tauri::command]
pub async fn get_reply_marker_state() -> Result<ReplyMarkerState, String> {
    tauri::async_runtime::spawn_blocking(|| state(&home_dir()?, Change::Read))
        .await
        .map_err(|error| format!("Failed to join the reply marker task: {error}"))?
}

#[tauri::command]
pub async fn set_reply_marker(app: tauri::AppHandle, enabled: bool) -> Result<ReplyMarkerState, String> {
    use tauri::Manager;
    let app_dir = crate::home_dir::fuyu_home(app.path()).ok();
    tauri::async_runtime::spawn_blocking(move || {
        let mut state = state(&home_dir()?, if enabled { Change::Enable } else { Change::Disable })?;
        if let Some(app_dir) = app_dir {
            state.remotes = super::remote_setup::set_reply_marker(&app_dir, enabled);
        }
        Ok(state)
    })
    .await
    .map_err(|error| format!("Failed to join the reply marker task: {error}"))?
}

#[cfg(test)]
#[path = "reply_marker_tests.rs"]
mod tests;
