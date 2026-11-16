use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use serde_json::{Map, Value};

use crate::plugin_kernel::builtins::{self, Background};

pub(crate) const PLUGIN_ID: &str = "cc-connect";
pub(crate) const RUNNER: &str = "runner";

struct Runner {
    on: AtomicBool,
}

impl Background for Runner {
    fn start(&self) -> Result<(), String> {
        self.on.store(true, Ordering::SeqCst);
        super::local::apply(&builtins::config(PLUGIN_ID))
    }

    fn stop(&self) {
        self.on.store(false, Ordering::SeqCst);
        super::local::stop();
    }

    fn running(&self) -> bool {
        super::local::running()
    }

    fn configure(&self, config: &Map<String, Value>) {
        if self.on.load(Ordering::SeqCst) {
            if let Err(error) = super::local::apply(config) {
                eprintln!("cc-connect did not take the new settings: {error}");
            }
        }
    }
}

pub(super) fn init() {
    if let Err(error) = builtins::register(PLUGIN_ID, RUNNER, Arc::new(Runner { on: AtomicBool::new(false) })) {
        eprintln!("the cc-connect runner is unavailable: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::{PLUGIN_ID, RUNNER};

    #[test]
    fn the_runner_is_the_background_listed_for_cc_connect() {
        let catalog = crate::plugin_kernel::builtins::catalog();
        let cc = catalog.iter().find(|plugin| plugin.id == PLUGIN_ID).expect("cc-connect is a built-in plugin");
        assert_eq!(cc.background.as_deref(), Some(&[RUNNER.to_owned()][..]));
    }
}
