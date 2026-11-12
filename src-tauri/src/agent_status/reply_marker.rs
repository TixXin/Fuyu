use std::{
    env, fs,
    path::{Path, PathBuf},
};

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ReplyMarker {
    YourTurn,
    Background,
    Done,
}

impl ReplyMarker {
    pub(super) fn name(self) -> &'static str {
        match self {
            Self::YourTurn => "yourTurn",
            Self::Background => "background",
            Self::Done => "done",
        }
    }

    fn from_symbol(symbol: &str) -> Option<Self> {
        match symbol.trim_end_matches('\u{FE0E}').trim_end_matches('\u{FE0F}') {
            "↩" => Some(Self::YourTurn),
            "⋯" => Some(Self::Background),
            "✓" => Some(Self::Done),
            _ => None,
        }
    }
}

pub(super) fn split_reply(text: &str) -> (Option<ReplyMarker>, &str) {
    let trimmed = text.trim_end();
    let (rest, last) = match trimmed.rfind('\n') {
        Some(index) => (&trimmed[..index], &trimmed[index + 1..]),
        None => ("", trimmed),
    };
    match ReplyMarker::from_symbol(last.trim()) {
        Some(marker) => (Some(marker), rest.trim_end()),
        None => (None, text),
    }
}

const BLOCK_START: &str = "<!-- fuyu: reply marker v4 -->";
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

Write the character alone on the last line, without backticks, and nothing after it. To stop, switch off \"Reply status marker\" in Fuyu's Settings → AI Agent, which deletes this file.";

pub(super) fn block() -> String {
    format!("{BLOCK_START}\n{BLOCK_BODY}\n{BLOCK_END}")
}

fn find_block(text: &str) -> Option<(usize, usize)> {
    [(BLOCK_START_PREFIX, BLOCK_END), (LEGACY_BLOCK_START_PREFIX, LEGACY_BLOCK_END)].into_iter().find_map(|(prefix, end_marker)| {
        let start = text.find(prefix)?;
        let end = text[start..].find(end_marker)? + start + end_marker.len();
        Some((start, end))
    })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyMarkerState {
    pub(super) installed: bool,
    pub(super) outdated: bool,
    pub(super) path: String,
    pub(super) content: String,
    pub(super) remotes: Vec<super::remote_setup::RemoteResult>,
}

pub(super) fn state_of(rules: &str, claude_md: &str, path: &Path) -> ReplyMarkerState {
    let found = find_block(rules);
    let legacy = find_block(claude_md).is_some();
    ReplyMarkerState {
        installed: found.is_some() || legacy,
        outdated: legacy || found.is_some_and(|(start, end)| rules[start..end].replace("\r\n", "\n") != block()),
        path: path.display().to_string(),
        content: block(),
        remotes: Vec::new(),
    }
}

pub(super) fn rules_file() -> String {
    format!("{}\n", block())
}

pub(super) fn is_rules_file(text: &str) -> bool {
    text.contains(BLOCK_START_PREFIX) || text.contains(LEGACY_BLOCK_START_PREFIX)
}

pub(super) fn without_block(text: &str) -> String {
    let Some((start, end)) = find_block(text) else {
        return text.to_string();
    };
    let before = text[..start].trim_end();
    let after = text[end..].trim_start_matches(['\r', '\n']);
    let newline = if text.contains("\r\n") { "\r\n" } else { "\n" };
    match (before.is_empty(), after.is_empty()) {
        (true, _) => after.to_string(),
        (false, true) => format!("{before}{newline}"),
        (false, false) => format!("{before}{newline}{newline}{after}"),
    }
}

pub(super) const RULES_FILE: &str = "rules/fuyu-reply-marker.md";
pub(super) const LEGACY_RULES_FILE: &str = "rules/focusd-island-reply-marker.md";

fn installed_rules(dir: &Path) -> Result<String, String> {
    let rules = read_text(&dir.join(RULES_FILE))?;
    if !rules.is_empty() {
        return Ok(rules);
    }
    let legacy = read_text(&dir.join(LEGACY_RULES_FILE))?;
    Ok(if is_rules_file(&legacy) { legacy } else { rules })
}

fn remove_legacy_rules(dir: &Path) -> Result<(), String> {
    let path = dir.join(LEGACY_RULES_FILE);
    if is_rules_file(&read_text(&path)?) {
        fs::remove_file(&path).map_err(|error| format!("Failed to delete {}: {error}", path.display()))?;
    }
    Ok(())
}

fn claude_dir() -> Result<PathBuf, String> {
    env::var_os("CLAUDE_CONFIG_DIR")
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
        .map(Ok)
        .unwrap_or_else(|| crate::system::windows_home_dir().map(|home| home.join(".claude")))
}

fn read_text(path: &Path) -> Result<String, String> {
    match fs::read_to_string(path) {
        Ok(text) => Ok(text),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(error) => Err(format!("Failed to read {}: {error}", path.display())),
    }
}

#[tauri::command]
pub async fn get_reply_marker_state() -> Result<ReplyMarkerState, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let dir = claude_dir()?;
        let path = dir.join(RULES_FILE);
        Ok(state_of(&installed_rules(&dir)?, &read_text(&dir.join("CLAUDE.md"))?, &path))
    })
    .await
    .map_err(|error| format!("Failed to join the CLAUDE.md task: {error}"))?
}

