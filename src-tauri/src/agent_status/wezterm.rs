use crate::system::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Deserialize;

use super::title::only_tab_titled;
use crate::system::CREATE_NO_WINDOW;
use crate::platform;

#[cfg(windows)]
const GUI_EXE: &str = "wezterm-gui.exe";
#[cfg(not(windows))]
const GUI_EXE: &str = "wezterm-gui";
#[cfg(windows)]
const CLI_EXE: &str = "wezterm.exe";
#[cfg(not(windows))]
const CLI_EXE: &str = "wezterm";

pub(super) fn is_app(app: &str) -> bool {
    matches!(app, "wezterm" | "wezterm-gui")
}

pub(super) fn prefer_apps() -> Vec<String> {
    if cfg!(target_os = "macos") {
        vec!["wezterm".to_string(), "wezterm-gui".to_string()]
    } else {
        vec!["wezterm-gui".to_string(), "wezterm".to_string()]
    }
}

#[derive(Debug, Deserialize)]
struct Pane {
    pane_id: u64,
    title: String,
    #[serde(default)]
    tty_name: Option<String>,
}

fn cli_beside(gui_exe: Option<&Path>) -> Option<PathBuf> {
    let gui = match gui_exe {
        Some(path) => path.to_path_buf(),
        None => PathBuf::from(platform::process::running_executable(&[GUI_EXE])?),
    };
    let cli = gui.with_file_name(CLI_EXE);
    cli.is_file().then_some(cli)
}

fn run(cli: &Path, args: &[&str]) -> Option<Vec<u8>> {
    let output = Command::new(cli).args(args).creation_flags(CREATE_NO_WINDOW).output().ok()?;
    output.status.success().then_some(output.stdout)
}

fn select_pane_id(list: &[u8], tty: Option<&str>, title: Option<&str>) -> Option<u64> {
    let panes: Vec<Pane> = serde_json::from_slice(list).ok()?;
    if let Some(tty) = tty.filter(|tty| !tty.is_empty()) {
        if let Some(pane) = panes.iter().find(|pane| pane.tty_name.as_deref() == Some(tty)) {
            return Some(pane.pane_id);
        }
    }
    let title = title.filter(|title| !title.is_empty())?;
    let titles: Vec<String> = panes.iter().map(|pane| pane.title.clone()).collect();
    only_tab_titled(&titles, title).map(|index| panes[index].pane_id)
}

pub(super) fn activate_pane(gui_exe: Option<&Path>, tty: Option<&str>, title: Option<&str>) -> bool {
    if tty.is_none_or(str::is_empty) && title.is_none_or(str::is_empty) {
        return false;
    }
    let Some(cli) = cli_beside(gui_exe) else {
        return false;
    };
    let Some(pane) = run(&cli, &["cli", "list", "--format", "json"])
        .and_then(|list| select_pane_id(&list, tty, title))
    else {
        return false;
    };
    run(&cli, &["cli", "activate-pane", "--pane-id", &pane.to_string()]).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_pane_is_found_by_tty_first_then_by_the_title_claude_code_set() {
        let list = br#"[
            {"window_id":0,"tab_id":0,"pane_id":0,"title":"\u25d1 Flyisland \u4e0a\u6e38\u4ed3\u5e93","cwd":"file:///F:/x","tty_name":"/dev/ttys002"},
            {"window_id":0,"tab_id":1,"pane_id":4,"title":"\u2733 T7 shield sync","cwd":"file:///F:/y","tty_name":"/dev/ttys007"},
            {"window_id":0,"tab_id":2,"pane_id":5,"title":"scg6928@ln2: ~","cwd":""}
        ]"#;
        assert_eq!(select_pane_id(list, None, Some("Flyisland 上游仓库")), Some(0));
        assert_eq!(select_pane_id(list, None, Some("T7 shield sync")), Some(4));
        assert_eq!(select_pane_id(list, Some("/dev/ttys007"), None), Some(4));
        assert_eq!(select_pane_id(list, None, Some("something else")), None);
        assert_eq!(select_pane_id(b"not json", None, Some("T7 shield sync")), None);
        assert!(is_app("wezterm") && is_app("wezterm-gui") && !is_app("ghostty"));
    }
}
