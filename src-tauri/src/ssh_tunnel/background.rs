use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use serde_json::{Map, Value};

use crate::plugin_kernel::builtins::{self, Background};

pub(super) const PLUGIN_ID: &str = "ssh-tunnel";
pub(super) const TUNNELS: &str = "tunnels";

struct Tunnels {
    on: AtomicBool,
}

impl Background for Tunnels {
    fn start(&self) -> Result<(), String> {
        self.on.store(true, Ordering::SeqCst);
        super::start(&builtins::config(PLUGIN_ID))
    }

    fn stop(&self) {
        self.on.store(false, Ordering::SeqCst);
        super::stop();
    }

    fn running(&self) -> bool {
        super::running()
    }

    fn configure(&self, config: &Map<String, Value>) {
        if self.on.load(Ordering::SeqCst) {
            if let Err(error) = super::start(config) {
                eprintln!("ssh-tunnel did not take the new settings: {error}");
            }
        }
    }
}

pub(super) fn init() {
    if let Err(error) = builtins::register(PLUGIN_ID, TUNNELS, Arc::new(Tunnels { on: AtomicBool::new(false) })) {
        eprintln!("the SSH proxy tunnel is unavailable: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::{PLUGIN_ID, TUNNELS};

    #[test]
    fn tunnels_is_the_background_listed_for_ssh_tunnel() {
        let catalog = crate::plugin_kernel::builtins::catalog();
        let tunnel = catalog.iter().find(|plugin| plugin.id == PLUGIN_ID).expect("ssh-tunnel is a built-in plugin");
        assert_eq!(tunnel.background.as_deref(), Some(&[TUNNELS.to_owned()][..]));
    }
}
