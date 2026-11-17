use std::sync::Arc;

use serde_json::{Map, Value};

use crate::plugin_kernel::builtins::{self, Background};

pub(crate) const PLUGIN_ID: &str = "local-api";
pub(crate) const SERVER: &str = "server";
pub(crate) const ALLOW_WRITE: &str = "allowWrite";

pub(super) fn allow_write(config: &Map<String, Value>) -> bool {
    config.get(ALLOW_WRITE).and_then(Value::as_bool).unwrap_or(false)
}

struct Server;

impl Background for Server {
    fn start(&self) -> Result<(), String> {
        super::start(allow_write(&builtins::config(PLUGIN_ID))).map(|_| ())
    }

    fn stop(&self) {
        if let Err(error) = super::stop() {
            eprintln!("the local API did not note that it stopped: {error}");
        }
    }

    fn running(&self) -> bool {
        super::server::running_port().is_some()
    }

    fn configure(&self, config: &Map<String, Value>) {
        if let Err(error) = super::set_allow_write(allow_write(config)) {
            eprintln!("the local API did not take the new settings: {error}");
        }
    }
}

pub(super) fn init() {
    if let Err(error) = builtins::register(PLUGIN_ID, SERVER, Arc::new(Server)) {
        eprintln!("the local API is unavailable: {error}");
    }
}
