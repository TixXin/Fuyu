#[cfg(target_os = "macos")]
use std::{
    env,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

#[cfg(any(target_os = "macos", test))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct TmuxPane {
    pub(super) session: String,
    pub(super) window_id: String,
    pub(super) pane_id: String,
}

#[cfg(any(target_os = "macos", test))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct TmuxClient {
    pub(super) pid: u32,
    pub(super) tty: Option<String>,
}

#[cfg(any(target_os = "macos", test))]
pub(super) fn socket_from_env(value: &str) -> Option<&str> {
    let socket = value.split(',').next()?.trim();
    (socket.len() > 1 && socket.starts_with('/')).then_some(socket)
}

#[cfg(any(target_os = "macos", test))]
pub(super) fn is_window_id(id: &str) -> bool {
    id.strip_prefix('@')
        .is_some_and(|rest| !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()))
}

#[cfg(any(target_os = "macos", test))]
pub(super) fn is_pane_id(id: &str) -> bool {
    id.strip_prefix('%')
        .is_some_and(|rest| !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()))
}

#[cfg(any(target_os = "macos", test))]
pub(super) fn find_pane(output: &str, tty: Option<&str>, chain: &[u32]) -> Option<TmuxPane> {
    for line in output.lines() {
        let mut parts = line.split('\t');
        let (Some(pane_tty), Some(session), Some(window_id), Some(pane_id), Some(pane_pid)) = (
            parts.next(),
            parts.next(),
            parts.next(),
            parts.next(),
            parts.next(),
        ) else {
            continue;
        };
        if session.is_empty() || !is_window_id(window_id) || !is_pane_id(pane_id) {
            continue;
        }
        let tty_matches = tty.is_some_and(|wanted| !pane_tty.is_empty() && pane_tty == wanted);
        let pid_matches = pane_pid
            .trim()
            .parse::<u32>()
            .ok()
            .is_some_and(|pid| chain.contains(&pid));
        if tty_matches || pid_matches {
            return Some(TmuxPane {
                session: session.to_string(),
                window_id: window_id.to_string(),
                pane_id: pane_id.to_string(),
            });
        }
    }
    None
}

#[cfg(any(target_os = "macos", test))]
pub(super) fn find_client(output: &str, session: &str) -> Option<TmuxClient> {
    for line in output.lines() {
        let mut parts = line.split('\t');
        let (Some(client_session), Some(pid), Some(tty)) =
            (parts.next(), parts.next(), parts.next())
        else {
            continue;
        };
        if client_session != session {
            continue;
        }
        let Ok(pid) = pid.trim().parse::<u32>() else {
            continue;
        };
        if pid == 0 {
            continue;
        }
        let tty = Some(tty.trim())
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        return Some(TmuxClient { pid, tty });
    }
    None
}

#[cfg(target_os = "macos")]
pub(super) struct TmuxTarget {
    socket: Option<PathBuf>,
    cli: PathBuf,
    window_id: String,
    pane_id: String,
    pub(super) client_chain: Vec<u32>,
    pub(super) client_tty: Option<String>,
}

#[cfg(target_os = "macos")]
fn find_cli() -> Option<PathBuf> {
    let from_path = env::var_os("PATH")
        .into_iter()
        .flat_map(|value| env::split_paths(&value).collect::<Vec<_>>())
        .map(|dir| dir.join("tmux"));
    let fallbacks = [
        PathBuf::from("/opt/homebrew/bin/tmux"),
        PathBuf::from("/usr/local/bin/tmux"),
        PathBuf::from("/usr/bin/tmux"),
    ];
    from_path.chain(fallbacks).find(|path| path.is_file())
}

#[cfg(target_os = "macos")]
fn run(cli: &Path, socket: Option<&Path>, args: &[&str]) -> Option<String> {
    let mut command = Command::new(cli);
    if let Some(socket) = socket {
        command.arg("-S").arg(socket);
    }
    let output = command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}

