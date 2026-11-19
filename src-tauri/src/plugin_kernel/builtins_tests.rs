use super::*;
use serde_json::json;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

#[derive(Default)]
struct Fake {
    running: AtomicBool,
    starts: AtomicUsize,
    stops: AtomicUsize,
    configured: Mutex<Vec<Map<String, Value>>>,
}

impl Background for Fake {
    fn start(&self) -> Result<(), String> {
        self.starts.fetch_add(1, Ordering::SeqCst);
        self.running.store(true, Ordering::SeqCst);
        Ok(())
    }

    fn stop(&self) {
        self.stops.fetch_add(1, Ordering::SeqCst);
        self.running.store(false, Ordering::SeqCst);
    }

    fn running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    fn configure(&self, config: &Map<String, Value>) {
        self.configured.lock().unwrap().push(config.clone());
    }
}

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-builtins-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn plugin(id: &str, kind: Kind, background: Option<&[&str]>) -> Builtin {
    Builtin { id: id.into(), kind, background: background.map(|names| names.iter().map(|name| (*name).to_owned()).collect()), default_off: false }
}

fn register(table: &mut Table, plugin: &str, name: &str, fake: &Arc<Fake>) {
    if let Some(action) = table.register(plugin, name, fake.clone()).unwrap() {
        action.run();
    }
}

#[test]
fn the_shipped_catalog_lists_every_built_in_plugin() {
    let catalog = parse_catalog(CATALOG).unwrap();
    let ids: Vec<&str> = catalog.iter().map(|plugin| plugin.id.as_str()).collect();
    assert_eq!(ids.len(), 22, "{ids:?}");
    for id in ["todos", "calendar", "music", "clipboard", "screenshot", "file-shelf", "translation", "voice-input", "timer", "agents", "session-ring", "claude-usage", "cc-connect", "ssh-tunnel", "local-api", "center-pattern", "messages", "device-events", "system-levels", "device-use", "theme-market", "updater"] {
        assert!(ids.contains(&id), "{id} is missing from builtins.json");
    }
    let essential: Vec<&str> = catalog.iter().filter(|plugin| plugin.kind == Kind::Essential).map(|plugin| plugin.id.as_str()).collect();
    assert_eq!(essential, ["updater"]);
}

#[test]
fn every_built_in_plugin_stops_and_starts_its_background_with_its_switch() {
    let catalog = catalog();
    let mut table = Table::new(catalog.clone(), BTreeSet::new());
    let all: Vec<(Builtin, Vec<Arc<Fake>>)> = catalog
        .iter()
        .map(|builtin| {
            let names = builtin.background.clone().unwrap_or_else(|| vec!["worker".into(), "watcher".into()]);
            let fakes: Vec<Arc<Fake>> = names
                .iter()
                .map(|name| {
                    let fake = Arc::new(Fake::default());
                    register(&mut table, &builtin.id, name, &fake);
                    fake
                })
                .collect();
            (builtin.clone(), fakes)
        })
        .collect();
    for (builtin, fakes) in &all {
        assert!(fakes.iter().all(|fake| fake.running()), "{} starts what it registers while it is on", builtin.id);
        if builtin.kind == Kind::Essential {
            assert!(table.set_enabled(&builtin.id, false).is_err());
            assert!(table.enabled(&builtin.id));
            continue;
        }
        run_all(table.set_enabled(&builtin.id, false).unwrap());
        assert!(!table.enabled(&builtin.id));
        assert!(fakes.iter().all(|fake| !fake.running()), "{} stops everything it registered", builtin.id);
        let listed = table.list().into_iter().find(|plugin| plugin.id == builtin.id).unwrap();
        assert!(!listed.enabled && listed.background.iter().all(|item| item.registered && !item.running));
        for (other, others) in &all {
            if other.id != builtin.id {
                assert!(others.iter().all(|fake| fake.running()), "switching {} off leaves {} alone", builtin.id, other.id);
            }
        }
        run_all(table.set_enabled(&builtin.id, true).unwrap());
        assert!(fakes.iter().all(|fake| fake.running() && fake.starts.load(Ordering::SeqCst) == 2 && fake.stops.load(Ordering::SeqCst) == 1), "{} comes back", builtin.id);
    }
}

