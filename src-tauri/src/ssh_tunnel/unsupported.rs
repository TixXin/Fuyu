#[path = "background.rs"]
mod background;

use serde_json::{Map, Value};
use tauri::AppHandle;

pub fn init(_app: &AppHandle) -> Result<(), String> {
    background::init();
    Ok(())
}

pub(super) fn start(_settings: &Map<String, Value>) -> Result<(), String> {
    Ok(())
}

pub(super) fn stop() {}

pub(super) fn running() -> bool {
    false
}

pub(crate) fn remote_proxy(_host: &str) -> Option<String> {
    None
}

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
