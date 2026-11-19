use std::path::Path;

use super::claude_desktop;

const SESSION_LINK: &str = "claude://claude.ai/epitaxy/";
const LOCAL_PREFIX: &str = "local_";
const MAX_ID_CHARS: usize = 64;

pub(super) fn session_link(local_id: &str) -> Option<String> {
    let id = local_id.strip_prefix(LOCAL_PREFIX)?;
    let valid = !id.is_empty() && id.len() <= MAX_ID_CHARS && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    valid.then(|| format!("{SESSION_LINK}{local_id}"))
}

pub(super) fn link_for(home_dir: &Path, cli_session_id: &str) -> Option<String> {
    let sessions = claude_desktop::sessions(home_dir, 0);
    sessions.get(cli_session_id)?.local_id.as_deref().and_then(session_link)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn links_a_desktop_session_to_its_code_tab_page() {
        assert_eq!(
            session_link("local_c53b7eb2-ce7e-4775-8be7-2987158d3f19").as_deref(),
            Some("claude://claude.ai/epitaxy/local_c53b7eb2-ce7e-4775-8be7-2987158d3f19")
        );
    }

    #[test]
    fn refuses_ids_that_could_change_the_link() {
        let long = format!("local_{}", "a".repeat(MAX_ID_CHARS + 1));
        for id in ["", "local_", "c53b7eb2", "cse_1", "local_a/../b", "local_a?x=1", "local_a#b", "local_a b", "local_ä", long.as_str()] {
            assert_eq!(session_link(id), None, "{id}");
        }
    }

    #[test]
    fn finds_the_desktop_id_from_the_hook_session_id() {
        let home = std::env::temp_dir().join(format!("fuyu-claude-desktop-focus-{}", std::process::id()));
        let account = claude_desktop::app_dir(&home).join("claude-code-sessions").join("org").join("acct");
        fs::create_dir_all(&account).unwrap();
        fs::write(account.join("local_7a1d-01.json"), r#"{"sessionId":"local_7a1d-01","cliSessionId":"cli-1"}"#).unwrap();
        fs::write(account.join("local_bad.json"), r#"{"sessionId":"local_a&b","cliSessionId":"cli-2"}"#).unwrap();
        fs::write(account.join("local_none.json"), r#"{"cliSessionId":"cli-3"}"#).unwrap();
        assert_eq!(link_for(&home, "cli-1").as_deref(), Some("claude://claude.ai/epitaxy/local_7a1d-01"));
        assert_eq!(link_for(&home, "cli-2"), None);
        assert_eq!(link_for(&home, "cli-3"), None);
        assert_eq!(link_for(&home, "terminal-only"), None);
        let _ = fs::remove_dir_all(&home);
    }
}
