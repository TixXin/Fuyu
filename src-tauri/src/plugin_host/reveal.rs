use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};

use super::{host, lock};
use crate::island;

pub(super) const OPEN_WINDOW: Duration = Duration::from_secs(15);
const MAX_TRACKED_PLUGINS: usize = 128;
const OPEN_VIEW_EVENT: &str = "plugin-open-view";
const USER_ACTIONS: [&str; 6] = ["command", "notification.action", "uri", "view.action", "view.submit", "webview.message"];

fn last_actions() -> &'static Mutex<HashMap<String, Instant>> {
    static LAST: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
    LAST.get_or_init(Mutex::default)
}

fn record_action(actions: &mut HashMap<String, Instant>, plugin_id: &str, now: Instant) {
    actions.retain(|_, last| may_open(Some(*last), now));
    if !actions.contains_key(plugin_id) && actions.len() >= MAX_TRACKED_PLUGINS {
        if let Some(oldest_id) = actions
            .iter()
            .min_by(|left, right| left.1.cmp(right.1).then_with(|| left.0.cmp(right.0)))
            .map(|(id, _)| id.clone())
        {
            actions.remove(&oldest_id);
        }
    }
    actions.insert(plugin_id.to_string(), now);
}

fn has_recent_action(actions: &mut HashMap<String, Instant>, plugin_id: &str, now: Instant) -> bool {
    actions.retain(|_, last| may_open(Some(*last), now));
    actions.contains_key(plugin_id)
}

pub(super) fn note_delivery(plugin_id: &str, method: &str) {
    if USER_ACTIONS.contains(&method) {
        record_action(&mut lock(last_actions()), plugin_id, Instant::now());
    }
}

#[cfg_attr(not(windows), allow(dead_code))]
pub(super) fn note_user_action(plugin_id: &str) {
    record_action(&mut lock(last_actions()), plugin_id, Instant::now());
}

#[cfg_attr(not(windows), allow(dead_code))]
pub(super) fn recently_used(plugin_id: &str) -> bool {
    has_recent_action(&mut lock(last_actions()), plugin_id, Instant::now())
}

pub(super) fn may_open(last: Option<Instant>, now: Instant) -> bool {
    last.is_some_and(|last| now.saturating_duration_since(last) <= OPEN_WINDOW)
}

pub(super) fn open_view(app: &AppHandle, plugin_id: &str, params: &Value) -> Result<Value, (u16, String)> {
    let view_id = params.get("viewId").and_then(Value::as_str).ok_or((400, "Expected { viewId }.".to_string()))?;
    let declared = {
        let host = host().map_err(|error| (500, error))?;
        let installed = lock(&host.installed);
        installed
            .iter()
            .find(|plugin| plugin.folder == plugin_id)
            .and_then(|plugin| plugin.manifest.as_ref().ok())
            .is_some_and(|manifest| manifest.contributes.views.iter().any(|view| view.id == view_id))
    };
    if !declared {
        return Err((404, format!("\"{view_id}\" is not one of the plugin's contributes.views.")));
    }
    if !has_recent_action(&mut lock(last_actions()), plugin_id, Instant::now()) {
        return Err((
            403,
            format!(
                "A plugin opens its page only within {} s of the user using it (a command, a message button, a link or its page).",
                OPEN_WINDOW.as_secs()
            ),
        ));
    }
    island::show_island(app).map_err(|error| (500, error))?;
    app.emit_to(island::WINDOW_LABEL, OPEN_VIEW_EVENT, json!({ "pluginId": plugin_id, "viewId": view_id }))
        .map_err(|error| (500, error.to_string()))?;
    Ok(json!({}))
}

#[cfg(test)]
mod tests {
    use super::{has_recent_action, may_open, record_action, MAX_TRACKED_PLUGINS, OPEN_WINDOW};
    use std::{
        collections::HashMap,
        time::{Duration, Instant},
    };

    #[test]
    fn a_page_opens_only_soon_after_the_user_used_the_plugin() {
        let now = Instant::now() + OPEN_WINDOW * 2;
        assert!(!may_open(None, now), "never used");
        assert!(may_open(Some(now - Duration::from_secs(3)), now));
        assert!(may_open(Some(now - OPEN_WINDOW), now));
        assert!(!may_open(Some(now - OPEN_WINDOW - Duration::from_secs(1)), now));
    }

    #[test]
    fn action_history_prunes_expired_plugins_and_caps_capacity() {
        let mut actions = HashMap::new();
        let t0 = Instant::now();
        record_action(&mut actions, "old", t0);
        assert!(has_recent_action(&mut actions, "old", t0 + Duration::from_secs(2)));

        let expired = t0 + OPEN_WINDOW + Duration::from_secs(1);
        assert!(!has_recent_action(&mut actions, "old", expired));
        assert!(actions.is_empty());

        for index in 0..(MAX_TRACKED_PLUGINS + 4) {
            record_action(&mut actions, &format!("p-{index:03}"), expired + Duration::from_millis(index as u64));
        }
        assert_eq!(actions.len(), MAX_TRACKED_PLUGINS);
        assert!(!actions.contains_key("p-000"));
        assert!(actions.contains_key(&format!("p-{:03}", MAX_TRACKED_PLUGINS + 3)));
    }
}
