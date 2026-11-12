//! cc-connect on an SSH computer (one of AI Agent → Remote computers), so that computer's sessions
//! are pushed by its own bots, which can take them over there. Each call is one ssh running a short
//! `sh` script: the status finds the program and hands back its session files and, of its config,
//! only the section headers and `name` / `type` lines (base64, one per line) to be read like this
//! computer's; a send pipes the text into `cc-connect send`. Nothing is installed there and no
//! token leaves it.

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;

use super::{chats, check_message, join_error};
use crate::agent_status::{remote_fetch::run_ssh, remote_hosts};
use crate::user_error::UserError;

/// Larger session files are left out of the status: cc-connect's stay well under this.
const MAX_FILE_BYTES: u32 = 4 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteStatus {
    /// The program there; None when it is nowhere to be found.
    exe: Option<String>,
    /// Some cc-connect of this user runs there; `send` only works then.
    running: bool,
    projects: Vec<chats::Project>,
}

/// cc-connect on `host`. `path`: the program there; None finds it.
#[tauri::command]
pub async fn get_cc_connect_remote_status(host: String, path: Option<String>) -> Result<RemoteStatus, UserError> {
    let target = target(&host, path.as_deref())?;
    tauri::async_runtime::spawn_blocking(move || {
        let output = run_ssh(&target, &status_script(path.as_deref())).map_err(|error| ssh_error(&host, error))?;
        Ok(parse_status(&String::from_utf8_lossy(&output)))
    })
    .await
    .map_err(join_error)?
}

/// Sends `text` to one chat of `project` through the cc-connect on `host`.
#[tauri::command]
pub async fn send_cc_connect_remote_message(host: String, path: Option<String>, project: String, session_key: String, text: String) -> Result<(), UserError> {
    let text = check_message(&project, &session_key, &text)?;
    let target = target(&host, path.as_deref())?;
    tauri::async_runtime::spawn_blocking(move || {
        let output = run_ssh(&target, &send_script(path.as_deref(), &project, &session_key, &text)).map_err(|error| ssh_error(&host, error))?;
        if String::from_utf8_lossy(&output).lines().any(|line| line == NOT_FOUND) {
            return Err(UserError::new("ccConnect.remoteNotFound", format!("cc-connect was not found on {host}.")).arg("host", host.as_str()));
        }
        Ok(())
    })
    .await
    .map_err(join_error)?
}

fn target(host: &str, path: Option<&str>) -> Result<remote_hosts::SshTarget, UserError> {
    if !remote_hosts::is_valid_alias(host) {
        return Err(UserError::new("ccConnect.host", format!("\"{host}\" is not an SSH host name.")).arg("host", host));
    }
    if path.is_some_and(|path| path.len() > 1024 || path.chars().any(char::is_control)) {
        return Err(UserError::new("ccConnect.notAt", "cc-connect is not at that path.").arg("path", path.unwrap_or_default()));
    }
    let app_dir = super::app_dir().ok_or_else(|| UserError::new("ccConnect.notReady", "cc-connect is not ready yet."))?;
    Ok(remote_hosts::target(app_dir, host))
}

fn ssh_error(host: &str, error: String) -> UserError {
    UserError::new("ccConnect.remoteFailed", format!("cc-connect on {host} could not be reached.")).arg("host", host).detail(error)
}

/// A word for `sh`: single-quoted, with each `'` closed, escaped and reopened.
fn sh_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', r"'\''"))
}

const NOT_FOUND: &str = "NOTFOUND";

/// Sets `exe` to the program: `path` when given, else the one running for this user, else the one
/// a login shell finds (the PATH the user's profile adds); empty when none can be run.
fn find_script(path: Option<&str>) -> String {
    let mut script = format!("exe={}\n", sh_quote(path.unwrap_or_default().trim()));
    // A quoted `~` is not expanded, so a path typed as `~/…` is made the home folder's here.
    script.push_str(
        r#"case $exe in "~/"*) exe="$HOME/${exe#??}" ;; esac
if [ -z "$exe" ]; then
  pid=$(pgrep -u "$(id -u)" -x cc-connect 2>/dev/null | head -n 1)
  [ -n "$pid" ] && exe=$(readlink "/proc/$pid/exe" 2>/dev/null)
fi
[ -n "$exe" ] || exe=$(bash -lc 'command -v cc-connect' 2>/dev/null </dev/null | tail -n 1)
[ -x "$exe" ] || exe=
"#,
    );
    script
}