pub(super) fn needs_upgrade(rules: &str) -> bool {
    find_block(rules).is_some_and(|(start, end)| rules[start..end].replace("\r\n", "\n") != block())
}

pub(super) fn upgrade_installed() {
    let Ok(dir) = claude_dir() else { return };
    let path = dir.join(RULES_FILE);
    let Ok(rules) = installed_rules(&dir) else { return };
    if needs_upgrade(&rules) {
        if let Err(error) = super::write_text_file(&path, &rules_file()) {
            eprintln!("failed to update the reply marker rules: {error}");
            return;
        }
    }
    if let Err(error) = remove_legacy_rules(&dir) {
        eprintln!("failed to remove the old reply marker rules: {error}");
    }
}

#[tauri::command]
pub async fn set_reply_marker(app: tauri::AppHandle, enabled: bool) -> Result<ReplyMarkerState, String> {
    use tauri::Manager;
    let app_dir = crate::home_dir::fuyu_home(app.path()).ok();
    tauri::async_runtime::spawn_blocking(move || {
        let dir = claude_dir()?;
        let path = dir.join(RULES_FILE);
        let rules = read_text(&path)?;
        if enabled && rules != rules_file() {
            super::write_text_file(&path, &rules_file())?;
        }
        if !enabled && is_rules_file(&rules) {
            fs::remove_file(&path).map_err(|error| format!("Failed to delete {}: {error}", path.display()))?;
        }
        remove_legacy_rules(&dir)?;
        let claude_md_path = dir.join("CLAUDE.md");
        let claude_md = read_text(&claude_md_path)?;
        let cleaned = without_block(&claude_md);
        if cleaned != claude_md {
            super::write_text_file(&claude_md_path, &cleaned)?;
        }
        let mut state = state_of(&read_text(&path)?, &cleaned, &path);
        if let Some(app_dir) = app_dir {
            state.remotes = super::remote_setup::set_reply_marker(&app_dir, enabled);
        }
        Ok(state)
    })
    .await
    .map_err(|error| format!("Failed to join the CLAUDE.md task: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_last_line_alone_is_the_marker() {
        assert_eq!(split_reply("Which one?\n\n↩"), (Some(ReplyMarker::YourTurn), "Which one?"));
        assert_eq!(split_reply("Started the build.\r\n⋯\r\n"), (Some(ReplyMarker::Background), "Started the build."));
        assert_eq!(split_reply("Done.\n  ✓\u{FE0E} "), (Some(ReplyMarker::Done), "Done."));
        assert_eq!(split_reply("✓"), (Some(ReplyMarker::Done), ""));
        assert_eq!(split_reply("Tests ✓"), (None, "Tests ✓"));
        assert_eq!(split_reply("↩\nmore text"), (None, "↩\nmore text"));
        assert_eq!(split_reply("`↩`"), (None, "`↩`"));
    }

    #[test]
    fn the_rules_file_holds_the_block_and_an_old_block_comes_out_of_claude_md_cleanly() {
        let path = Path::new("C:/Users/me/.claude/rules/fuyu-reply-marker.md");
        let user = "# Global rules\r\n\r\n- reply in Chinese\r\n";
        let state = state_of(&rules_file(), user, path);
        assert!(state.installed && !state.outdated);
        assert_eq!(state.content, block());
        assert!(is_rules_file(&rules_file()) && !is_rules_file(user));
        assert!(!state_of("", user, path).installed);

        let legacy = format!("{user}\r\n<!-- focusd-island: reply marker v1 -->\r\nold words\r\n{LEGACY_BLOCK_END}\r\n\r\n## After\r\n");
        let state = state_of("", &legacy, path);
        assert!(state.installed && state.outdated);
        assert_eq!(without_block(&legacy), format!("{user}\r\n## After\r\n"));
        assert_eq!(without_block(user), user);
        assert!(state_of("<!-- focusd-island: reply marker v1 -->\nx\n<!-- /focusd-island: reply marker -->\n", "", path).outdated);
    }

    #[test]
    fn only_an_older_wording_in_the_rules_file_is_upgraded() {
        assert!(!needs_upgrade(&rules_file()));
        assert!(!needs_upgrade(&rules_file().replace('\n', "\r\n")));
        assert!(!needs_upgrade(""));
        assert!(!needs_upgrade("# my own rules\n"));
        assert!(needs_upgrade("<!-- focusd-island: reply marker v2 -->\nold words\n<!-- /focusd-island: reply marker -->\n"));
        let v3 = "<!-- focusd-island: reply marker v3 -->\nwords\n<!-- /focusd-island: reply marker -->\n";
        assert!(is_rules_file(v3) && needs_upgrade(v3));
        assert_eq!(without_block(v3), "");
    }
}
