use std::sync::Arc;

use crate::plugin_kernel::builtins::{self, Background};

use super::{approval_hotkeys, remote_sessions, PLUGIN_ID};

pub(super) const REMOTE: &str = "remote";
pub(super) const HOTKEYS: &str = "hotkeys";

pub(super) fn switched_on() -> bool {
    builtins::is_enabled(PLUGIN_ID)
}

struct Remote;

impl Background for Remote {
    fn start(&self) -> Result<(), String> {
        Ok(())
    }

    fn stop(&self) {
        remote_sessions::close_all();
    }

    fn running(&self) -> bool {
        remote_sessions::connected()
    }
}

struct Hotkeys;

impl Background for Hotkeys {
    fn start(&self) -> Result<(), String> {
        approval_hotkeys::start();
        Ok(())
    }

    fn stop(&self) {
        approval_hotkeys::stop();
    }

    fn running(&self) -> bool {
        approval_hotkeys::running()
    }
}

pub(super) fn register() {
    let items: [(&str, Arc<dyn Background>); 2] = [(REMOTE, Arc::new(Remote)), (HOTKEYS, Arc::new(Hotkeys))];
    for (name, background) in items {
        if let Err(error) = builtins::register(PLUGIN_ID, name, background) {
            eprintln!("[plugins-v3] {error}");
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::agent_approval::background::{APPROVALS, OPENCODE};

    #[test]
    fn the_agent_backgrounds_are_the_ones_listed_for_agents() {
        let catalog = crate::plugin_kernel::builtins::catalog();
        let agents = catalog.iter().find(|plugin| plugin.id == super::PLUGIN_ID).expect("agents is a built-in plugin");
        let listed: Vec<&str> = agents.background.iter().flatten().map(String::as_str).collect();
        assert_eq!(listed, [APPROVALS, OPENCODE, super::REMOTE, super::HOTKEYS]);
    }
}
