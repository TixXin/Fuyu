use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Priority {
    #[default]
    ReleaseFirst,
    DevFirst,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Saved {
    priority: Priority,
}

pub(super) fn yields(development: bool, priority: Priority, release_running: bool) -> bool {
    development && priority == Priority::ReleaseFirst && release_running
}

pub(super) fn saved_priority(text: Option<&str>) -> Priority {
    text.and_then(|text| serde_json::from_str::<Saved>(text.trim_start_matches('\u{feff}')).ok()).map(|saved| saved.priority).unwrap_or_default()
}

pub(super) fn priority_file(priority: Priority) -> String {
    serde_json::to_string_pretty(&Saved { priority }).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::{priority_file, saved_priority, yields, Priority};

    #[test]
    fn only_a_development_build_that_puts_the_release_first_yields_and_only_while_one_runs() {
        assert!(yields(true, Priority::ReleaseFirst, true));
        assert!(!yields(true, Priority::ReleaseFirst, false));
        assert!(!yields(true, Priority::DevFirst, true));
        assert!(!yields(true, Priority::DevFirst, false));
        assert!(!yields(false, Priority::ReleaseFirst, true));
        assert!(!yields(false, Priority::DevFirst, true));
    }

    #[test]
    fn the_saved_choice_survives_and_anything_unreadable_means_release_first() {
        assert_eq!(saved_priority(Some(&priority_file(Priority::DevFirst))), Priority::DevFirst);
        assert_eq!(saved_priority(Some(&priority_file(Priority::ReleaseFirst))), Priority::ReleaseFirst);
        assert_eq!(saved_priority(Some(r#"{ "priority": "devFirst" }"#)), Priority::DevFirst);
        for text in [None, Some(""), Some("not json"), Some("{}"), Some(r#"{ "priority": "other" }"#)] {
            assert_eq!(saved_priority(text), Priority::ReleaseFirst, "{text:?}");
        }
    }
}
