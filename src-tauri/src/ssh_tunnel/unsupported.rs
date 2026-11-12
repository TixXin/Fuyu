use serde_json::{Map, Value};
use tauri::AppHandle;

pub fn init(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}

pub(crate) fn start(_settings: &Map<String, Value>) -> Result<(), String> {
    Err(crate::user_error::unsupported().to_string())
}

pub(crate) fn stop() {}

crate::user_error::unsupported_commands!(
    get_ssh_tunnels,
    get_ssh_tunnel_proxy,
    set_ssh_tunnel,
    check_ssh_tunnel_port,
);

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::ssh_tunnel::get_ssh_tunnels,
            crate::ssh_tunnel::get_ssh_tunnel_proxy,
            crate::ssh_tunnel::set_ssh_tunnel,
            crate::ssh_tunnel::check_ssh_tunnel_port,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