#[test]
fn switching_to_the_same_state_does_nothing() {
    let mut table = Table::new(vec![plugin("timer", Kind::Builtin, None)], BTreeSet::new());
    let fake = Arc::new(Fake::default());
    register(&mut table, "timer", "ticker", &fake);
    assert!(table.set_enabled("timer", true).unwrap().is_empty());
    run_all(table.set_enabled("timer", false).unwrap());
    assert!(table.set_enabled("timer", false).unwrap().is_empty());
    assert_eq!(fake.stops.load(Ordering::SeqCst), 1);
}

#[test]
fn a_plugin_switched_off_in_the_file_does_not_start_what_it_registers() {
    let mut table = Table::new(vec![plugin("clipboard", Kind::Builtin, None)], BTreeSet::from(["clipboard".to_owned()]));
    let fake = Arc::new(Fake::default());
    register(&mut table, "clipboard", "watcher", &fake);
    assert!(!fake.running() && fake.starts.load(Ordering::SeqCst) == 0);
    run_all(table.set_enabled("clipboard", true).unwrap());
    assert!(fake.running());
}

#[test]
fn essential_and_unknown_plugins_are_refused() {
    let mut table = Table::new(vec![plugin("updater", Kind::Essential, Some(&[])), plugin("timer", Kind::Builtin, Some(&[]))], BTreeSet::from(["updater".to_owned(), "gone".to_owned()]));
    assert!(table.enabled("updater"), "the file cannot switch an essential plugin off");
    assert!(!table.enabled("gone"));
    assert_eq!(table.set_enabled("updater", false).unwrap_err().code(), "pluginsV3.builtinEssential");
    assert!(table.set_enabled("updater", true).unwrap().is_empty());
    assert_eq!(table.set_enabled("gone", false).unwrap_err().code(), "pluginsV3.builtinUnknown");
    assert!(table.disabled().is_empty());
}

#[test]
fn registrations_must_match_the_catalog() {
    let mut table = Table::new(vec![plugin("timer", Kind::Builtin, Some(&[])), plugin("clipboard", Kind::Builtin, Some(&["watcher"]))], BTreeSet::new());
    let fake: Arc<dyn Background> = Arc::new(Fake::default());
    assert!(table.register("nope", "worker", fake.clone()).unwrap_err().contains("not in builtins.json"));
    assert!(table.register("timer", "worker", fake.clone()).unwrap_err().contains("background list"));
    assert!(table.register("clipboard", "watcher", fake.clone()).unwrap().is_some());
    assert!(table.register("clipboard", "watcher", fake).unwrap_err().contains("twice"));
}

#[test]
fn the_list_shows_declared_background_that_never_registered() {
    let table = Table::new(vec![plugin("clipboard", Kind::Builtin, Some(&["watcher"])), plugin("timer", Kind::Builtin, Some(&[]))], BTreeSet::new());
    let list = table.list();
    assert_eq!(serde_json::to_value(&list).unwrap(), serde_json::json!([
        { "id": "clipboard", "kind": "builtin", "enabled": true, "background": [{ "name": "watcher", "registered": false, "running": false }], "config": {} },
        { "id": "timer", "kind": "builtin", "enabled": true, "background": [], "config": {} },
    ]));
}

