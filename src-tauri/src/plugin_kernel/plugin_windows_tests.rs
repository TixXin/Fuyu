use std::{
    collections::BTreeSet,
    sync::{Mutex, PoisonError},
};

use super::{
    window_url, ControlRequest, CreateWindow, PluginWindowOpenSpec, WindowDriver, WindowManager,
    WindowPatch, MAX_PER_PLUGIN, MAX_TOTAL, WINDOW_PREFIX,
};

#[derive(Default)]
struct FakeDriver {
    open_labels: Mutex<BTreeSet<String>>,
    created: Mutex<usize>,
    updated: Mutex<usize>,
}

impl FakeDriver {
    fn is_open(&self, label: &str) -> bool {
        self.open_labels.lock().unwrap_or_else(PoisonError::into_inner).contains(label)
    }

    fn open_count(&self) -> usize {
        self.open_labels.lock().unwrap_or_else(PoisonError::into_inner).len()
    }

    fn created_count(&self) -> usize {
        *self.created.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn updated_count(&self) -> usize {
        *self.updated.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

impl WindowDriver for FakeDriver {
    fn exists(&self, label: &str) -> bool {
        self.is_open(label)
    }

    fn create(&self, spec: &CreateWindow) -> Result<(), String> {
        self.open_labels
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(spec.label.clone());
        *self.created.lock().unwrap_or_else(PoisonError::into_inner) += 1;
        Ok(())
    }

    fn update(&self, label: &str, _patch: &WindowPatch) -> Result<(), String> {
        if !self.is_open(label) {
            return Err("missing".into());
        }
        *self.updated.lock().unwrap_or_else(PoisonError::into_inner) += 1;
        Ok(())
    }

    fn show(&self, label: &str) -> Result<(), String> {
        self.is_open(label).then_some(()).ok_or_else(|| "missing".into())
    }

    fn hide(&self, label: &str) -> Result<(), String> {
        self.is_open(label).then_some(()).ok_or_else(|| "missing".into())
    }

    fn focus(&self, label: &str) -> Result<(), String> {
        self.is_open(label).then_some(()).ok_or_else(|| "missing".into())
    }

    fn close(&self, label: &str) {
        self.open_labels.lock().unwrap_or_else(PoisonError::into_inner).remove(label);
    }
}

fn spec(plugin_id: &str, window_id: &str, kind: &str) -> PluginWindowOpenSpec {
    PluginWindowOpenSpec {
        plugin_id: plugin_id.to_owned(),
        window_id: window_id.to_owned(),
        kind: kind.to_owned(),
        title: Some(format!("{plugin_id}:{window_id}")),
        width: 320.0,
        height: 200.0,
        x: None,
        y: None,
        always_on_top: None,
        resizable: None,
        visible: None,
        click_through: None,
    }
}

#[test]
fn per_plugin_limit_caps_at_eight_and_reusing_same_id_keeps_its_label() {
    let manager = WindowManager::new();
    let driver = FakeDriver::default();
    for index in 0..MAX_PER_PLUGIN {
        let opened = manager.open(&driver, spec("clock", &format!("w-{index}"), "widget")).unwrap();
        assert!(!opened.focused);
        assert!(opened.visible);
    }
    let ninth = manager.open(&driver, spec("clock", "w-extra", "widget")).unwrap_err();
    assert_eq!(ninth.code, "limit");

    let first_label = manager.list(Some("clock"))[0].label.clone();
    let mut updated_spec = spec("clock", "w-0", "overlay");
    updated_spec.title = Some("Updated Clock".into());
    updated_spec.width = 480.0;
    updated_spec.height = 300.0;
    updated_spec.x = Some(100.0);
    updated_spec.y = Some(140.0);
    updated_spec.always_on_top = Some(true);
    updated_spec.click_through = Some(true);
    let reused = manager.open(&driver, updated_spec).unwrap();
    assert_eq!(reused.label, first_label);
    assert_eq!((reused.title.as_str(), reused.width, reused.height), ("Updated Clock", 480.0, 300.0));
    assert_eq!((reused.x, reused.y, reused.always_on_top, reused.click_through, reused.focused), (Some(100.0), Some(140.0), true, true, true));
    assert_eq!(driver.created_count(), MAX_PER_PLUGIN);
    assert_eq!(driver.updated_count(), 1);
}

#[test]
fn global_limit_caps_at_twenty_four_across_plugins_and_frees_slots_when_closed() {
    let manager = WindowManager::new();
    let driver = FakeDriver::default();
    for plugin_index in 0..3 {
        let plugin_id = format!("plugin-{plugin_index}");
        for win_index in 0..MAX_PER_PLUGIN {
            manager
                .open(&driver, spec(&plugin_id, &format!("win-{win_index}"), "widget"))
                .unwrap();
        }
    }
    assert_eq!(manager.list(None).len(), MAX_TOTAL);
    let overflow = manager.open(&driver, spec("plugin-3", "win-0", "overlay")).unwrap_err();
    assert_eq!(overflow.code, "limit");

    let (_, events) = manager
        .control(
            &driver,
            ControlRequest {
                plugin_id: "plugin-1".into(),
                window_id: Some("win-0".into()),
                action: "close".into(),
                ..ControlRequest::default()
            },
        )
        .unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0]["type"], "closed");
    assert_eq!(manager.list(None).len(), MAX_TOTAL - 1);

    let after_free = manager.open(&driver, spec("plugin-3", "win-0", "overlay")).unwrap();
    assert_eq!(after_free.plugin_id, "plugin-3");
    assert_eq!(manager.list(None).len(), MAX_TOTAL);
}

#[test]
fn control_updates_state_and_drain_or_destroy_cleans_up_every_window() {
    let manager = WindowManager::new();
    let driver = FakeDriver::default();
    let opened = manager.open(&driver, spec("notes", "pad", "overlay")).unwrap();
    assert!(opened.visible && opened.focused);

    let (hidden, _) = manager
        .control(
            &driver,
            ControlRequest {
                plugin_id: "notes".into(),
                window_id: Some("pad".into()),
                action: "hide".into(),
                ..ControlRequest::default()
            },
        )
        .unwrap();
    let hidden = hidden.unwrap();
    assert!(!hidden.visible && !hidden.focused);

    let (patched, _) = manager
        .control(
            &driver,
            ControlRequest {
                plugin_id: "notes".into(),
                window_id: Some("pad".into()),
                action: "update".into(),
                title: Some("Sticky".into()),
                width: Some(500.0),
                always_on_top: Some(true),
                click_through: Some(true),
                ..ControlRequest::default()
            },
        )
        .unwrap();
    let patched = patched.unwrap();
    assert_eq!((patched.title.as_str(), patched.width, patched.height), ("Sticky", 500.0, 200.0));
    assert!(patched.always_on_top && patched.click_through);

    manager.open(&driver, spec("notes", "second", "widget")).unwrap();
    manager.open(&driver, spec("other", "first", "widget")).unwrap();
    assert_eq!(manager.list(Some("notes")).len(), 2);
    assert_eq!(manager.list(Some("other")).len(), 1);

    let other_label = manager.list(Some("other"))[0].label.clone();
    driver.close(&other_label);
    assert!(manager.on_destroyed("other", "first", &other_label));
    assert_eq!(manager.list(Some("other")).len(), 0);

    let (_, closed_events) = manager
        .control(
            &driver,
            ControlRequest {
                plugin_id: "notes".into(),
                window_id: None,
                action: "closeAll".into(),
                ..ControlRequest::default()
            },
        )
        .unwrap();
    assert_eq!(closed_events.len(), 2);
    assert_eq!(manager.list(None).len(), 0);

    manager.open(&driver, spec("notes", "again", "widget")).unwrap();
    let drained = manager.drain_labels();
    for label in &drained {
        driver.close(label);
    }
    assert_eq!(drained.len(), 1);
    assert_eq!(driver.open_count(), 0);
    assert!(manager.list(None).is_empty());
}

#[test]
fn window_url_percent_encodes_scoped_ids_and_special_title_characters() {
    let url = window_url("@fuyu/pomodoro", "mini&1", "overlay", "专注 25:00 #1?ok=true");
    assert_eq!(
        url,
        "index.html?window=plugin-window&plugin=%40fuyu%2Fpomodoro&windowId=mini%261&kind=overlay&title=%E4%B8%93%E6%B3%A8%2025%3A00%20%231%3Fok%3Dtrue"
    );
}

#[test]
fn default_capability_covers_plugin_window_labels() {
    let raw = include_str!("../../capabilities/default.json");
    let parsed: serde_json::Value = serde_json::from_str(raw).unwrap();
    let windows = parsed["windows"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|entry| entry.as_str())
        .collect::<Vec<_>>();
    let pattern = format!("{WINDOW_PREFIX}*");
    assert!(windows.contains(&pattern.as_str()));
    assert!(parsed["permissions"].as_array().unwrap().iter().any(|entry| entry.as_str() == Some("core:window:allow-close")));
    assert!(parsed["permissions"].as_array().unwrap().iter().any(|entry| entry.as_str() == Some("core:window:allow-start-dragging")));
}
