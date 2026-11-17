use serde_json::{Map, Value};

use crate::plugin_kernel::{
    builtins::{self, Background},
    worker::Worker,
};

pub(crate) const PLUGIN_ID: &str = "messages";
pub(crate) const QQ: &str = "qq";
pub(crate) const WECHAT: &str = "wechat";
pub(crate) const MAIL: &str = "mail";

pub(crate) fn source_on(config: &Map<String, Value>, source: &str) -> bool {
    matches!(config.get(source), Some(Value::Bool(true)))
}

type Apply = Box<dyn Fn(bool) + Send + Sync>;
type Cleanup = Box<dyn Fn() + Send + Sync>;
type Running = Box<dyn Fn() -> bool + Send + Sync>;

#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) struct SourceWorker {
    source: &'static str,
    worker: Worker,
    apply: Apply,
    after_stop: Option<Cleanup>,
}

#[cfg_attr(not(windows), allow(dead_code))]
impl SourceWorker {
    pub(crate) fn new(
        source: &'static str,
        worker: Worker,
        apply: impl Fn(bool) + Send + Sync + 'static,
    ) -> Self {
        Self {
            source,
            worker,
            apply: Box::new(apply),
            after_stop: None,
        }
    }

    pub(crate) fn after_stop(mut self, cleanup: impl Fn() + Send + Sync + 'static) -> Self {
        self.after_stop = Some(Box::new(cleanup));
        self
    }

    fn follow(&self, config: &Map<String, Value>) -> Result<(), String> {
        let on = source_on(config, self.source);
        (self.apply)(on);
        if on {
            self.worker.start()
        } else {
            self.halt();
            Ok(())
        }
    }

    fn halt(&self) {
        self.worker.stop();
        if let Some(cleanup) = &self.after_stop {
            cleanup();
        }
    }
}

impl Background for SourceWorker {
    fn start(&self) -> Result<(), String> {
        self.follow(&builtins::config(PLUGIN_ID))
    }

    fn stop(&self) {
        (self.apply)(false);
        self.halt();
    }

    fn running(&self) -> bool {
        self.worker.running()
    }

    fn configure(&self, config: &Map<String, Value>) {
        if !builtins::is_enabled(PLUGIN_ID) {
            return;
        }
        if let Err(error) = self.follow(config) {
            eprintln!("[plugins-v3] could not start {} of {PLUGIN_ID}: {error}", self.source);
        }
    }
}

pub(crate) struct SourceSwitch {
    source: &'static str,
    apply: Apply,
    running: Running,
}

impl SourceSwitch {
    pub(crate) fn new(
        source: &'static str,
        apply: impl Fn(bool) + Send + Sync + 'static,
        running: impl Fn() -> bool + Send + Sync + 'static,
    ) -> Self {
        Self {
            source,
            apply: Box::new(apply),
            running: Box::new(running),
        }
    }

    fn follow(&self, config: &Map<String, Value>) {
        (self.apply)(source_on(config, self.source));
    }
}

impl Background for SourceSwitch {
    fn start(&self) -> Result<(), String> {
        self.follow(&builtins::config(PLUGIN_ID));
        Ok(())
    }

    fn stop(&self) {
        (self.apply)(false);
    }

    fn running(&self) -> bool {
        (self.running)()
    }

    fn configure(&self, config: &Map<String, Value>) {
        if !builtins::is_enabled(PLUGIN_ID) {
            return;
        }
        self.follow(config);
    }
}

pub(crate) fn register(name: &'static str, background: impl Background + 'static) {
    if let Err(error) = builtins::register(PLUGIN_ID, name, std::sync::Arc::new(background)) {
        eprintln!("[plugins-v3] {error}");
    }
}

#[cfg(test)]
mod tests {
    use std::{
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        },
        time::Duration,
    };

    use serde_json::{json, Map, Value};

    use super::*;

    fn config(value: Value) -> Map<String, Value> {
        value.as_object().cloned().unwrap_or_default()
    }

    #[test]
    fn the_three_sources_are_the_background_listed_for_messages() {
        let catalog = builtins::catalog();
        let plugin = catalog.iter().find(|plugin| plugin.id == PLUGIN_ID).expect("messages is a built-in plugin");
        assert_eq!(plugin.background.as_deref(), Some(&[QQ.to_owned(), WECHAT.to_owned(), MAIL.to_owned()][..]));
    }

    #[test]
    fn a_source_is_on_only_when_its_switch_says_true() {
        assert!(source_on(&config(json!({ "qq": true })), QQ));
        assert!(!source_on(&config(json!({ "qq": false })), QQ));
        assert!(!source_on(&config(json!({})), QQ), "a switch the window has not migrated yet keeps the source off");
        assert!(!source_on(&config(json!({ "qq": "true" })), QQ));
    }

    #[test]
    fn the_worker_follows_the_source_switch_and_stops_with_the_plugin() {
        let on = Arc::new(AtomicBool::new(false));
        let cleaned = Arc::new(AtomicBool::new(false));
        let seen = on.clone();
        let saw_cleanup = cleaned.clone();
        let source = SourceWorker::new(QQ, Worker::new("test-source", |stop| while !stop.wait(Duration::from_secs(30)) {}), move |value| seen.store(value, Ordering::SeqCst))
            .after_stop(move || saw_cleanup.store(true, Ordering::SeqCst));
        source.follow(&config(json!({ "qq": true }))).unwrap();
        assert!(source.running());
        assert!(on.load(Ordering::SeqCst));
        source.follow(&config(json!({ "qq": false }))).unwrap();
        assert!(!source.running());
        assert!(!on.load(Ordering::SeqCst));
        assert!(cleaned.load(Ordering::SeqCst));
        source.follow(&config(json!({ "qq": true }))).unwrap();
        assert!(source.running());
        source.stop();
        assert!(!source.running());
        assert!(!on.load(Ordering::SeqCst));
    }

    #[test]
    fn shared_source_switch_reports_hub_running_and_turns_off_on_stop() {
        let active = Arc::new(AtomicBool::new(false));
        let applied = active.clone();
        let running = active.clone();
        let switch = SourceSwitch::new(
            QQ,
            move |value| applied.store(value, Ordering::SeqCst),
            move || running.load(Ordering::SeqCst),
        );
        switch.follow(&config(json!({ "qq": true })));
        assert!(switch.running());
        switch.follow(&config(json!({ "qq": false })));
        assert!(!switch.running());
        switch.follow(&config(json!({ "qq": true })));
        assert!(switch.running());
        switch.stop();
        assert!(!switch.running());
    }
}
