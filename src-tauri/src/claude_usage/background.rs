use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use serde_json::{Map, Value};

use super::UsageConfig;
use crate::plugin_kernel::builtins::{self, Background};

pub(crate) const PLUGIN_ID: &str = "claude-usage";
pub(crate) const POLLER: &str = "poller";
const ASK_ANTHROPIC: &str = "askAnthropic";
const DEFAULT_INTERVAL_MINUTES: u64 = 5;

pub(crate) fn usage_config(config: &Map<String, Value>) -> Option<UsageConfig> {
    if !config.get(ASK_ANTHROPIC).and_then(Value::as_bool).unwrap_or(false) {
        return None;
    }
    let proxy = config
        .get("proxy")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|proxy| !proxy.is_empty())
        .map(str::to_string);
    let interval_minutes = config
        .get("intervalMinutes")
        .and_then(Value::as_f64)
        .filter(|minutes| minutes.is_finite() && *minutes > 0.0)
        .map_or(DEFAULT_INTERVAL_MINUTES, |minutes| minutes.round() as u64);
    Some(UsageConfig { proxy, interval_minutes })
}

fn apply(config: &Map<String, Value>) -> Result<(), String> {
    match usage_config(config) {
        Some(config) => super::start(config),
        None => {
            super::stop();
            Ok(())
        }
    }
}

struct Poller {
    on: AtomicBool,
}

impl Background for Poller {
    fn start(&self) -> Result<(), String> {
        self.on.store(true, Ordering::SeqCst);
        apply(&builtins::config(PLUGIN_ID))
    }

    fn stop(&self) {
        self.on.store(false, Ordering::SeqCst);
        super::stop();
    }

    fn running(&self) -> bool {
        super::current().is_some()
    }

    fn configure(&self, config: &Map<String, Value>) {
        if self.on.load(Ordering::SeqCst) {
            if let Err(error) = apply(config) {
                eprintln!("the Claude usage poller did not take the new settings: {error}");
            }
        }
    }
}

pub(crate) fn init() {
    if let Err(error) = builtins::register(PLUGIN_ID, POLLER, Arc::new(Poller { on: AtomicBool::new(false) })) {
        eprintln!("the Claude usage poller is unavailable: {error}");
    }
}