fn status_script(path: Option<&str>) -> String {
    let mut script = find_script(path);
    script.push_str(&format!("max={MAX_FILE_BYTES}\n"));
    script.push_str(
        r#"printf 'X %s\n' "$exe"
pgrep -u "$(id -u)" -x cc-connect >/dev/null 2>&1 && echo R
d="$HOME/.cc-connect"
[ -f "$d/config.toml" ] && printf 'C %s\n' "$(grep -E '^[[:space:]]*(\[|name[[:space:]]*=|type[[:space:]]*=)' "$d/config.toml" | base64 | tr -d '\n')"
for f in "$d"/sessions/*.json; do
  [ -f "$f" ] && [ "$(wc -c < "$f")" -le "$max" ] && printf 'S %s %s\n' "${f##*/}" "$(base64 < "$f" | tr -d '\n')"
done
exit 0
"#,
    );
    script
}

fn send_script(path: Option<&str>, project: &str, session_key: &str, text: &str) -> String {
    let mut script = find_script(path);
    script.push_str(&format!("[ -n \"$exe\" ] || {{ echo {NOT_FOUND}; exit 0; }}\n"));
    // `timeout` keeps a stuck cc-connect from holding the ssh; where there is none, it runs without.
    script.push_str("set --\ncommand -v timeout >/dev/null 2>&1 && set -- timeout 20\n");
    script.push_str(&format!(
        "printf '%s' {} | base64 -d | \"$@\" \"$exe\" send -p {} -s {} --stdin\n",
        sh_quote(&STANDARD.encode(text)),
        sh_quote(project),
        sh_quote(session_key),
    ));
    script
}

fn parse_status(output: &str) -> RemoteStatus {
    let decode = |text: &str| STANDARD.decode(text.trim()).ok().map(|bytes| String::from_utf8_lossy(&bytes).into_owned());
    let (mut exe, mut running, mut config, mut files) = (None, false, None, Vec::new());
    for line in output.lines() {
        if let Some(path) = line.strip_prefix("X ") {
            exe = Some(path.trim().to_string()).filter(|path| !path.is_empty());
        } else if line == "R" {
            running = true;
        } else if let Some(text) = line.strip_prefix("C ") {
            config = decode(text);
        } else if let Some((name, text)) = line.strip_prefix("S ").and_then(|rest| rest.rsplit_once(' ')) {
            files.extend(decode(text).map(|text| (name.to_string(), text)));
        }
    }
    RemoteStatus { exe, running, projects: chats::projects_from(files, config.as_deref()) }
}

#[cfg(test)]
mod tests {
    use super::{parse_status, send_script, sh_quote, STANDARD};
    use base64::Engine;

    #[test]
    fn words_are_quoted_for_sh() {
        assert_eq!(sh_quote("a b"), "'a b'");
        assert_eq!(sh_quote("it's $HOME"), r"'it'\''s $HOME'");
    }

    #[test]
    fn the_text_reaches_cc_connect_as_base64_and_never_as_shell() {
        let script = send_script(Some("/opt/cc-connect"), "pc", "telegram:1:1", "$(rm -rf ~) `x` 'y'");
        assert!(script.starts_with("exe='/opt/cc-connect'\n"));
        assert!(!script.contains("rm -rf"));
        assert!(script.contains(&format!("printf '%s' '{}' | base64 -d", STANDARD.encode("$(rm -rf ~) `x` 'y'"))));
        assert!(script.contains("send -p 'pc' -s 'telegram:1:1' --stdin"));
    }

    #[test]
    fn a_home_path_is_expanded_there_and_only_names_and_types_of_the_config_come_back() {
        let find = super::find_script(Some("~/bin/cc-connect"));
        assert!(find.starts_with("exe='~/bin/cc-connect'\ncase $exe in \"~/\"*) exe=\"$HOME/${exe#??}\" ;; esac\n"));
        let status = super::status_script(None);
        assert!(status.contains("grep -E '^[[:space:]]*(\\[|name[[:space:]]*=|type[[:space:]]*=)' \"$d/config.toml\" | base64"));
    }

    #[test]
    fn the_status_reads_the_program_the_config_and_the_session_files() {
        let config = STANDARD.encode("[[projects]]\nname = \"zcm6\"\n[projects.agent]\ntype = \"claudecode\"\n");
        let session = STANDARD.encode(r#"{"user_sessions": {"telegram:1:1": []}}"#);
        let output = format!("X /home/me/cc-connect\nR\nC {config}\nS zcm6_0a1b2c3d.json {session}\nS broken.json !!\n");
        let status = parse_status(&output);
        assert_eq!(status.exe.as_deref(), Some("/home/me/cc-connect"));
        assert!(status.running);
        assert_eq!(status.projects.len(), 1);
        assert_eq!((status.projects[0].name.as_str(), status.projects[0].agent.as_deref()), ("zcm6", Some("claudecode")));
        let none = parse_status("X \n");
        assert!(none.exe.is_none() && !none.running && none.projects.is_empty());
    }
}
