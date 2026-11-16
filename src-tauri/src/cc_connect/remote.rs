use serde::Serialize;

use super::{
    agents, chats, check_message, config_file::NewProject, install, join_error, remote_install, remote_project, remote_run,
    script::{base64_word, decode, find_exe, in_login_shell, sh_quote, NOT_FOUND},
};
use crate::agent_status::{remote_fetch::run_ssh, remote_hosts};
use crate::user_error::UserError;

const MAX_FILE_BYTES: u32 = 4 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteStatus {
    exe: Option<String>,
    running: bool,
    projects: Vec<chats::Project>,
}

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

pub(super) async fn detect_agents(host: String) -> Result<Vec<agents::FoundAgent>, UserError> {
    let target = target(&host, None)?;
    tauri::async_runtime::spawn_blocking(move || {
        let output = run_ssh(&target, &in_login_shell(&agents::remote_script())).map_err(|error| ssh_error(&host, error))?;
        Ok(agents::parse_remote(&String::from_utf8_lossy(&output)))
    })
    .await
    .map_err(join_error)?
}

#[tauri::command]
pub async fn install_cc_connect_remote(host: String, path: Option<String>) -> Result<remote_install::RemoteInstall, UserError> {
    let target = target(&host, path.as_deref())?;
    let (probe_target, probe_host) = (target.clone(), host.clone());
    let probe = tauri::async_runtime::spawn_blocking(move || {
        run_ssh(&probe_target, &remote_install::probe_script(path.as_deref())).map_err(|error| ssh_error(&probe_host, error))
    })
    .await
    .map_err(join_error)??;
    let probe = remote_install::parse_probe(&String::from_utf8_lossy(&probe));
    if let Some(already) = probe.already() {
        return Ok(already);
    }
    let client = install::client()?;
    let release = install::latest(&client).await?;
    let name = remote_install::asset_name(&release.tag_name, &probe)?;
    let package = install::download(&client, &release, &name).await?;
    tauri::async_runtime::spawn_blocking(move || {
        let program = remote_install::program_in(&package.bytes)?;
        let output = run_ssh(&target, &remote_install::upload_script(&package, &program)).map_err(|error| ssh_error(&host, error))?;
        remote_install::parse_upload(&host, &String::from_utf8_lossy(&output))
    })
    .await
    .map_err(join_error)?
}

#[tauri::command]
pub async fn add_cc_connect_remote_project(
    host: String,
    project: String,
    agent: String,
    work_dir: String,
    platform: String,
    token: String,
    allow_from: String,
) -> Result<(), UserError> {
    let target = target(&host, None)?;
    tauri::async_runtime::spawn_blocking(move || {
        let new = NewProject {
            name: project.trim(),
            agent: &agent,
            work_dir: work_dir.trim(),
            platform: &platform,
            token: token.trim(),
            allow_from: allow_from.trim(),
            proxy: None,
        };
        let output = run_ssh(&target, &remote_project::read_script(new.work_dir)).map_err(|error| ssh_error(&host, error).redact(new.token))?;
        let seen = remote_project::parse_read(&String::from_utf8_lossy(&output));
        let now = chrono::Local::now();
        let block = remote_project::block_for(&seen, &new, &now.format("%Y-%m-%d").to_string())?;
        let script = remote_project::write_script(&seen, new.name, &block, &now.format("%Y%m%d-%H%M%S").to_string());
        let output = run_ssh(&target, &script).map_err(|error| ssh_error(&host, error).redact(new.token))?;
        remote_project::parse_write(&host, &String::from_utf8_lossy(&output))
    })
    .await
    .map_err(join_error)?
}

#[tauri::command]
pub async fn restart_cc_connect_remote(host: String, path: Option<String>) -> Result<(), UserError> {
    let target = target(&host, path.as_deref())?;
    let proxy = crate::ssh_tunnel::remote_proxy(&host);
    tauri::async_runtime::spawn_blocking(move || {
        let output = run_ssh(&target, &remote_run::restart_script(path.as_deref(), proxy.as_deref())).map_err(|error| ssh_error(&host, error))?;
        remote_run::parse_restart(&host, &String::from_utf8_lossy(&output))
    })
    .await
    .map_err(join_error)?
}

pub(super) fn target(host: &str, path: Option<&str>) -> Result<remote_hosts::SshTarget, UserError> {
    if !remote_hosts::is_valid_alias(host) {
        return Err(UserError::new("ccConnect.host", format!("\"{host}\" is not an SSH host name.")).arg("host", host));
    }
    if path.is_some_and(|path| path.len() > 1024 || path.chars().any(char::is_control)) {
        return Err(UserError::new("ccConnect.notAt", "cc-connect is not at that path.").arg("path", path.unwrap_or_default()));
    }
    let app_dir = super::app_dir().ok_or_else(|| UserError::new("ccConnect.notReady", "cc-connect is not ready yet."))?;
    Ok(remote_hosts::target(app_dir, host))
}

pub(super) fn ssh_error(host: &str, error: String) -> UserError {
    UserError::new("ccConnect.remoteFailed", format!("cc-connect on {host} could not be reached.")).arg("host", host).detail(error)
}

fn status_script(path: Option<&str>) -> String {
    let mut script = find_exe(path);
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
    let mut script = find_exe(path);
    script.push_str(&format!("[ -n \"$exe\" ] || {{ echo {NOT_FOUND}; exit 0; }}\n"));
    script.push_str("set --\ncommand -v timeout >/dev/null 2>&1 && set -- timeout 20\n");
    script.push_str(&format!(
        "printf '%s' {} | base64 -d | \"$@\" \"$exe\" send -p {} -s {} --stdin\n",
        base64_word(text.as_bytes()),
        sh_quote(project),
        sh_quote(session_key),
    ));
    script
}

fn parse_status(output: &str) -> RemoteStatus {
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
    use super::{parse_status, send_script};
    use base64::{engine::general_purpose::STANDARD, Engine};

    #[test]
    fn the_text_reaches_cc_connect_as_base64_and_never_as_shell() {
        let script = send_script(Some("/opt/cc-connect"), "pc", "telegram:1:1", "$(rm -rf ~) `x` 'y'");
        assert!(script.starts_with("exe='/opt/cc-connect'\n"));
        assert!(!script.contains("rm -rf"));
        assert!(script.contains(&format!("printf '%s' '{}' | base64 -d", STANDARD.encode("$(rm -rf ~) `x` 'y'"))));
        assert!(script.contains("send -p 'pc' -s 'telegram:1:1' --stdin"));
    }

    #[test]
    fn only_names_and_types_of_the_config_come_back() {
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
