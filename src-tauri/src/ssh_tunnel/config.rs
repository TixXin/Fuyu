use std::{fs, path::Path};

use serde::{Deserialize, Serialize};

use crate::{agent_status::remote_hosts::is_valid_alias, user_error::UserError};

pub(super) const FILE_NAME: &str = "ssh-tunnels.json";
const MAX_HOSTS: usize = 32;
pub(super) const MIN_REMOTE_PORT: u16 = 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct HostTunnel {
    pub(super) host: String,
    pub(super) enabled: bool,
    pub(super) remote_port: u16,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct TunnelsFile {
    #[serde(default)]
    hosts: Vec<HostTunnel>,
}

fn is_valid(tunnel: &HostTunnel) -> bool {
    is_valid_alias(&tunnel.host) && tunnel.remote_port >= MIN_REMOTE_PORT
}

pub(super) fn read(app_dir: &Path) -> Vec<HostTunnel> {
    let file = fs::read_to_string(app_dir.join(FILE_NAME))
        .ok()
        .and_then(|text| serde_json::from_str::<TunnelsFile>(&text).ok())
        .unwrap_or_default();
    let mut hosts: Vec<HostTunnel> = Vec::new();
    for tunnel in file.hosts.into_iter().filter(is_valid) {
        if !hosts.iter().any(|known| known.host == tunnel.host) {
            hosts.push(tunnel);
        }
    }
    hosts.truncate(MAX_HOSTS);
    hosts
}

pub(super) fn set(app_dir: &Path, host: &str, enabled: bool, remote_port: Option<u16>) -> Result<Vec<HostTunnel>, UserError> {
    let host = host.trim();
    if !is_valid_alias(host) {
        return Err(UserError::new("remoteHosts.host", format!("\"{host}\" is not an SSH host name.")).arg("host", host));
    }
    let mut hosts = read(app_dir);
    let index = hosts.iter().position(|known| known.host == host);
    match (remote_port, index) {
        (None, _) if enabled => {
            return Err(UserError::new("sshTunnel.needPort", format!("Set the port on {host} first.")).arg("host", host));
        }
        (None, Some(index)) => {
            hosts.remove(index);
        }
        (None, None) => {}
        (Some(port), _) if port < MIN_REMOTE_PORT => {
            return Err(UserError::new("sshTunnel.remotePort", format!("The port on the server must be {MIN_REMOTE_PORT}–65535.")).arg("min", MIN_REMOTE_PORT));
        }
        (Some(remote_port), Some(index)) => hosts[index] = HostTunnel { host: host.to_string(), enabled, remote_port },
        (Some(_), None) if hosts.len() >= MAX_HOSTS => {
            return Err(UserError::new("sshTunnel.tooMany", format!("At most {MAX_HOSTS} hosts.")).arg("max", MAX_HOSTS));
        }
        (Some(remote_port), None) => hosts.push(HostTunnel { host: host.to_string(), enabled, remote_port }),
    }
    let text = serde_json::to_string_pretty(&TunnelsFile { hosts: hosts.clone() })
        .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?;
    fs::create_dir_all(app_dir).map_err(|error| {
        UserError::new("file.create", format!("Could not create {}.", app_dir.display()))
            .arg("path", app_dir.display().to_string())
            .detail(error)
    })?;
    crate::fs_write::replace_file(&app_dir.join(FILE_NAME), text.as_bytes())
        .map_err(|error| UserError::new("sshTunnel.save", "Could not save the SSH tunnels.").detail(error))?;
    Ok(hosts)
}
