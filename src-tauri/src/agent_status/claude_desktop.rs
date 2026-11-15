use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
    time::SystemTime,
};

use serde_json::Value;

use super::session_scan::{TITLE_FROM_AGENT, TITLE_FROM_RENAME};
use super::sessions::AgentSessionSummary;
use super::snapshot::system_time_to_unix_millis;
use super::title::display_title;

const SESSIONS_DIR: &str = "claude-code-sessions";

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(super) struct DesktopSession {
    pub(super) cli_session_id: String,
    pub(super) title: Option<String>,
    pub(super) user_titled: bool,
    pub(super) model: Option<String>,
    pub(super) effort: Option<String>,
}

type DesktopCache = HashMap<PathBuf, (SystemTime, Option<DesktopSession>)>;

static CACHE: Mutex<Option<DesktopCache>> = Mutex::new(None);

pub(super) fn app_dir(home_dir: &Path) -> PathBuf {
    let base = if cfg!(target_os = "macos") {
        home_dir.join("Library").join("Application Support")
    } else if cfg!(windows) {
        home_dir.join("AppData").join("Roaming")
    } else {
        home_dir.join(".config")
    };
    base.join("Claude")
}

pub(super) fn sessions(home_dir: &Path, since: i64) -> HashMap<String, DesktopSession> {
    let root = app_dir(home_dir).join(SESSIONS_DIR);
    let mut found = HashMap::new();
    let mut cache = CACHE.lock().unwrap_or_else(PoisonError::into_inner);
    let cache = cache.get_or_insert_with(HashMap::new);
    for path in session_files(&root) {
        let Some(modified) = fs::metadata(&path).ok().and_then(|meta| meta.modified().ok()) else {
            continue;
        };
        if system_time_to_unix_millis(modified).is_none_or(|at| at < since) {
            continue;
        }
        let session = match cache.get(&path) {
            Some((known, session)) if *known == modified => session.clone(),
            _ => {
                let session = fs::read_to_string(&path).ok().and_then(|text| parse(&text));
                cache.insert(path.clone(), (modified, session.clone()));
                session
            }
        };
        if let Some(session) = session {
            found.insert(session.cli_session_id.clone(), session);
        }
    }
    cache.retain(|path, _| path.is_file());
    found
}

fn session_files(root: &Path) -> Vec<PathBuf> {
    let read = |dir: &Path| -> Vec<PathBuf> {
        fs::read_dir(dir).map(|entries| entries.flatten().map(|entry| entry.path()).collect()).unwrap_or_default()
    };
    read(root)
        .iter()
        .flat_map(|org| read(org))
        .flat_map(|account| read(&account))
        .filter(|path| {
            path.extension().is_some_and(|ext| ext == "json")
                && path.file_name().is_some_and(|name| name.to_string_lossy().starts_with("local_"))
        })
        .collect()
}

pub(super) fn parse(text: &str) -> Option<DesktopSession> {
    let record: Value = serde_json::from_str(text).ok()?;
    let string = |key: &str| {
        record[key].as_str().map(str::trim).filter(|value| !value.is_empty()).map(str::to_string)
    };
    Some(DesktopSession {
        cli_session_id: string("cliSessionId")?,
        title: string("title").as_deref().and_then(display_title),
        user_titled: record["titleSource"] == "user",
        model: string("model"),
        effort: string("effort"),
    })
}

pub(super) fn merge(summary: &mut AgentSessionSummary, desktop: Option<&DesktopSession>) {
    let Some(desktop) = desktop else {
        return;
    };
    if let Some(title) = desktop.title.clone() {
        summary.title = Some(title);
        summary.title_source = Some(if desktop.user_titled { TITLE_FROM_RENAME } else { TITLE_FROM_AGENT });
    }
    summary.model = summary.model.take().or_else(|| desktop.model.clone());
    summary.effort = summary.effort.take().or_else(|| desktop.effort.clone());
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{"sessionId":"local_7a1d","cliSessionId":"ffd62372-e4a7","cwd":"/work/fuyu",
        "title":"B37 WorkBuddy 在 macOS 上判断会话已退出","titleSource":"tool","model":"claude-opus-5-5",
        "effort":"medium","isArchived":false}"#;

    #[test]
    fn parses_code_tab_session() {
        let session = parse(SAMPLE).unwrap();
        assert_eq!(session.cli_session_id, "ffd62372-e4a7");
        assert_eq!(session.title.as_deref(), Some("B37 WorkBuddy 在 macOS 上判断会话已退出"));
        assert!(!session.user_titled);
        assert_eq!(session.model.as_deref(), Some("claude-opus-5-5"));
        assert_eq!(parse(r#"{"title":"no cli id"}"#), None);
        assert_eq!(parse("not json"), None);
    }

    #[test]
    fn merges_into_cli_session() {
        let mut summary = AgentSessionSummary {
            provider: "claudeCode",
            session_id: "ffd62372-e4a7".into(),
            cwd: None,
            title: Some("first prompt".into()),
            title_source: Some("prompt"),
            model: Some("claude-sonnet-5-5".into()),
            effort: None,
            phase: "completed",
            last_message: None,
            reply_marker: None,
            reply_asks: false,
            updated_at: 0,
            host: None,
            turn_started_at: None,
            last_prompt: None,
            current_tool: None,
            permission_mode: None,
            subagents: 0,
            background_tasks: 0,
            compacting: false,
            todos: None,
            closed: false,
            context_tokens: None,
            remote_host: None,
        };
        let mut session = parse(SAMPLE).unwrap();
        session.user_titled = true;
        merge(&mut summary, Some(&session));
        assert_eq!(summary.title, session.title);
        assert_eq!(summary.title_source, Some(TITLE_FROM_RENAME));
        assert_eq!(summary.model.as_deref(), Some("claude-sonnet-5-5"));
        assert_eq!(summary.effort.as_deref(), Some("medium"));
    }

    #[test]
    fn reads_sessions_from_account_folders() {
        let home = std::env::temp_dir().join(format!("fuyu-claude-desktop-{}", std::process::id()));
        let account = app_dir(&home).join(SESSIONS_DIR).join("org").join("acct");
        fs::create_dir_all(account.join("waiting-input")).unwrap();
        fs::write(account.join("local_1.json"), SAMPLE).unwrap();
        fs::write(account.join("scheduled-tasks.json"), "{}").unwrap();
        let found = sessions(&home, 0);
        assert_eq!(found.len(), 1);
        assert!(found.contains_key("ffd62372-e4a7"));
        assert!(sessions(&home, i64::MAX).is_empty());
        let _ = fs::remove_dir_all(&home);
    }
}
