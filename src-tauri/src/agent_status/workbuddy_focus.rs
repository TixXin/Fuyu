use std::{path::Path, time::Duration};

const APPS: [&str; 3] = ["workbuddy", "workbuddyai", "workbuddy ai"];
const SCHEMES: [(&str, &str); 2] = [(".workbuddy", "workbuddy"), (".workbuddy-ai", "workbuddy-ai")];
const WAKE_POLLS: usize = 15;
const WAKE_POLL_INTERVAL: Duration = Duration::from_millis(200);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Missing {
    NotRunning,
    Hidden,
}

impl Missing {
    pub(super) fn of(running: bool) -> Self {
        if running {
            Missing::Hidden
        } else {
            Missing::NotRunning
        }
    }

    pub(super) fn reason(self) -> &'static str {
        match self {
            Missing::NotRunning => "notRunning",
            Missing::Hidden => "hidden",
        }
    }
}

pub(super) fn apps(running: Option<String>) -> Vec<String> {
    let mut apps: Vec<String> = running.into_iter().collect();
    for app in APPS {
        if !apps.iter().any(|known| known == app) {
            apps.push(app.to_string());
        }
    }
    apps
}

pub(super) fn session_link(home_dir: &Path, session_id: &str) -> Option<String> {
    if session_id.is_empty() || !session_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return None;
    }
    let file = format!("{session_id}.jsonl");
    SCHEMES
        .iter()
        .find(|(dir, _)| {
            std::fs::read_dir(home_dir.join(dir).join("projects"))
                .into_iter()
                .flatten()
                .flatten()
                .any(|project| project.path().join(&file).is_file())
        })
        .map(|(_, scheme)| format!("{scheme}://chat/{session_id}"))
}

pub(super) fn open_session(link: &str) -> bool {
    #[cfg(windows)]
    crate::win32::window::allow_set_foreground_window(u32::MAX);
    tauri_plugin_opener::open_url(link, None::<&str>).is_ok()
}

pub(super) fn wake_and_find<T>(wake: impl FnOnce() -> bool, mut find: impl FnMut() -> Option<T>, mut wait: impl FnMut()) -> Option<T> {
    if !wake() {
        return None;
    }
    (0..WAKE_POLLS).find_map(|_| {
        wait();
        find()
    })
}

pub(super) fn wait_for_window() {
    std::thread::sleep(WAKE_POLL_INTERVAL);
}

#[cfg(windows)]
pub(super) fn wake_main_window() -> bool {
    let Some(exe) = crate::platform::process::running_executable(&super::workbuddy::EXES) else {
        return false;
    };
    crate::win32::window::allow_set_foreground_window(u32::MAX);
    std::process::Command::new(exe).spawn().is_ok()
}

#[cfg(not(windows))]
pub(super) fn wake_main_window() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent_status::window_focus::{preferred_window, SessionHints, WindowCandidate};

    #[test]
    fn tries_the_running_program_first_then_every_known_name() {
        assert_eq!(apps(Some("workbuddy".into())), ["workbuddy", "workbuddyai", "workbuddy ai"]);
        assert_eq!(apps(Some("workbuddy ai".into())), ["workbuddy ai", "workbuddy", "workbuddyai"]);
        assert_eq!(apps(None), ["workbuddy", "workbuddyai", "workbuddy ai"]);
    }

    #[test]
    fn finds_a_workbuddy_window_even_when_the_running_check_missed_it() {
        let window = |title: &str, app: &str| WindowCandidate { title: title.into(), app: app.into() };
        let windows = [window("main.rs - shop - Visual Studio Code", "code"), window("WorkBuddy", "workbuddy")];
        let hints = SessionHints { folder: Some("shop"), ..SessionHints::default() };
        assert_eq!(preferred_window(&windows, &hints, &apps(None)), Some(1));
        assert_eq!(preferred_window(&windows[..1], &hints, &apps(None)), None);
    }

    #[test]
    fn wakes_the_app_and_waits_until_its_window_shows() {
        let mut polls = 0;
        let mut waits = 0;
        let found = wake_and_find(
            || true,
            || {
                polls += 1;
                (polls == 3).then_some("window")
            },
            || waits += 1,
        );
        assert_eq!((found, polls, waits), (Some("window"), 3, 3));
    }

    #[test]
    fn gives_up_when_the_app_cannot_be_woken_or_never_shows_a_window() {
        let mut polls = 0;
        assert_eq!(wake_and_find(|| false, || -> Option<()> { polls += 1; Some(()) }, || {}), None);
        assert_eq!(polls, 0);
        assert_eq!(wake_and_find(|| true, || -> Option<()> { polls += 1; None }, || {}), None);
        assert_eq!(polls, WAKE_POLLS);
    }

    #[test]
    fn links_a_session_to_the_edition_whose_folder_holds_it() {
        let home = std::env::temp_dir().join(format!("fuyu-workbuddy-link-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        let project = |dir: &str| home.join(dir).join("projects").join("Users-me-shop");
        std::fs::create_dir_all(project(".workbuddy")).unwrap();
        std::fs::create_dir_all(project(".workbuddy-ai")).unwrap();
        std::fs::write(project(".workbuddy").join("cn-1.jsonl"), "").unwrap();
        std::fs::write(project(".workbuddy-ai").join("ac1de220-1ff3.jsonl"), "").unwrap();
        assert_eq!(session_link(&home, "cn-1").as_deref(), Some("workbuddy://chat/cn-1"));
        assert_eq!(session_link(&home, "ac1de220-1ff3").as_deref(), Some("workbuddy-ai://chat/ac1de220-1ff3"));
        assert_eq!(session_link(&home, "gone"), None);
        assert_eq!(session_link(&home, ""), None);
        assert_eq!(session_link(&home, "../x?y"), None);
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn says_why_the_window_was_not_found() {
        assert_eq!(Missing::of(false).reason(), "notRunning");
        assert_eq!(Missing::of(true).reason(), "hidden");
    }
}