#[cfg(target_os = "macos")]
pub(super) fn resolve(chain: &[u32]) -> Option<TmuxTarget> {
    if chain.is_empty() {
        return None;
    }
    let socket = chain
        .iter()
        .find_map(|&pid| crate::platform::process_env::environment_variable(pid, "TMUX"))
        .and_then(|value| socket_from_env(&value).map(PathBuf::from))
        .filter(|path| path.exists());
    let in_chain = chain.iter().any(|&pid| {
        crate::platform::process::image_path(pid)
            .is_some_and(|path| super::window_focus::app_name(&path) == "tmux")
    });
    if socket.is_none() && !in_chain {
        return None;
    }
    let cli = find_cli()?;
    let tty = chain
        .iter()
        .find_map(|&pid| crate::macos::proc_info::tty_path(pid));
    let panes = run(
        &cli,
        socket.as_deref(),
        &[
            "list-panes",
            "-a",
            "-F",
            "#{pane_tty}\t#{session_name}\t#{window_id}\t#{pane_id}\t#{pane_pid}",
        ],
    )?;
    let pane = find_pane(&panes, tty.as_deref(), chain)?;
    let client = run(
        &cli,
        socket.as_deref(),
        &[
            "list-clients",
            "-F",
            "#{client_session}\t#{client_pid}\t#{client_tty}",
        ],
    )
    .and_then(|clients| find_client(&clients, &pane.session));
    let client_chain = match &client {
        Some(client) => super::session_process::ancestor_chain(
            client.pid,
            &crate::platform::process_tree::parent_process_ids(),
            crate::platform::process_times::start_time,
        ),
        None => Vec::new(),
    };
    Some(TmuxTarget {
        socket,
        cli,
        window_id: pane.window_id,
        pane_id: pane.pane_id,
        client_chain,
        client_tty: client.and_then(|client| client.tty),
    })
}

#[cfg(target_os = "macos")]
pub(super) fn select(target: &TmuxTarget) -> bool {
    run(
        &target.cli,
        target.socket.as_deref(),
        &[
            "select-window",
            "-t",
            &target.window_id,
            ";",
            "select-pane",
            "-t",
            &target.pane_id,
        ],
    )
    .is_some()
}

#[cfg(not(target_os = "macos"))]
pub(super) struct TmuxTarget {
    pub(super) client_chain: Vec<u32>,
}

#[cfg(not(target_os = "macos"))]
pub(super) fn resolve(_chain: &[u32]) -> Option<TmuxTarget> {
    None
}

#[cfg(not(target_os = "macos"))]
pub(super) fn select(_target: &TmuxTarget) -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_socket_and_validates_tmux_identifiers() {
        assert_eq!(
            socket_from_env("/private/tmp/tmux-501/default,2048,0"),
            Some("/private/tmp/tmux-501/default")
        );
        assert_eq!(socket_from_env("relative/socket,2048,0"), None);
        assert_eq!(socket_from_env(""), None);
        assert!(is_window_id("@12"));
        assert!(!is_window_id("@"));
        assert!(!is_window_id("12"));
        assert!(is_pane_id("%4"));
        assert!(!is_pane_id("%x"));
    }

    #[test]
    fn matches_pane_by_tty_or_process_chain_and_finds_attached_client() {
        let panes = "/dev/ttys010\tmain\t@0\t%0\t410\n/dev/ttys012\twork\t@3\t%7\t520\n/dev/ttys015\tbad\t3\t%9\t600\n";
        assert_eq!(
            find_pane(panes, Some("/dev/ttys012"), &[]),
            Some(TmuxPane {
                session: "work".into(),
                window_id: "@3".into(),
                pane_id: "%7".into(),
            })
        );
        assert_eq!(
            find_pane(panes, None, &[999, 410, 1]),
            Some(TmuxPane {
                session: "main".into(),
                window_id: "@0".into(),
                pane_id: "%0".into(),
            })
        );
        assert_eq!(find_pane(panes, Some("/dev/ttys015"), &[600]), None);

        let clients = "main\t1200\t/dev/ttys001\nwork\t1450\t/dev/ttys004\n";
        assert_eq!(
            find_client(clients, "work"),
            Some(TmuxClient {
                pid: 1450,
                tty: Some("/dev/ttys004".into()),
            })
        );
        assert_eq!(find_client(clients, "detached"), None);
    }
}
