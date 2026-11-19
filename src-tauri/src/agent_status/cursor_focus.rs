const AGENT_LINK: &str = "cursor://anysphere.cursor-deeplink/agent?id=";
const MAX_ID_CHARS: usize = 128;

pub(super) fn session_link(session_id: &str) -> Option<String> {
    let valid = !session_id.is_empty()
        && session_id.len() <= MAX_ID_CHARS
        && session_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    valid.then(|| format!("{AGENT_LINK}{session_id}"))
}

pub(super) fn link_for(has_terminal: bool, session_id: Option<&str>) -> Option<String> {
    if has_terminal {
        return None;
    }
    session_id.and_then(session_link)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links_a_composer_id_to_the_agents_window() {
        assert_eq!(
            session_link("c728c934-d1a8-4404-b510-ff4e9dbe6797").as_deref(),
            Some("cursor://anysphere.cursor-deeplink/agent?id=c728c934-d1a8-4404-b510-ff4e9dbe6797")
        );
    }

    #[test]
    fn refuses_ids_that_could_change_the_link() {
        let long = "a".repeat(MAX_ID_CHARS + 1);
        for id in ["", "a&bcId=x", "../x", "a b", "a?x=1", "id#frag", "ä", long.as_str()] {
            assert_eq!(session_link(id), None, "{id}");
        }
    }

    #[test]
    fn sessions_running_in_a_terminal_keep_the_terminal_path() {
        assert!(link_for(false, Some("c1")).is_some());
        assert_eq!(link_for(true, Some("c1")), None);
        assert_eq!(link_for(false, None), None);
    }
}
