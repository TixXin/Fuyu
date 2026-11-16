use std::sync::Arc;

use crate::agent_status::PLUGIN_ID;
use crate::plugin_kernel::{
    builtins::{self, Background},
    worker::Worker,
};

pub(crate) const APPROVALS: &str = "approvals";
pub(crate) const OPENCODE: &str = "opencode";

struct Approvals;

impl Background for Approvals {
    fn start(&self) -> Result<(), String> {
        super::start_serving()
    }

    fn stop(&self) {
        super::stop_serving();
    }

    fn running(&self) -> bool {
        super::serving()
    }
}

pub(super) fn register(opencode: Option<Worker>) {
    let mut items: Vec<(&str, Arc<dyn Background>)> = vec![(APPROVALS, Arc::new(Approvals))];
    if let Some(worker) = opencode {
        items.push((OPENCODE, Arc::new(worker)));
    }
    for (name, background) in items {
        if let Err(error) = builtins::register(PLUGIN_ID, name, background) {
            eprintln!("[plugins-v3] {error}");
        }
    }
}
