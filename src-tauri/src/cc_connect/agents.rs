use std::{
    env,
    ffi::OsString,
    path::{Path, PathBuf},
};

use serde::Serialize;

pub(super) struct Agent {
    pub(super) kind: &'static str,
    pub(super) label: &'static str,
    pub(super) command: &'static str,
    pub(super) mode: Option<&'static str>,
}

pub(super) const AGENTS: [Agent; 7] = [
    Agent { kind: "claudecode", label: "Claude Code", command: "claude", mode: Some("default") },
    Agent { kind: "codex", label: "Codex", command: "codex", mode: Some("suggest") },
    Agent { kind: "copilot", label: "GitHub Copilot CLI", command: "copilot", mode: None },
    Agent { kind: "opencode", label: "opencode", command: "opencode", mode: None },
    Agent { kind: "qoder", label: "Qoder CLI", command: "qodercli", mode: None },
    Agent { kind: "kimi", label: "Kimi Code", command: "kimi", mode: None },
    Agent { kind: "antigravity", label: "Antigravity", command: "agy", mode: None },
];

pub(super) fn find(kind: &str) -> Option<&'static Agent> {
    AGENTS.iter().find(|agent| agent.kind == kind)
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FoundAgent {
    agent: &'static str,
    label: &'static str,
    path: String,
}

impl FoundAgent {
    fn of(agent: &'static Agent, path: String) -> Self {
        Self { agent: agent.kind, label: agent.label, path }
    }
}

pub(super) fn find_local() -> Vec<FoundAgent> {
    let dirs = search_dirs(env::var_os("PATH"), crate::system::windows_home_dir().ok());
    let extensions = extensions(env::var_os("PATHEXT"));
    AGENTS
        .iter()
        .filter_map(|agent| on_path(&dirs, &extensions, agent.command, Path::is_file).map(|path| FoundAgent::of(agent, path.display().to_string())))
        .collect()
}

fn search_dirs(path: Option<OsString>, home: Option<PathBuf>) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = path.map(|paths| env::split_paths(&paths).collect()).unwrap_or_default();
    let mut extra: Vec<PathBuf> = home.map(|home| vec![home.join(".local").join("bin"), home.join(".bun").join("bin"), home.join(".npm-global").join("bin")]).unwrap_or_default();
    if cfg!(target_os = "macos") {
        extra.extend(["/opt/homebrew/bin", "/usr/local/bin"].map(PathBuf::from));
    }
    for dir in extra {
        if !dirs.contains(&dir) {
            dirs.push(dir);
        }
    }
    dirs
}

fn extensions(pathext: Option<OsString>) -> Vec<String> {
    if !cfg!(windows) {
        return vec![String::new()];
    }
    let list = pathext.map(|value| value.to_string_lossy().into_owned()).unwrap_or_else(|| ".COM;.EXE;.BAT;.CMD".to_string());
    list.split(';').map(str::trim).filter(|ext| ext.starts_with('.')).map(str::to_ascii_lowercase).collect()
}

fn on_path(dirs: &[PathBuf], extensions: &[String], command: &str, is_file: impl Fn(&Path) -> bool) -> Option<PathBuf> {
    dirs.iter().flat_map(|dir| extensions.iter().map(move |ext| dir.join(format!("{command}{ext}")))).find(|path| is_file(path))
}

pub(super) fn remote_script() -> String {
    let commands: Vec<&str> = AGENTS.iter().map(|agent| agent.command).collect();
    format!(
        "PATH=\"$HOME/.local/bin:$PATH\"\nfor c in {}; do\n  p=$(command -v \"$c\" 2>/dev/null)\n  case $p in /*) printf 'A %s %s\\n' \"$c\" \"$p\" ;; esac\ndone\n",
        commands.join(" ")
    )
}

pub(super) fn parse_remote(output: &str) -> Vec<FoundAgent> {
    let found: Vec<(&str, &str)> = output
        .lines()
        .filter_map(|line| line.strip_prefix("A ")?.split_once(' '))
        .map(|(command, path)| (command, path.trim()))
        .filter(|(_, path)| path.starts_with('/'))
        .collect();
    AGENTS
        .iter()
        .filter_map(|agent| found.iter().find(|(command, _)| *command == agent.command).map(|(_, path)| FoundAgent::of(agent, (*path).to_string())))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{extensions, find, on_path, parse_remote, remote_script, search_dirs, AGENTS};
    use std::path::{Path, PathBuf};

    #[test]
    fn every_agent_is_known_by_its_cc_connect_type_and_claude_code_and_codex_lead() {
        assert_eq!(AGENTS[0].kind, "claudecode");
        assert_eq!(AGENTS[1].kind, "codex");
        assert_eq!(find("qoder").map(|agent| agent.command), Some("qodercli"));
        assert!(find("gemini").is_none());
    }

    #[test]
    fn the_first_folder_holding_the_command_wins_and_home_folders_come_last() {
        let dirs = search_dirs(Some("/a:/b".into()), Some(PathBuf::from("/home/me")));
        if cfg!(windows) {
            return;
        }
        assert_eq!(&dirs[..3], [PathBuf::from("/a"), PathBuf::from("/b"), PathBuf::from("/home/me/.local/bin")]);
        let have = |path: &Path| path == Path::new("/b/claude") || path == Path::new("/home/me/.local/bin/claude");
        assert_eq!(on_path(&dirs, &extensions(None), "claude", have), Some(PathBuf::from("/b/claude")));
        assert_eq!(on_path(&dirs, &extensions(None), "codex", have), None);
    }

    #[test]
    #[cfg(windows)]
    fn windows_tries_each_pathext() {
        assert_eq!(extensions(Some(".EXE;.CMD;bad".into())), [".exe", ".cmd"]);
        let dirs = [PathBuf::from(r"C:\npm")];
        let have = |path: &Path| path == Path::new(r"C:\npm\codex.cmd");
        assert_eq!(on_path(&dirs, &extensions(Some(".EXE;.CMD".into())), "codex", have), Some(PathBuf::from(r"C:\npm\codex.cmd")));
    }

    #[test]
    fn the_remote_script_asks_for_every_command_and_the_answer_keeps_the_list_order() {
        let script = remote_script();
        assert!(script.contains("for c in claude codex copilot opencode qodercli kimi agy; do"));
        let found = parse_remote("A codex /home/me/.npm/bin/codex\nA claude /home/me/.local/bin/claude\nA kimi alias kimi=x\nnoise\n");
        let names: Vec<_> = found.iter().map(|agent| (agent.agent, agent.path.as_str())).collect();
        assert_eq!(names, [("claudecode", "/home/me/.local/bin/claude"), ("codex", "/home/me/.npm/bin/codex")]);
    }
}