#[test]
fn switches_are_saved_in_plugins_yml_next_to_other_entries() {
    let dir = scratch("file");
    let file = dir.join("plugins-v3").join(FILE);
    write_switch(&file, "timer", false).unwrap();
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "- id: timer\n  disabled: true\n");
    assert_eq!(read_disabled(&file), BTreeSet::from(["timer".to_owned()]));
    std::fs::write(&file, "- id: hello\n  name: ./hello.mjs\n- id: timer\n  disabled: true\n").unwrap();
    write_switch(&file, "translation", false).unwrap();
    write_switch(&file, "timer", true).unwrap();
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "- id: hello\n  name: ./hello.mjs\n- id: translation\n  disabled: true\n");
    assert_eq!(read_disabled(&dir.join("missing.yml")), BTreeSet::new());
    std::fs::write(&file, "[{ id: x }]\n").unwrap();
    assert_eq!(write_switch(&file, "timer", false).unwrap_err().code(), "pluginsV3.builtinSave");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn the_catalog_is_checked() {
    assert!(parse_catalog(r#"{ "format": 2, "plugins": [] }"#).unwrap_err().contains("format 2"));
    assert!(parse_catalog(r#"{ "format": 1, "plugins": [{ "id": "a" }, { "id": "a" }] }"#).unwrap_err().contains("twice"));
    assert!(parse_catalog("nope").is_err());
}

#[test]
fn config_is_kept_per_plugin_and_reaches_its_background() {
    let catalog = vec![plugin("timer", Kind::Builtin, None), plugin("clipboard", Kind::Builtin, None)];
    let loaded = BTreeMap::from([("timer".to_owned(), Map::from_iter([("sound".to_owned(), json!(false))])), ("gone".to_owned(), Map::from_iter([("x".to_owned(), json!(1))]))]);
    let mut table = Table::new(catalog, BTreeSet::new()).with_config(loaded);
    assert_eq!(Value::Object(table.config("timer")), json!({ "sound": false }));
    assert!(table.config("gone").is_empty());
    let fake = Arc::new(Fake::default());
    register(&mut table, "timer", "shortcut", &fake);
    table.set_config("timer", "shortcut", Some(json!("Ctrl+Alt+J"))).unwrap().unwrap().run();
    assert_eq!(fake.configured.lock().unwrap().last().cloned().map(Value::Object), Some(json!({ "sound": false, "shortcut": "Ctrl+Alt+J" })));
    assert!(table.set_config("timer", "shortcut", Some(json!("Ctrl+Alt+J"))).unwrap().is_none());
    table.set_config("timer", "sound", None).unwrap().unwrap().run();
    assert_eq!(Value::Object(table.config("timer")), json!({ "shortcut": "Ctrl+Alt+J" }));
    assert!(table.set_config("clipboard", "sound", None).unwrap().is_none());
    assert_eq!(table.set_config("timer", "bad key", Some(json!(1))).unwrap_err().code(), "pluginsV3.builtinConfigKey");
    assert_eq!(table.set_config("timer", "list", Some(json!([1]))).unwrap_err().code(), "pluginsV3.builtinConfigValue");
    assert_eq!(table.set_config("nope", "x", None).unwrap_err().code(), "pluginsV3.builtinUnknown");
    assert_eq!(serde_json::to_value(table.list()).unwrap()[0]["config"], json!({ "shortcut": "Ctrl+Alt+J" }));
}

#[test]
fn config_is_saved_in_plugins_yml() {
    let dir = scratch("config");
    let file = dir.join("plugins-v3").join(FILE);
    write_config(&file, "timer", "sound", Some(&json!(false))).unwrap();
    write_switch(&file, "timer", false).unwrap();
    assert_eq!(Value::Object(read_config(&file).remove("timer").unwrap()), json!({ "sound": false }));
    assert_eq!(read_disabled(&file), BTreeSet::from(["timer".to_owned()]));
    write_config(&file, "timer", "sound", None).unwrap();
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "- id: timer\n  disabled: true\n");
    std::fs::write(&file, "[{ id: x }]\n").unwrap();
    assert_eq!(write_config(&file, "timer", "sound", Some(&json!(true))).unwrap_err().code(), "pluginsV3.builtinConfigSave");
    let _ = std::fs::remove_dir_all(&dir);
}
